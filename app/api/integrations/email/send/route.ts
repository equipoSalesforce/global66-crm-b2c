import { sendEmail } from "@/lib/email-send";
import { saveEmailAttachment } from "@/lib/email-attachments";
import { buildEmailHtmlFromText } from "@/lib/email-html";
import { stripEditorOnlyMarkup } from "@/lib/email-template-renderer";
import {
  normalizeEmailSubject,
  normalizeMessageId,
} from "@/lib/email-threading";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type EmailSendPayload = {
  caseId?: unknown;
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  subject?: unknown;
  body?: unknown;
  bodyText?: unknown;
  htmlBody?: unknown;
  attachments?: unknown;
};

type EmailCaseRecord = {
  id: string | number;
  first_response_at: string | null;
  email_thread_id?: string | null;
  email_subject_key?: string | null;
  last_email_message_id?: string | null;
};

type EmailPayloadAttachment = {
  filename: string;
  contentType?: string;
  contentBase64: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmailList(value: string) {
  if (!value) return true;

  return value
    .split(",")
    .map((item) => item.trim())
    .every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function parsePayloadAttachments(value: unknown): EmailPayloadAttachment[] {
  if (!Array.isArray(value)) return [];

  const attachments: EmailPayloadAttachment[] = [];

  for (const attachment of value) {
    if (!attachment || typeof attachment !== "object") continue;

    const record = attachment as Record<string, unknown>;
    const filename =
      typeof record.filename === "string" ? record.filename.trim() : "";
    const contentBase64 =
      typeof record.contentBase64 === "string"
        ? record.contentBase64.trim()
        : "";
    const contentType =
      typeof record.contentType === "string" ? record.contentType.trim() : undefined;

    if (!filename || !contentBase64) continue;

    attachments.push({
      filename,
      contentType,
      contentBase64,
    });
  }

  return attachments;
}

function countOccurrences(value: string, needle: string) {
  if (!value || !needle) return 0;

  return value.split(needle).length - 1;
}

function resolveEmailHtmlForSend({
  htmlBody,
  body,
}: {
  htmlBody: string;
  body: string;
}) {
  if (htmlBody.trim()) {
    return stripEditorOnlyMarkup(htmlBody);
  }

  return body.trim() ? buildEmailHtmlFromText(body) || "" : "";
}

export async function POST(request: Request) {
  let payload: EmailSendPayload;

  try {
    payload = (await request.json()) as EmailSendPayload;
  } catch (error) {
    console.error("[email-send] Error parsing JSON", {
      message: getErrorMessage(error),
      error,
    });

    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const caseId = getString(payload.caseId);
  const to = getString(payload.to);
  const cc = getString(payload.cc);
  const bcc = getString(payload.bcc);
  const subject = getString(payload.subject);
  const body = getString(payload.bodyText) || getString(payload.body);
  const htmlBody = getString(payload.htmlBody);
  const finalEmailHtml = resolveEmailHtmlForSend({ htmlBody, body });
  const attachments = parsePayloadAttachments(payload.attachments);

  if (!caseId) return Response.json({ error: "caseId es requerido." }, { status: 400 });
  if (!to || !isValidEmailList(to)) {
    return Response.json({ error: "Destinatario inválido." }, { status: 400 });
  }
  if (cc && !isValidEmailList(cc)) {
    return Response.json({ error: "CC inválido." }, { status: 400 });
  }
  if (bcc && !isValidEmailList(bcc)) {
    return Response.json({ error: "CCO inválido." }, { status: 400 });
  }
  if (!subject) return Response.json({ error: "El asunto es requerido." }, { status: 400 });
  if (!body && !finalEmailHtml.trim()) {
    return Response.json({ error: "El cuerpo del correo es requerido." }, { status: 400 });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[email html compare - api]", {
      htmlBodyLength: htmlBody.length,
      finalHtmlLength: finalEmailHtml.length,
      incomingFooterCount: countOccurrences(htmlBody, "Sé Global"),
      outgoingFooterCount: countOccurrences(finalEmailHtml, "Sé Global"),
    });
  }

  const { data: caseItem, error: caseError } = await supabase
    .from("cases")
    .select("id, first_response_at, email_thread_id, email_subject_key, last_email_message_id")
    .eq("id", caseId)
    .single<EmailCaseRecord>();

  if (caseError || !caseItem) {
    console.error("[email-send] Error loading case", {
      caseId,
      message: caseError?.message ?? "No case returned",
      supabaseError: caseError,
    });

    return Response.json(
      { error: caseError?.message ?? "No se encontró el caso." },
      { status: 404 },
    );
  }

  let sendResult;

  try {
    sendResult = await sendEmail({
      to,
      cc,
      bcc,
      subject,
      body,
      htmlBody: finalEmailHtml || undefined,
      inReplyTo: normalizeMessageId(caseItem.last_email_message_id),
      references: normalizeMessageId(caseItem.last_email_message_id),
      attachments,
    });
  } catch (error) {
    console.error("[email-send] SMTP error", {
      caseId,
      message: getErrorMessage(error),
      smtpError: error,
    });

    return Response.json({ error: getErrorMessage(error) }, { status: 502 });
  }

  console.info("[email-send] SMTP message sent", {
    caseId,
    providerMessageId: sendResult.provider_message_id,
    accepted: sendResult.accepted,
    rejected: sendResult.rejected,
  });

  const now = new Date().toISOString();
  const inReplyTo = normalizeMessageId(caseItem.last_email_message_id);
  const references = inReplyTo ? [inReplyTo] : [];
  const providerMessageId = sendResult.provider_message_id;
  const normalizedProviderMessageId = normalizeMessageId(providerMessageId);
  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      case_id: caseId,
      channel: "GMAIL",
      message_type: "EMAIL",
      direction: "OUTBOUND",
      sender_type: "AGENT",
      body,
      email_text_body: body,
      email_html_body: finalEmailHtml || buildEmailHtmlFromText(body),
      email_subject: subject,
      email_from: process.env.GMAIL_EMAIL?.trim() || null,
      email_to: to,
      email_cc: cc || null,
      email_bcc: bcc || null,
      in_reply_to: inReplyTo,
      email_references: references.length > 0 ? references : null,
      external_message_id: providerMessageId,
      email_message_id: normalizedProviderMessageId,
      created_at: now,
    })
    .select("id, case_id, body, sender_type, direction, created_at, channel, message_type, email_subject, email_from, email_to, email_cc, email_bcc, email_html_body, email_text_body, in_reply_to, email_references, email_message_id")
    .single();

  if (insertError) {
    console.error("[email-send] Error inserting outbound message", {
      caseId,
      message: insertError.message,
      supabaseError: insertError,
      providerMessageId: sendResult.provider_message_id,
    });

    return Response.json({ error: insertError.message }, { status: 500 });
  }

  let attachmentsSaved = 0;

  for (const attachment of attachments) {
    try {
      await saveEmailAttachment({
        caseId,
        messageId: message.id,
        emailMessageId: normalizedProviderMessageId || providerMessageId || String(message.id),
        filename: attachment.filename,
        mimeType: attachment.contentType,
        content: Buffer.from(attachment.contentBase64, "base64"),
      });
      attachmentsSaved += 1;
    } catch (attachmentError) {
      console.error("[email-send] Error saving outbound attachment", {
        caseId,
        messageId: message.id,
        filename: attachment.filename,
        message: getErrorMessage(attachmentError),
        error: attachmentError,
      });
    }
  }

  const updatePayload = {
    updated_at: now,
    first_response_at: caseItem.first_response_at || now,
    email_thread_id:
      caseItem.email_thread_id || normalizedProviderMessageId || caseId,
    email_subject_key:
      caseItem.email_subject_key || normalizeEmailSubject(subject),
    last_email_message_id:
      normalizedProviderMessageId || caseItem.last_email_message_id || null,
  };
  const { error: updateError } = await supabase
    .from("cases")
    .update(updatePayload)
    .eq("id", caseId);

  if (updateError) {
    console.error("[email-send] Error updating case email thread", {
      caseId,
      message: updateError.message,
      supabaseError: updateError,
    });
  }

  console.info("[email-send] Activity registered", {
    caseId,
    event: "Correo enviado por agente",
    messageId: message?.id ?? null,
  });

  return Response.json({
    ok: true,
    message,
    providerMessageId: sendResult.provider_message_id,
    accepted: sendResult.accepted,
    rejected: sendResult.rejected,
    attachmentsSaved,
    activity: "Correo enviado por agente",
  });
}
