import { generateNextCaseNumber } from "./case-number";
import { saveEmailAttachment } from "./email-attachments";
import { sanitizeEmailHtml } from "./email-html";
import { normalizeEmailSubject, normalizeMessageId } from "./email-threading";
import { supabase } from "./supabase";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";

type EmailCaseRecord = {
  id: string | number;
  customer_id: string | number | null;
  contact_email: string | null;
  email_thread_id?: string | null;
  email_subject_key?: string | null;
  last_email_message_id?: string | null;
  customer?: {
    email?: string | null;
  } | null;
};

type CustomerRecord = {
  id: string | number;
  name: string | null;
  email: string | null;
};

type MessageRecord = {
  id: string | number;
  case_id: string | number | null;
};

export type EmailSyncResult = {
  success: boolean;
  processed: number;
  inserted: number;
  skipped: number;
  createdCases: number;
  errors: string[];
  attachmentsSaved: number;
};

type ParsedInboundEmail = {
  fromEmail: string;
  fromName: string | null;
  to: string | null;
  cc: string | null;
  subject: string;
  body: string;
  htmlBody: string | null;
  textBody: string | null;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  date: string;
  attachments: {
    filename: string;
    mimeType?: string | null;
    content: Buffer;
  }[];
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} no está configurada.`);
  }

  return value;
}

function getImapPort() {
  const port = Number(process.env.GMAIL_IMAP_PORT ?? 993);

  return Number.isFinite(port) ? port : 993;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function logSync(stage: string, details?: Record<string, unknown>) {
  console.info("[email-sync]", {
    stage,
    ...details,
  });
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function getAddress(addressObject: AddressObject | undefined) {
  const firstAddress = addressObject?.value[0];

  return {
    email: firstAddress?.address?.trim().toLowerCase() ?? "",
    name: firstAddress?.name?.trim() || null,
  };
}

function getAddressText(
  addressObject: AddressObject | AddressObject[] | undefined,
) {
  if (!addressObject) return null;
  if (Array.isArray(addressObject)) {
    return addressObject.map((item) => item.text).filter(Boolean).join(", ") || null;
  }

  return addressObject.text?.trim() || null;
}

function normalizeReferences(value: string | string[] | undefined) {
  if (!value) return [];

  const rawReferences = Array.isArray(value) ? value.join(" ") : value;

  return rawReferences
    .split(/\s+/)
    .map((reference) => normalizeMessageId(reference))
    .filter((reference): reference is string => Boolean(reference));
}

function buildSubject(subject: string) {
  const normalizedSubject = subject.replace(/\s+/g, " ").trim();

  return normalizedSubject || "Correo recibido";
}

function shouldIgnoreInboundEmail(email: ParsedInboundEmail) {
  const from = email.fromEmail.toLowerCase();
  const subject = email.subject.toLowerCase();
  const ignoredSenders = [
    "no-reply@",
    "noreply@",
    "notifications@",
    "notification@",
    "mailing@",
    "newsletter@",
    "accounts.google.com",
    "google.com",
  ];
  const ignoredSubjects = [
    "verificación en 2 pasos",
    "promociones",
    "promoción",
    "ofertas",
    "oferta",
    "cyber",
    "descuentos",
    "descuento",
    "alerta de seguridad",
    "alertas automáticas de seguridad",
    "security alert",
  ];

  return (
    ignoredSenders.some((value) => from.includes(value)) ||
    ignoredSubjects.some((value) => subject.includes(value))
  );
}

async function findMessageByExternalId(messageId: string) {
  return supabase
    .from("messages")
    .select("id, case_id")
    .or(`external_message_id.eq.${messageId},email_message_id.eq.${messageId}`)
    .limit(1)
    .returns<MessageRecord[]>();
}

async function findCaseByReplyHeaders({
  inReplyTo,
  references,
}: {
  inReplyTo: string | null;
  references: string[];
}) {
  const candidates = [inReplyTo, ...references].filter(
    (value): value is string => Boolean(value),
  );

  for (const messageId of candidates) {
    const { data, error } = await supabase
      .from("cases")
      .select(
        "id, customer_id, contact_email, email_thread_id, email_subject_key, last_email_message_id, customer:customers(email)",
      )
      .or(`last_email_message_id.eq.${messageId},email_thread_id.eq.${messageId}`)
      .neq("status", "CLOSED")
      .order("updated_at", { ascending: false })
      .limit(1)
      .returns<EmailCaseRecord[]>();

    if (error) {
      console.error("[email-sync] Error finding case by message id", {
        message: error.message,
        supabaseError: error,
        messageId,
      });
      continue;
    }

    if (data?.[0]) return data[0];

    const { data: messages, error: messageError } = await supabase
      .from("messages")
      .select("id, case_id")
      .or(`external_message_id.eq.${messageId},email_message_id.eq.${messageId}`)
      .limit(1)
      .returns<MessageRecord[]>();

    if (messageError) {
      console.error("[email-sync] Error finding message by reply id", {
        message: messageError.message,
        supabaseError: messageError,
        messageId,
      });
      continue;
    }

    if (messages?.[0]?.case_id) {
      return {
        id: messages[0].case_id,
        customer_id: null,
        contact_email: null,
      };
    }
  }

  return null;
}

async function findCaseBySubject(subjectKey: string) {
  const { data, error } = await supabase
    .from("cases")
    .select(
      "id, customer_id, contact_email, email_thread_id, email_subject_key, last_email_message_id, customer:customers(email)",
    )
    .eq("email_subject_key", subjectKey)
    .neq("status", "CLOSED")
    .order("updated_at", { ascending: false })
    .limit(10)
    .returns<EmailCaseRecord[]>();

  if (error) {
    console.error("[email-sync] Error finding case by subject", {
      message: error.message,
      supabaseError: error,
      subjectKey,
    });

    return null;
  }

  return data?.[0] ?? null;
}

async function findOrCreateCustomer(email: string, name: string | null) {
  const { data: customers, error: lookupError } = await supabase
    .from("customers")
    .select("id, name, email")
    .eq("email", email)
    .limit(1)
    .returns<CustomerRecord[]>();

  if (lookupError) throw lookupError;
  if (customers?.[0]) return customers[0];

  const { data: customer, error: createError } = await supabase
    .from("customers")
    .insert({
      name,
      email,
    })
    .select("id, name, email")
    .single<CustomerRecord>();

  if (createError) throw createError;

  return customer;
}

async function createEmailCase(email: ParsedInboundEmail) {
  const customer = await findOrCreateCustomer(email.fromEmail, email.fromName);
  const caseNumber = await generateNextCaseNumber();
  const now = new Date().toISOString();

  const { data: caseItem, error } = await supabase
    .from("cases")
    .insert({
      case_number: caseNumber,
      customer_id: customer.id,
      channel: "GMAIL",
      contact_type: "GMAIL",
      subject: buildSubject(email.subject),
      contact_email: email.fromEmail,
      contact_name: email.fromName,
      lifecycle_status: "NEW",
      routing_status: "UNASSIGNED",
      status: "HUMAN_REQUIRED",
      priority: "MEDIUM",
      area: "GENERAL",
      category: "CONSULTA",
      email_subject_key: normalizeEmailSubject(email.subject),
      last_email_message_id: email.messageId,
      email_thread_id: email.messageId,
      updated_at: now,
    })
    .select(
      "id, customer_id, contact_email, email_thread_id, email_subject_key, last_email_message_id, customer:customers(email)",
    )
    .single<EmailCaseRecord>();

  if (error) throw error;

  return caseItem;
}

async function insertInboundEmailMessage(
  caseId: string | number,
  email: ParsedInboundEmail,
) {
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      case_id: caseId,
      channel: "GMAIL",
      message_type: "EMAIL",
      direction: "INBOUND",
      sender_type: "CUSTOMER",
      body: email.body,
      email_text_body: email.textBody,
      email_html_body: email.htmlBody,
      email_subject: email.subject,
      email_from: email.fromEmail,
      email_to: email.to,
      email_cc: email.cc,
      in_reply_to: email.inReplyTo,
      email_references: email.references.length > 0 ? email.references : null,
      external_message_id: email.messageId,
      email_message_id: email.messageId,
      created_at: email.date,
    })
    .select("id")
    .single<{ id: string | number }>();

  if (error || !message) throw error ?? new Error("No message returned");

  logSync("mensaje insertado", {
    caseId,
    messageId: email.messageId,
  });

  const { error: updateError } = await supabase
    .from("cases")
    .update({
      updated_at: new Date().toISOString(),
      last_email_message_id: email.messageId,
      email_subject_key: normalizeEmailSubject(email.subject),
      email_thread_id: email.inReplyTo || email.messageId,
    })
    .eq("id", caseId);

  if (updateError) {
    console.error("[email-sync] Error updating case after inbound email", {
      caseId,
      message: updateError.message,
      supabaseError: updateError,
    });
  }

  return message.id;
}

async function parseInboundEmail(source: Buffer) {
  const parsed = await simpleParser(source);
  const from = getAddress(parsed.from);
  const to = getAddressText(parsed.to);
  const cc = getAddressText(parsed.cc);
  const subject = parsed.subject?.trim() || "Correo recibido";
  const textBody = parsed.text?.trim() || null;
  const htmlBody = sanitizeEmailHtml(parsed.html?.toString());
  const body = textBody || htmlBody?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "";
  const messageId = normalizeMessageId(parsed.messageId);

  if (!from.email || !messageId || !body) return null;

  return {
    fromEmail: from.email,
    fromName: from.name,
    to,
    cc,
    subject,
    body,
    htmlBody,
    textBody,
    messageId,
    inReplyTo: normalizeMessageId(parsed.inReplyTo),
    references: normalizeReferences(parsed.references),
    date: (parsed.date ?? new Date()).toISOString(),
    attachments: parsed.attachments.map((attachment) => ({
      filename: attachment.filename || "attachment",
      mimeType: attachment.contentType,
      content: attachment.content,
    })),
  } satisfies ParsedInboundEmail;
}

export async function syncInboundEmails(): Promise<EmailSyncResult> {
  const email = process.env.GMAIL_EMAIL?.trim() ?? "";
  const passwordPresent = Boolean(process.env.GMAIL_APP_PASSWORD?.trim());
  const host = process.env.GMAIL_IMAP_HOST?.trim() || "imap.gmail.com";
  const port = getImapPort();
  const secure = port === 993;
  const result: EmailSyncResult = {
    success: true,
    processed: 0,
    inserted: 0,
    skipped: 0,
    createdCases: 0,
    errors: [],
    attachmentsSaved: 0,
  };

  logSync("inicio servicio", {
    gmailEmailPresent: Boolean(email),
    gmailAppPasswordPresent: passwordPresent,
    host,
    port,
    secure,
  });

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: {
      user: getRequiredEnv("GMAIL_EMAIL"),
      pass: getRequiredEnv("GMAIL_APP_PASSWORD"),
    },
    logger: false,
  });
  let connected = false;
  let lock: Awaited<ReturnType<typeof client.getMailboxLock>> | null = null;

  try {
    logSync("conexión IMAP iniciada", {
      host,
      port,
      secure,
      user: email,
      timeoutMs: 15000,
    });
    await withTimeout(
      client.connect(),
      15000,
      "Timeout conectando a IMAP después de 15 segundos.",
    );
    connected = true;
    logSync("conexión IMAP exitosa");

    lock = await withTimeout(
      client.getMailboxLock("INBOX"),
      15000,
      "Timeout abriendo INBOX después de 15 segundos.",
    );
    logSync("mailbox abierto", {
      mailbox: "INBOX",
    });

    const searchResult = await client.search({ all: true }, { uid: true });
    const allUids = Array.isArray(searchResult) ? searchResult : [];
    const candidateUids = [...allUids]
      .sort((uidA, uidB) => uidB - uidA)
      .slice(0, 20);

    logSync("cantidad de mensajes candidatos", {
      count: candidateUids.length,
      uids: candidateUids.slice(0, 20),
      strategy: "last_20_inbox_messages_newest_first",
    });

    for (const candidateUid of candidateUids) {
      const message = await client.fetchOne(
        String(candidateUid),
        {
          uid: true,
          source: true,
          envelope: true,
        },
        { uid: true },
      );
      result.processed += 1;
      logSync("procesando mensaje candidato", {
        uid: candidateUid,
        fetchResultNull: !message,
        envelopeMessageId: message ? message.envelope?.messageId ?? null : null,
        subject: message ? message.envelope?.subject ?? null : null,
      });

      try {
        if (!message) {
          result.skipped += 1;
          logSync("mensaje ignorado", {
            uid: candidateUid,
            reason: "fetch_result_null",
          });
          continue;
        }

        if (!message.source) {
          result.skipped += 1;
          await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          logSync("correo marcado como leído o procesado", {
            uid: message.uid,
            reason: "missing_source",
          });
          continue;
        }

        const email = await parseInboundEmail(message.source);

        if (!email) {
          result.skipped += 1;
          logSync("mensaje ignorado", {
            uid: message.uid,
            reason: "without_parseable_content",
          });
          await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          logSync("correo marcado como leído o procesado", {
            uid: message.uid,
            reason: "without_parseable_content",
          });
          continue;
        }

        logSync("messageId procesado", {
          uid: message.uid,
          messageId: email.messageId,
          from: email.fromEmail,
          subject: email.subject,
          inReplyTo: email.inReplyTo,
          references: email.references,
          referencesCount: email.references.length,
        });

        const { data: duplicateMessages, error: duplicateError } =
          await findMessageByExternalId(email.messageId);

        if (duplicateError) {
          throw duplicateError;
        }

        if (duplicateMessages?.[0]) {
          result.skipped += 1;
          logSync("mensaje duplicado omitido", {
            uid: message.uid,
            messageId: email.messageId,
            caseId: duplicateMessages[0].case_id,
          });
          await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          logSync("correo marcado como leído o procesado", {
            uid: message.uid,
            reason: "duplicate",
          });
          continue;
        }

        const byHeaders = await findCaseByReplyHeaders({
          inReplyTo: email.inReplyTo,
          references: email.references,
        });
        const bySubject = byHeaders
          ? null
          : await findCaseBySubject(normalizeEmailSubject(email.subject));
        const matchedCase = byHeaders ?? bySubject;
        let caseItem: EmailCaseRecord;
        let created = false;

        if (matchedCase) {
          caseItem = matchedCase;
          logSync("resultado de match con caso", {
            uid: message.uid,
            messageId: email.messageId,
            caseId: caseItem.id,
            strategy: byHeaders ? "reply_headers" : "subject",
          });
        } else if (shouldIgnoreInboundEmail(email)) {
          result.skipped += 1;
          logSync("mensaje ignorado", {
            uid: message.uid,
            messageId: email.messageId,
            from: email.fromEmail,
            subject: email.subject,
            reason: "automated_or_promotional",
          });
          await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          logSync("correo marcado como leído o procesado", {
            uid: message.uid,
            reason: "automated_or_promotional",
          });
          continue;
        } else {
          caseItem = await createEmailCase(email);
          created = true;
          logSync("resultado de match con caso", {
            uid: message.uid,
            messageId: email.messageId,
            caseId: caseItem.id,
            strategy: "created_new_case",
          });
        }

        const messageId = await insertInboundEmailMessage(caseItem.id, email);

        result.inserted += 1;
        if (created) result.createdCases += 1;

        for (const attachment of email.attachments) {
          try {
            await saveEmailAttachment({
              caseId: caseItem.id,
              messageId,
              emailMessageId: email.messageId,
              filename: attachment.filename,
              mimeType: attachment.mimeType,
              content: attachment.content,
            });
            result.attachmentsSaved += 1;
            logSync("adjunto guardado", {
              uid: message.uid,
              caseId: caseItem.id,
              messageId,
              filename: attachment.filename,
              sizeBytes: attachment.content.byteLength,
            });
          } catch (attachmentError) {
            const attachmentErrorMessage = getErrorMessage(attachmentError);

            result.errors.push(
              `UID ${candidateUid} adjunto ${attachment.filename}: ${attachmentErrorMessage}`,
            );
            console.error("[email-sync] Error guardando adjunto", {
              uid: candidateUid,
              filename: attachment.filename,
              message: attachmentErrorMessage,
              error: attachmentError,
            });
          }
        }

        logSync("correo inbound procesado", {
          uid: message.uid,
          caseId: caseItem.id,
          from: email.fromEmail,
          subject: email.subject,
          messageId: email.messageId,
          createdCase: created,
        });

        await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
        logSync("correo marcado como leído o procesado", {
          uid: message.uid,
          reason: "processed",
        });
      } catch (error) {
        const errorMessage = getErrorMessage(error);

        result.skipped += 1;
        result.errors.push(`UID ${candidateUid}: ${errorMessage}`);
        console.error("[email-sync] Error procesando correo", {
          uid: candidateUid,
          message: errorMessage,
          error,
        });
      }
    }
  } catch (error) {
    const message = getErrorMessage(error);
    result.success = false;
    result.errors.push(message);
    console.error("[email-sync] Error durante sincronización", {
      message,
      error,
    });
  } finally {
    if (lock) {
      lock.release();
      logSync("mailbox lock liberado");
    }

    if (connected) {
      try {
        await client.logout();
        logSync("conexión IMAP cerrada");
      } catch (error) {
        const message = getErrorMessage(error);
        result.success = false;
        result.errors.push(message);
        console.error("[email-sync] Error cerrando conexión IMAP", {
          message,
          error,
        });
      }
    }
  }

  logSync("fin sync", result);

  return result;
}
