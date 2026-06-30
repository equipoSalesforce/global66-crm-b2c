import { runAiTriage } from "./ai-triage";
import { generateNextCaseNumber } from "./case-number";
import { supabase } from "./supabase";
import {
  downloadWhatsappMedia,
  saveWhatsappMediaAttachment,
  type WhatsappMediaType,
} from "./whatsapp-media";

export type WhatsAppInboundPayload = {
  from?: unknown;
  name?: unknown;
  message?: unknown;
  externalMessageId?: unknown;
  media?: unknown;
};

export type WhatsAppInboundMediaPayload = {
  id: string;
  type: WhatsappMediaType;
  mimeType?: string | null;
  filename?: string | null;
  caption?: string | null;
  sha256?: string | null;
  voice?: boolean | null;
};

export type WhatsAppInboundResult =
  | {
      ok: true;
      caseId: string | number;
      customerId: string | number | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

type CustomerRecord = {
  id: string | number;
  name: string | null;
  phone: string | null;
};

type CaseRecord = {
  id: string | number;
  customer_id: string | number | null;
  area: string | null;
  category: string | null;
  channel: string | null;
  contact_type: string | null;
  status: string | null;
};

type MessageRecord = {
  id: string | number;
  case_id: string | number | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logSupabaseError(scope: string, error: unknown) {
  console.error(`[whatsapp-inbound] ${scope}`, {
    message: getErrorMessage(error),
    supabaseError: error,
  });
}

function logInbound(stage: string, details?: Record<string, unknown>) {
  console.info("[whatsapp-inbound]", {
    stage,
    ...details,
  });
}

export function isWhatsAppInboundPayload(
  payload: WhatsAppInboundPayload,
): payload is {
  from: string;
  name?: string;
  message?: string;
  externalMessageId: string;
  media?: WhatsAppInboundMediaPayload;
} {
  const hasTextMessage =
    typeof payload.message === "string" && payload.message.trim().length > 0;
  const media = payload.media as Partial<WhatsAppInboundMediaPayload> | undefined;
  const hasMedia =
    Boolean(media) &&
    typeof media?.id === "string" &&
    media.id.trim().length > 0 &&
    typeof media?.type === "string" &&
    media.type.trim().length > 0;

  return (
    typeof payload.from === "string" &&
    payload.from.trim().length > 0 &&
    (typeof payload.name === "string" || typeof payload.name === "undefined") &&
    (hasTextMessage || hasMedia) &&
    typeof payload.externalMessageId === "string" &&
    payload.externalMessageId.trim().length > 0
  );
}

function buildSubject(message: string) {
  const firstLine = message.trim().split(/\r?\n/)[0] ?? message.trim();
  const compactSubject = firstLine.replace(/\s+/g, " ").trim();

  if (compactSubject.length <= 80) {
    return compactSubject || "Mensaje WhatsApp";
  }

  return `${compactSubject.slice(0, 77)}...`;
}

async function findMessageByExternalId(externalMessageId: string) {
  return supabase
    .from("messages")
    .select("id, case_id")
    .eq("external_message_id", externalMessageId)
    .limit(1)
    .returns<MessageRecord[]>();
}

async function findCaseById(caseId: string | number) {
  return supabase
    .from("cases")
    .select("id, customer_id, area, category, channel, contact_type, status")
    .eq("id", caseId)
    .limit(1)
    .returns<CaseRecord[]>();
}

async function findCustomerByPhone(phone: string) {
  return supabase
    .from("customers")
    .select("id, name, phone")
    .eq("phone", phone)
    .limit(1)
    .returns<CustomerRecord[]>();
}

async function createCustomer({
  name,
  phone,
}: {
  name: string | null;
  phone: string;
}) {
  return supabase
    .from("customers")
    .insert({
      name,
      phone,
    })
    .select("id, name, phone")
    .single<CustomerRecord>();
}

async function findOpenWhatsAppCase(customerId: string | number, phone: string) {
  const phoneCaseResult = await supabase
    .from("cases")
    .select("id, customer_id, area, category, channel, contact_type, status")
    .eq("contact_phone", phone)
    .neq("status", "CLOSED")
    .or("channel.eq.WHATSAPP,contact_type.eq.WHATSAPP")
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<CaseRecord[]>();

  if (phoneCaseResult.error || phoneCaseResult.data?.[0]) {
    return phoneCaseResult;
  }

  return supabase
    .from("cases")
    .select("id, customer_id, area, category, channel, contact_type, status")
    .eq("customer_id", customerId)
    .neq("status", "CLOSED")
    .or("channel.eq.WHATSAPP,contact_type.eq.WHATSAPP")
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<CaseRecord[]>();
}

async function createWhatsAppCase({
  customerId,
  contactName,
  contactPhone,
  message,
}: {
  customerId: string | number;
  contactName: string | null;
  contactPhone: string;
  message: string;
}) {
  const caseNumber = await generateNextCaseNumber();

  return supabase
    .from("cases")
    .insert({
      case_number: caseNumber,
      customer_id: customerId,
      contact_name: contactName,
      contact_phone: contactPhone,
      subject: buildSubject(message),
      channel: "WHATSAPP",
      contact_type: "WHATSAPP",
      status: "AI_HANDLING",
      lifecycle_status: "NEW",
      routing_status: "AI_HANDLING",
      updated_at: new Date().toISOString(),
    })
    .select("id, customer_id, area, category, channel, contact_type, status")
    .single<CaseRecord>();
}

async function insertInboundMessage({
  caseId,
  body,
  externalMessageId,
  media,
}: {
  caseId: string | number;
  body: string;
  externalMessageId: string;
  media?: WhatsAppInboundMediaPayload | null;
}) {
  return supabase
    .from("messages")
    .insert({
      case_id: caseId,
      direction: "INBOUND",
      sender_type: "CUSTOMER",
      body,
      external_message_id: externalMessageId,
      channel: "WHATSAPP",
      message_type: media ? "MEDIA" : "TEXT",
      has_media: Boolean(media),
      media_type: media?.type ?? null,
      delivery_status: "DELIVERED",
    })
    .select("id")
    .single<{ id: string | number }>();
}

function getMediaBody(media: WhatsAppInboundMediaPayload | null, message: string) {
  if (!media) return message;
  if (media.caption?.trim()) return media.caption.trim();
  if (media.type === "image") return "[Imagen]";
  if (media.type === "audio" || media.type === "voice") return "[Audio]";
  if (media.type === "document") return "[Documento]";
  if (media.type === "sticker") return "[Sticker]";
  if (media.type === "video") return "[Video]";

  return "[Archivo]";
}

async function saveInboundMedia({
  caseId,
  messageId,
  media,
}: {
  caseId: string | number;
  messageId: string | number;
  media: WhatsAppInboundMediaPayload;
}) {
  try {
    const downloadedMedia = await downloadWhatsappMedia(media.id);

    await saveWhatsappMediaAttachment({
      caseId,
      messageId,
      whatsappMediaId: media.id,
      mediaType: media.voice ? "voice" : media.type,
      mimeType: media.mimeType ?? downloadedMedia.mimeType,
      filename: media.filename,
      caption: media.caption,
      sha256: media.sha256,
      content: downloadedMedia.content,
    });

    logInbound("media WhatsApp guardada", {
      caseId,
      messageId,
      whatsappMediaId: media.id,
      mediaType: media.type,
    });
  } catch (error) {
    console.error("[whatsapp-inbound] Error saving WhatsApp media", {
      caseId,
      messageId,
      whatsappMediaId: media.id,
      mediaType: media.type,
      message: getErrorMessage(error),
      error,
    });
  }
}

export async function processWhatsAppInbound(
  payload: WhatsAppInboundPayload,
): Promise<WhatsAppInboundResult> {
  if (!isWhatsAppInboundPayload(payload)) {
    return {
      ok: false,
      status: 400,
      error:
        "from, message y externalMessageId son requeridos. name debe ser string si se envía.",
    };
  }

  const phone = payload.from.trim();
  const name = payload.name?.trim() || null;
  const media = payload.media ?? null;
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const externalMessageId = payload.externalMessageId.trim();
  const body = getMediaBody(media ?? null, message);

  logInbound("inicio inbound", {
    from: phone,
    name,
    externalMessageId,
    messagePreview: body.slice(0, 160),
    hasMedia: Boolean(media),
    mediaType: media?.type ?? null,
  });

  const { data: duplicateMessages, error: duplicateError } =
    await findMessageByExternalId(externalMessageId);

  if (duplicateError) {
    logSupabaseError("Error checking duplicate message", duplicateError);

    return { ok: false, status: 500, error: duplicateError.message };
  }

  if (duplicateMessages?.[0]?.case_id) {
    logInbound("mensaje duplicado detectado", {
      externalMessageId,
      caseId: duplicateMessages[0].case_id,
    });

    const { data: duplicateCaseData, error: duplicateCaseError } =
      await findCaseById(duplicateMessages[0].case_id);

    if (duplicateCaseError) {
      logSupabaseError("Error loading duplicate case", duplicateCaseError);

      return { ok: false, status: 500, error: duplicateCaseError.message };
    }

    const duplicateCase = duplicateCaseData?.[0];

    return {
      ok: true,
      caseId: duplicateMessages[0].case_id,
      customerId: duplicateCase?.customer_id ?? null,
    };
  }

  const { data: customers, error: customerLookupError } =
    await findCustomerByPhone(phone);

  if (customerLookupError) {
    logSupabaseError("Error looking up customer", customerLookupError);

    return { ok: false, status: 500, error: customerLookupError.message };
  }

  let customer = customers?.[0] ?? null;

  if (!customer) {
    const { data: createdCustomer, error: createCustomerError } =
      await createCustomer({ name, phone });

    if (createCustomerError || !createdCustomer) {
      logSupabaseError(
        "Error creating customer",
        createCustomerError ?? "No customer returned",
      );

      return {
        ok: false,
        status: 500,
        error: createCustomerError?.message ?? "No se pudo crear customer.",
      };
    }

    customer = createdCustomer;
    logInbound("customer creado", {
      customerId: customer.id,
      phone,
    });
  } else {
    logInbound("customer encontrado", {
      customerId: customer.id,
      phone,
    });
  }

  const { data: openCases, error: openCaseError } = await findOpenWhatsAppCase(
    customer.id,
    phone,
  );

  if (openCaseError) {
    logSupabaseError("Error looking up open WhatsApp case", openCaseError);

    return { ok: false, status: 500, error: openCaseError.message };
  }

  let caseItem = openCases?.[0] ?? null;

  if (!caseItem) {
    const { data: createdCase, error: createCaseError } =
      await createWhatsAppCase({
        customerId: customer.id,
        contactName: name ?? customer.name,
        contactPhone: phone,
        message: body,
      });

    if (createCaseError || !createdCase) {
      logSupabaseError(
        "Error creating WhatsApp case",
        createCaseError ?? "No case returned",
      );

      return {
        ok: false,
        status: 500,
        error: createCaseError?.message ?? "No se pudo crear case.",
      };
    }

    caseItem = createdCase;
    logInbound("caseId creado", {
      caseId: caseItem.id,
      customerId: customer.id,
    });
  } else {
    logInbound("caseId encontrado", {
      caseId: caseItem.id,
      customerId: customer.id,
      status: caseItem.status,
    });
  }

  const { data: insertedMessage, error: insertMessageError } = await insertInboundMessage({
    caseId: caseItem.id,
    body,
    externalMessageId,
    media,
  });

  if (insertMessageError || !insertedMessage?.id) {
    logSupabaseError("Error inserting inbound WhatsApp message", insertMessageError);

    return {
      ok: false,
      status: 500,
      error: insertMessageError?.message ?? "No se pudo crear mensaje WhatsApp.",
    };
  }

  logInbound("mensaje customer insertado", {
    caseId: caseItem.id,
    externalMessageId,
  });

  if (media) {
    await saveInboundMedia({
      caseId: caseItem.id,
      messageId: insertedMessage.id,
      media,
    });
  }

  const { error: updateActivityError } = await supabase
    .from("cases")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseItem.id);

  if (updateActivityError) {
    logSupabaseError("Error updating case activity after inbound", updateActivityError);
  }

  if (media) {
    const { error: mediaUpdateError } = await supabase
      .from("cases")
      .update({
        status: "HUMAN_REQUIRED",
        routing_status: "HUMAN_REQUIRED",
        lifecycle_status: "IN_PROGRESS",
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseItem.id);

    if (mediaUpdateError) {
      logSupabaseError("Error marking media case as HUMAN_REQUIRED", mediaUpdateError);
    }

    logInbound("triage multimedia omitido", {
      caseId: caseItem.id,
      reason: "media requiere revisión humana",
    });

    return {
      ok: true,
      caseId: caseItem.id,
      customerId: customer.id,
    };
  }

  logInbound("inicio triage", {
    caseId: caseItem.id,
  });

  const triageResult = await runAiTriage(String(caseItem.id));

  if (triageResult.status === "error") {
    console.error("[whatsapp-inbound] AI triage error", {
      message: triageResult.reason,
      triageError: triageResult.error,
    });
  } else if (triageResult.status === "completed") {
    logInbound("resultado triage", {
      caseId: caseItem.id,
      aiResolution: triageResult.aiResolution,
      classification: triageResult.classification,
    });
  } else {
    logInbound("triage omitido", {
      caseId: caseItem.id,
      reason: triageResult.reason,
    });
  }

  return {
    ok: true,
    caseId: caseItem.id,
    customerId: customer.id,
  };
}
