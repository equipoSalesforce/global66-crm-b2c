import {
  processWhatsAppInbound,
  type WhatsAppInboundMediaPayload,
} from "@/lib/whatsapp-inbound";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type MetaContact = {
  profile?: {
    name?: unknown;
  };
  wa_id?: unknown;
};

type MetaMessage = {
  from?: unknown;
  id?: unknown;
  type?: unknown;
  text?: {
    body?: unknown;
  };
  image?: {
    id?: unknown;
    mime_type?: unknown;
    sha256?: unknown;
    caption?: unknown;
  };
  audio?: {
    id?: unknown;
    mime_type?: unknown;
    sha256?: unknown;
    voice?: unknown;
  };
  document?: {
    id?: unknown;
    mime_type?: unknown;
    sha256?: unknown;
    filename?: unknown;
    caption?: unknown;
  };
  sticker?: {
    id?: unknown;
    mime_type?: unknown;
    sha256?: unknown;
  };
  video?: {
    id?: unknown;
    mime_type?: unknown;
    sha256?: unknown;
    caption?: unknown;
  };
};

type MetaValue = {
  contacts?: unknown;
  messages?: unknown;
  statuses?: unknown;
};

type MetaStatus = {
  id?: unknown;
  status?: unknown;
  timestamp?: unknown;
  recipient_id?: unknown;
  errors?: unknown;
};

type MetaChange = {
  value?: MetaValue;
};

type MetaEntry = {
  changes?: unknown;
};

