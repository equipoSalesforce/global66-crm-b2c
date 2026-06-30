import { sendGmailMessage } from "@/lib/gmail-send";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type GmailSendPayload = {
  caseId?: unknown;
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  subject?: unknown;
  body?: unknown;
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

function getGmailErrorMessage(status: number, fallback: string) {
  if (status === 401) return "Gmail no autorizó la solicitud. Revisa el refresh token.";
  if (status === 403) return "Gmail rechazó el envío. Revisa permisos y scopes.";
  if (status === 429) return "Gmail limitó temporalmente los envíos. Intenta más tarde.";

  return fallback;
}

export async function POST(request: Request) {
  let payload: GmailSendPayload;

  try {
    payload = (await request.json()) as GmailSendPayload;
  } catch (error) {
    console.error("[gmail-send] Error parsing JSON", {
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
  const body = getString(payload.body);

  if (!caseId) {
    return Response.json({ error: "caseId es requerido." }, { status: 400 });
  }
  if (!to || !isValidEmailList(to)) {
    return Response.json({ error: "Destinatario inválido." }, { status: 400 });
  }
  if (cc && !isValidEmailList(cc)) {
    return Response.json({ error: "CC inválido." }, { status: 400 });
  }
  if (bcc && !isValidEmailList(bcc)) {
    return Response.json({ error: "CCO inválido." }, { status: 400 });
  }
  if (!subject) {
    return Response.json({ error: "El asunto es requerido." }, { status: 400 });
  }
  if (!body) {
    return Response.json({ error: "El cuerpo del correo es requerido." }, { status: 400 });
  }

  const sendResult = await sendGmailMessage({
    to,
    cc,
    bcc,
    subject,
    body,
  });

  if (!sendResult.ok) {
    const errorMessage = getGmailErrorMessage(sendResult.status, sendResult.error);

    console.error("[gmail-send] Error sending Gmail message", {
      caseId,
      status: sendResult.status,
      message: sendResult.error,
      gmailError: sendResult.response ?? null,
    });

    return Response.json(
      {
        error: errorMessage,
        details: sendResult.error,
      },
      { status: sendResult.status || 502 },
    );
  }

  console.info("[gmail-send] Gmail message sent", {
    caseId,
    to,
    cc: cc || null,
    bcc: bcc ? "[redacted]" : null,
    subject,
    gmailResponse: sendResult.response,
  });

  const createdAt = new Date().toISOString();
  const messageBody = [
    `Para: ${to}`,
    cc ? `CC: ${cc}` : null,
    bcc ? "CCO: [redacted]" : null,
    `Asunto: ${subject}`,
    "",
    body,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      case_id: caseId,
      channel: "GMAIL",
      message_type: "EMAIL",
      sender_type: "AGENT",
      direction: "OUTBOUND",
      body: messageBody,
      created_at: createdAt,
    })
    .select("id, case_id, body, sender_type, direction, created_at, channel, message_type")
    .single();

  if (insertError) {
    console.error("[gmail-send] Error inserting sent email message", {
      caseId,
      message: insertError.message,
      supabaseError: insertError,
      gmailResponse: sendResult.response,
    });

    return Response.json({ error: insertError.message }, { status: 500 });
  }

  console.info("[gmail-send] Activity registered", {
    caseId,
    event: "Correo enviado por agente",
    messageId: message?.id ?? null,
  });

  return Response.json({
    ok: true,
    message,
    gmailResponse: sendResult.response,
    activity: "Correo enviado por agente",
  });
}
