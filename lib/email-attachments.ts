import { supabase } from "./supabase";

export type EmailAttachmentInput = {
  caseId: string | number;
  messageId: string | number;
  emailMessageId: string;
  filename: string;
  mimeType?: string | null;
  content: Buffer;
  source?: string;
};

const bucketName = "email-attachments";

function sanitizeFilename(filename: string) {
  return filename.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 160) || "attachment";
}

export function formatAttachmentSize(sizeBytes: number | null | undefined) {
  if (!sizeBytes || sizeBytes <= 0) return "Sin tamaño";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function saveEmailAttachment({
  caseId,
  messageId,
  emailMessageId,
  filename,
  mimeType,
  content,
  source = "EMAIL",
}: EmailAttachmentInput) {
  const safeFilename = sanitizeFilename(filename);
  const storagePath = `cases/${caseId}/emails/${emailMessageId}/${Date.now()}-${safeFilename}`;
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, content, {
      contentType: mimeType || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabase
    .from("message_attachments")
    .insert({
      message_id: messageId,
      case_id: caseId,
      filename: safeFilename,
      mime_type: mimeType,
      size_bytes: content.byteLength,
      storage_bucket: bucketName,
      storage_path: storagePath,
      source,
    })
    .select("id, message_id, case_id, filename, mime_type, size_bytes, storage_bucket, storage_path, source, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