type MetaWebhookPayload = {
  entry?: unknown;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logWebhook(stage: string, details?: Record<string, unknown>) {
  console.info("[api/webhooks/whatsapp]", {
    stage,
    ...details,
  });
}

function asMetaEntries(payload: MetaWebhookPayload): MetaEntry[] {
  return Array.isArray(payload.entry) ? (payload.entry as MetaEntry[]) : [];
}

function asMetaChanges(entry: MetaEntry): MetaChange[] {
  return Array.isArray(entry.changes) ? (entry.changes as MetaChange[]) : [];
}

function asMetaContacts(value: MetaValue): MetaContact[] {
  return Array.isArray(value.contacts) ? (value.contacts as MetaContact[]) : [];
}

function asMetaMessages(value: MetaValue): MetaMessage[] {
  return Array.isArray(value.messages) ? (value.messages as MetaMessage[]) : [];
}

function asMetaStatuses(value: MetaValue): MetaStatus[] {
  return Array.isArray(value.statuses) ? (value.statuses as MetaStatus[]) : [];
}

function getContactName({
  contacts,
  from,
}: {
  contacts: MetaContact[];
  from: string;
}) {
  const matchingContact =
    contacts.find((contact) => String(contact.wa_id ?? "") === from) ??
    contacts[0];
  const contactName = matchingContact?.profile?.name;

  return typeof contactName === "string" && contactName.trim()
    ? contactName.trim()
    : undefined;
}

function getOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeDeliveryStatus(status: unknown) {
  const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : "";

  if (!["sent", "delivered", "read", "failed"].includes(normalizedStatus)) {
    return null;
  }

  return normalizedStatus.toUpperCase();
}

function timestampToIso(timestamp: unknown) {
  const timestampText =
    typeof timestamp === "string" || typeof timestamp === "number"
      ? String(timestamp).trim()
      : "";
  const timestampNumber = Number(timestampText);

  if (!Number.isFinite(timestampNumber) || timestampNumber <= 0) {
    return new Date().toISOString();
  }

  return new Date(timestampNumber * 1000).toISOString();
}

function getStatusFailureReason(errors: unknown) {
  if (!Array.isArray(errors) || errors.length === 0) return null;

  return errors
    .map((error) => {
      if (!error || typeof error !== "object") return String(error);

      const errorRecord = error as {
        code?: unknown;
        title?: unknown;
        message?: unknown;
        error_data?: {
          details?: unknown;
        };
      };

      return [
        getOptionalString(errorRecord.code),
        getOptionalString(errorRecord.title),
        getOptionalString(errorRecord.message),
        getOptionalString(errorRecord.error_data?.details),
      ]
        .filter(Boolean)
        .join(" - ");
    })
    .filter(Boolean)
    .join(" | ");
}

async function processWhatsAppStatus(status: MetaStatus) {
  const externalMessageId = getOptionalString(status.id);
  const deliveryStatus = normalizeDeliveryStatus(status.status);
  const occurredAt = timestampToIso(status.timestamp);
  const recipientId = getOptionalString(status.recipient_id);

  console.info("[whatsapp-status] received", {
    externalMessageId,
    status: status.status,
    deliveryStatus,
    timestamp: status.timestamp,
    recipientId,
    hasErrors: Array.isArray(status.errors) && status.errors.length > 0,
  });

  if (!externalMessageId || !deliveryStatus) {
    console.info("[whatsapp-status] message not found", {
      reason: "missing id or unsupported status",
      externalMessageId,
      status: status.status,
    });

    return { updated: false, reason: "invalid-status" };
  }

  const updatePayload: Record<string, string | null> = {
    delivery_status: deliveryStatus,
  };

  if (deliveryStatus === "DELIVERED") {
    updatePayload.delivered_at = occurredAt;
  }

  if (deliveryStatus === "READ") {
    updatePayload.read_at = occurredAt;
    updatePayload.delivered_at = occurredAt;
  }

  if (deliveryStatus === "FAILED") {
    updatePayload.failed_at = occurredAt;
    updatePayload.failure_reason = getStatusFailureReason(status.errors);
  }

  const { data, error } = await supabase
    .from("messages")
    .update(updatePayload)
    .eq("external_message_id", externalMessageId)
    .select("id, case_id")
    .returns<Array<{ id: string | number; case_id: string | number | null }>>();

  if (error) {
    console.error("[whatsapp-status] update failed", {
      externalMessageId,
      deliveryStatus,
      message: error.message,
      supabaseError: error,
    });

    return { updated: false, reason: error.message };
  }

  if (!data || data.length === 0) {
    console.info("[whatsapp-status] message not found", {
      externalMessageId,
      deliveryStatus,
    });

    return { updated: false, reason: "message-not-found" };
  }

  console.info("[whatsapp-status] updated message", {
    externalMessageId,
    deliveryStatus,
    messageIds: data.map((message) => message.id),
    caseIds: data.map((message) => message.case_id),
  });

  return { updated: true, count: data.length };
}

function getMediaPayload(message: MetaMessage): WhatsAppInboundMediaPayload | null {
  if (message.type === "image" && message.image) {
    const id = getOptionalString(message.image.id);
    if (!id) return null;

    return {
      id,
      type: "image",
      mimeType: getOptionalString(message.image.mime_type),
      sha256: getOptionalString(message.image.sha256),
      caption: getOptionalString(message.image.caption),
    };
  }

  if (message.type === "audio" && message.audio) {
    const id = getOptionalString(message.audio.id);
    if (!id) return null;

    return {
      id,
      type: message.audio.voice === true ? "voice" : "audio",
      mimeType: getOptionalString(message.audio.mime_type),
      sha256: getOptionalString(message.audio.sha256),
      voice: message.audio.voice === true,
    };
  }

  if (message.type === "document" && message.document) {
    const id = getOptionalString(message.document.id);
    if (!id) return null;

    return {
      id,
      type: "document",
      mimeType: getOptionalString(message.document.mime_type),
      sha256: getOptionalString(message.document.sha256),
      filename: getOptionalString(message.document.filename),
      caption: getOptionalString(message.document.caption),
    };
  }

  if (message.type === "sticker" && message.sticker) {
    const id = getOptionalString(message.sticker.id);
    if (!id) return null;

    return {
      id,
      type: "sticker",
      mimeType: getOptionalString(message.sticker.mime_type),
      sha256: getOptionalString(message.sticker.sha256),
    };
  }

  if (message.type === "video" && message.video) {
    const id = getOptionalString(message.video.id);
    if (!id) return null;

    return {
      id,
      type: "video",
      mimeType: getOptionalString(message.video.mime_type),
      sha256: getOptionalString(message.video.sha256),
      caption: getOptionalString(message.video.caption),
    };
  }

  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  logWebhook("verificación recibida", {
    mode,
    hasChallenge: Boolean(challenge),
    hasExpectedToken: Boolean(expectedToken),
  });

  if (mode === "subscribe" && verifyToken === expectedToken && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  logWebhook("verificación rechazada", {
    mode,
    tokenMatches: verifyToken === expectedToken,
  });

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  let payload: MetaWebhookPayload;

  try {
    payload = (await request.json()) as MetaWebhookPayload;
  } catch (error) {
    console.error("[api/webhooks/whatsapp] Error parsing webhook JSON", {
      message: getErrorMessage(error),
      error,
    });

    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  logWebhook("webhook recibido", {
    entryCount: asMetaEntries(payload).length,
  });

  const results: {
    externalMessageId: string;
    caseId: string | number;
    customerId: string | number | null;
  }[] = [];
  let statusesProcessed = 0;
  let statusesUpdated = 0;

  for (const entry of asMetaEntries(payload)) {
    for (const change of asMetaChanges(entry)) {
      const value = change.value ?? {};
      const contacts = asMetaContacts(value);
      const messages = asMetaMessages(value);
      const statuses = asMetaStatuses(value);

      for (const status of statuses) {
        statusesProcessed += 1;
        const result = await processWhatsAppStatus(status);
        if (result.updated) statusesUpdated += result.count ?? 1;
      }

      if (messages.length === 0) {
        logWebhook("payload sin mensajes entrantes", {
          hasStatuses: statuses.length > 0,
        });
        continue;
      }

      for (const message of messages) {
        if (
          !["text", "image", "audio", "document", "sticker", "video"].includes(
            String(message.type),
          )
        ) {
          logWebhook("mensaje ignorado", {
            reason: "tipo no soportado",
            type: message.type,
            messageId: message.id,
          });
          continue;
        }

        const from = typeof message.from === "string" ? message.from.trim() : "";
        const body =
          typeof message.text?.body === "string" ? message.text.body.trim() : "";
        const media = getMediaPayload(message);
        const externalMessageId =
          typeof message.id === "string" ? message.id.trim() : "";
        const name = getContactName({ contacts, from });

        if (!from || (!body && !media) || !externalMessageId) {
          logWebhook("mensaje ignorado", {
            reason: "faltan campos requeridos",
            from,
            hasBody: Boolean(body),
            hasMedia: Boolean(media),
            externalMessageId,
          });
          continue;
        }

        logWebhook("mensaje extraído", {
          from,
          name,
          externalMessageId,
          messagePreview: body.slice(0, 160),
          mediaType: media?.type ?? null,
        });

        try {
          const result = await processWhatsAppInbound({
            from,
            name,
            message: body,
            externalMessageId,
            media,
          });

          if (!result.ok) {
            console.error("[api/webhooks/whatsapp] Error de procesamiento", {
              externalMessageId,
              status: result.status,
              error: result.error,
            });
            continue;
          }

          results.push({
            externalMessageId,
            caseId: result.caseId,
            customerId: result.customerId,
          });
        } catch (error) {
          console.error("[api/webhooks/whatsapp] Error de procesamiento", {
            message: getErrorMessage(error),
            externalMessageId,
            error,
          });
        }
      }
    }
  }

  return Response.json({
    ok: true,
    processed: results.length,
    statusesProcessed,
    statusesUpdated,
    results,
  });
}
