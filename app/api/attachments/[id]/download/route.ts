import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type AttachmentRecord = {
  id: string;
  storage_bucket: string | null;
  storage_path: string | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data: emailAttachment, error: emailAttachmentError } = await supabase
    .from("message_attachments")
    .select("id, storage_bucket, storage_path")
    .eq("id", id)
    .maybeSingle<AttachmentRecord>();
  const { data: whatsappAttachment, error: whatsappAttachmentError } =
    emailAttachment
      ? { data: null, error: null }
      : await supabase
          .from("whatsapp_media_attachments")
          .select("id, storage_bucket, storage_path")
          .eq("id", id)
          .maybeSingle<AttachmentRecord>();
  const attachment = emailAttachment ?? whatsappAttachment;
  const error = emailAttachmentError ?? whatsappAttachmentError;

  if (error || !attachment?.storage_path) {
    console.error("[attachments] Error loading attachment for download", {
      attachmentId: id,
      message: error?.message ?? "No attachment returned",
      supabaseError: error,
    });

    return Response.json(
      { error: error?.message ?? "No se encontró el adjunto." },
      { status: 404 },
    );
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from(attachment.storage_bucket || "email-attachments")
    .createSignedUrl(attachment.storage_path, 60 * 10);

  if (signedUrlError || !data?.signedUrl) {
    console.error("[attachments] Error creating signed URL", {
      attachmentId: id,
      message: signedUrlError?.message ?? "No signed URL returned",
      storageError: signedUrlError,
    });

    return Response.json(
      { error: signedUrlError?.message ?? "No se pudo generar URL de descarga." },
      { status: 500 },
    );
  }

  return Response.redirect(new URL(data.signedUrl, request.url));
}
