import { getCaseWhatsappTarget } from "@/lib/case-whatsapp";
import { supabase } from "@/lib/supabase";
import {
  getWhatsappMediaError,
  inferWhatsappMediaType,
  saveOutboundWhatsappMedia,
  sendWhatsappMediaMessage,
  validateWhatsappMediaFile,
  type WhatsappMediaType,
} from "@/lib/whatsapp-media";

export const runtime = "nodejs";

const allowedMediaTypes = new Set([
  "image",
  "audio",
  "voice",
  "document",
  "sticker",
  "video",
]);

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function normalizeMediaType(value: string, file: File): WhatsappMediaType {
  if (allowedMediaTypes.has(value)) {
    return value as WhatsappMediaType;
  }

  return inferWhatsappMediaType(file);
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error("[whatsapp-send-media] Error parsing form data", {
      message: error instanceof Error ? error.message : String(error),
      error,
    });

    return Response.json({ success: false, error: "FormData inválido." }, { status: 400 });
  }

  const caseId = getFormString(formData, "caseId");
  const caption = getFormString(formData, "caption");
  const needsConversion = getFormString(formData, "needsConversion") === "true";
  const file = formData.get("file");

  if (!caseId) {
    return Response.json({ success: false, error: "caseId es requerido." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return Response.json({ success: false, error: "file es requerido." }, { status: 400 });
  }

  const mediaType = normalizeMediaType(getFormString(formData, "mediaType"), file);
  const validationError = validateWhatsappMediaFile(file, mediaType);

  if (validationError) {
    return Response.json({ success: false, error: validationError }, { status: 400 });
  }

  const target = await getCaseWhatsappTarget(caseId);

  if (!target.ok) {
    return Response.json({ success: false, error: target.error }, { status: 500 });
  }

  if (!target.isWhatsapp || !target.phone) {
    return Response.json(
      { success: false, error: "El caso no tiene WhatsApp o teléfono disponible." },
      { status: 400 },
    );
  }

  try {
    const sendResult = await sendWhatsappMediaMessage({
      phoneNumber: target.phone,
      file,
      mediaType,
      caption,
      needsConversion,
    });

    const body = caption || `[${mediaType}]`;
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        case_id: caseId,
        channel: "WHATSAPP",
        message_type: "MEDIA",
        direction: "OUTBOUND",
        sender_type: "AGENT",
        body,
        has_media: true,
        media_type: mediaType,
        external_message_id: sendResult.metaMessageId,
        delivery_status: "SENT",
      })
      .select("id, case_id, body, sender_type, direction, created_at, channel, message_type, media_type, has_media, external_message_id, delivery_status, delivered_at, read_at, failed_at, failure_reason")
      .single();

    if (messageError || !message?.id) {
      throw messageError ?? new Error("No se pudo registrar mensaje multimedia.");
    }

    const mediaAttachment = await saveOutboundWhatsappMedia({
      caseId,
      messageId: message.id,
      whatsappMediaId: sendResult.whatsappMediaId,
      mediaType,
      file: sendResult.file,
      caption,
    });

    await supabase
      .from("cases")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId);

    return Response.json({
      success: true,
      messageId: message.id,
      message,
      metaMessageId: sendResult.metaMessageId,
      mediaAttachmentId: mediaAttachment.id,
      mediaAttachment,
    });
  } catch (error) {
    const message = getWhatsappMediaError(error);

    console.error("[whatsapp-send-media] Error sending media", {
      caseId,
      mediaType,
      needsConversion,
      filename: file.name,
      message,
      error,
    });

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
