import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [emailAttachmentsResult, whatsappMediaResult] = await Promise.all([
    supabase
    .from("message_attachments")
    .select("id, message_id, case_id, filename, mime_type, size_bytes, storage_bucket, storage_path, source, created_at")
    .eq("case_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("whatsapp_media_attachments")
      .select("id, message_id, case_id, filename, mime_type, size_bytes, storage_bucket, storage_path, created_at, media_type, caption, whatsapp_media_id")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (emailAttachmentsResult.error || whatsappMediaResult.error) {
    const error = emailAttachmentsResult.error ?? whatsappMediaResult.error;

    console.error("[attachments] Error loading case attachments", {
      caseId: id,
      message: error?.message,
      supabaseError: error,
    });

    return Response.json(
      { ok: false, error: error?.message ?? "No se pudieron cargar adjuntos." },
      { status: 500 },
    );
  }

  const emailAttachments = (emailAttachmentsResult.data ?? []).map((attachment) => ({
    ...attachment,
    media_type: null,
    caption: null,
  }));
  const whatsappAttachments = (whatsappMediaResult.data ?? []).map((attachment) => ({
    ...attachment,
    source: "WHATSAPP",
  }));
  const attachments = [...emailAttachments, ...whatsappAttachments].sort(
    (left, right) =>
      new Date(right.created_at ?? 0).getTime() -
      new Date(left.created_at ?? 0).getTime(),
  );

  return Response.json({
    ok: true,
    attachments,
  });
}
