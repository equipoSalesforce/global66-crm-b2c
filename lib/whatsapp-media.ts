import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { access, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import { supabase } from "./supabase";

export type WhatsappMediaType =
  | "image"
  | "audio"
  | "voice"
  | "document"
  | "sticker"
  | "video";

type SaveWhatsappMediaInput = {
  caseId: string | number;
  messageId: string | number;
  whatsappMediaId: string;
  mediaType: WhatsappMediaType;
  mimeType?: string | null;
  filename?: string | null;
  caption?: string | null;
  sha256?: string | null;
  content: Buffer;
};

type SendWhatsappMediaInput = {
  phoneNumber: string;
  file: File;
  mediaType: WhatsappMediaType;
  caption?: string | null;
  needsConversion?: boolean;
};

const bucketName = "whatsapp-media";
const maxFileSizeBytes = 10 * 1024 * 1024;
const maxDemoAudioFileSizeBytes = 5 * 1024 * 1024;

const allowedMimeTypes: Record<WhatsappMediaType, string[]> = {
  image: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
  audio: ["audio/ogg", "audio/webm", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "audio/x-m4a"],
  voice: ["audio/ogg", "audio/webm", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "audio/x-m4a"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ],
  sticker: ["image/webp"],
  video: ["video/mp4"],
};

export function normalizeWhatsappMimeType(mimeType: string | null | undefined) {
  return (mimeType || "").toLowerCase().split(";")[0]?.trim() || "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getAccessToken() {
  return process.env.WHATSAPP_ACCESS_TOKEN;
}

function getPhoneNumberId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID;
}

export function inferWhatsappMediaType(file: File): WhatsappMediaType {
  const type = normalizeWhatsappMimeType(file.type);

  if (type.startsWith("image/")) return type === "image/webp" ? "sticker" : "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";

  return "document";
}

export function validateWhatsappMediaFile(file: File, mediaType: WhatsappMediaType) {
  if (file.size > maxFileSizeBytes) {
    return "El archivo supera el máximo permitido de 10 MB.";
  }

  const allowedTypes = allowedMimeTypes[mediaType] ?? [];
  const normalizedMimeType = normalizeWhatsappMimeType(file.type);

  if (!allowedTypes.includes(normalizedMimeType)) {
    return `Tipo de archivo no permitido para ${mediaType}: ${file.type || "sin MIME"}.`;
  }

  return null;
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 160) || "whatsapp-media";
}

function extensionFromMimeType(mimeType?: string | null) {
  const normalizedMimeType = normalizeWhatsappMimeType(mimeType);

  if (!normalizedMimeType) return "bin";
  if (normalizedMimeType.includes("jpeg")) return "jpg";
  if (normalizedMimeType.includes("png")) return "png";
  if (normalizedMimeType.includes("webp")) return "webp";
  if (normalizedMimeType.includes("ogg")) return "ogg";
  if (normalizedMimeType.includes("webm")) return "webm";
  if (normalizedMimeType.includes("mpeg")) return "mp3";
  if (normalizedMimeType.includes("mp4")) return "mp4";
  if (normalizedMimeType.includes("pdf")) return "pdf";
  if (normalizedMimeType.includes("plain")) return "txt";

  return "bin";
}

function getMetaMessageId(response: unknown) {
  if (!response || typeof response !== "object") return null;

  const responseObject = response as {
    messages?: Array<{
      id?: unknown;
    }>;
  };
  const messageId = responseObject.messages?.[0]?.id;

  return typeof messageId === "string" && messageId.trim() ? messageId.trim() : null;
}

function ensureFilenameExtension(filename: string, mimeType: string) {
  const safeFilename = sanitizeFilename(filename);

  if (/\.[a-z0-9]{2,5}$/i.test(safeFilename)) return safeFilename;

  return `${safeFilename}.${extensionFromMimeType(mimeType)}`;
}

async function normalizeFileForWhatsapp(file: File) {
  const normalizedMimeType = normalizeWhatsappMimeType(file.type);
  const filename = ensureFilenameExtension(file.name || "whatsapp-media", normalizedMimeType);

  if (normalizedMimeType === file.type && filename === file.name) {
    return file;
  }

  return new File([await file.arrayBuffer()], filename, {
    type: normalizedMimeType || file.type || "application/octet-stream",
  });
}

function isWebmAudio(file: File) {
  return normalizeWhatsappMimeType(file.type) === "audio/webm";
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getFileSize(filePath: string) {
  try {
    const fileStat = await stat(filePath);
    return fileStat.size;
  } catch {
    return null;
  }
}

async function resolveFfmpegPath() {
  console.log("[whatsapp-media] ffmpeg path resolved", { ffmpegPath });

  if (!ffmpegPath) {
    console.error("[whatsapp-media] ffmpeg-static returned empty path");
    throw new Error("No se encontró ffmpeg para procesar audio.");
  }

  if (!(await fileExists(ffmpegPath))) {
    console.error("[whatsapp-media] ffmpeg binary not found", { ffmpegPath });
    throw new Error("No se encontró ffmpeg para procesar audio.");
  }

  return ffmpegPath;
}

async function runFfmpeg(args: string[]) {
  const resolvedFfmpegPath = await resolveFfmpegPath();

  return new Promise<void>((resolve, reject) => {
    const ffmpegProcess = spawn(resolvedFfmpegPath, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    const timeout = setTimeout(() => {
      ffmpegProcess.kill("SIGKILL");
      reject(new Error("La conversión de audio excedió el tiempo máximo."));
    }, 20_000);

    ffmpegProcess.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    ffmpegProcess.on("error", (error) => {
      clearTimeout(timeout);
      if ("code" in error && error.code === "ENOENT") {
        reject(new Error("No se encontró ffmpeg para procesar audio."));
        return;
      }

      reject(error);
    });
    ffmpegProcess.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `ffmpeg terminó con código ${code}`));
      }
    });
  });
}

async function convertWebmAudioToOgg(file: File) {
  const id = randomUUID();
  const inputPath = path.join(tmpdir(), `${id}.webm`);
  const outputPath = path.join(tmpdir(), `${id}.ogg`);
  const outputFilename = file.name.replace(/\.[^.]+$/i, "") || `nota-voz-${id}`;

  try {
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
    console.log("[whatsapp-media] input exists", {
      inputPath,
      exists: await fileExists(inputPath),
      sizeBytes: await getFileSize(inputPath),
    });
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-c:a",
      "libopus",
      "-b:a",
      "32k",
      outputPath,
    ]);
    console.log("[whatsapp-media] output exists", {
      outputPath,
      exists: await fileExists(outputPath),
      sizeBytes: await getFileSize(outputPath),
    });

    const convertedAudio = await readFile(outputPath);

    return new File([convertedAudio], `${outputFilename}.ogg`, {
      type: "audio/ogg",
    });
  } finally {
    await Promise.all([
      rm(inputPath, { force: true }).catch(() => undefined),
      rm(outputPath, { force: true }).catch(() => undefined),
    ]);
  }
}

async function prepareMediaFileForMeta({
  file,
  mediaType,
  needsConversion,
}: {
  file: File;
  mediaType: WhatsappMediaType;
  needsConversion?: boolean;
}) {
  const normalizedFile = await normalizeFileForWhatsapp(file);

  if (mediaType === "audio" && normalizedFile.size > maxDemoAudioFileSizeBytes) {
    throw new Error("La nota de voz supera el máximo demo de 5 MB.");
  }

  if (mediaType === "audio" && (needsConversion || isWebmAudio(normalizedFile))) {
    try {
      return await convertWebmAudioToOgg(normalizedFile);
    } catch (error) {
      console.error("[whatsapp-media] Error converting WebM audio", {
        message: getErrorMessage(error),
        error,
      });
      throw new Error(
        "No pudimos procesar la nota de voz. Intenta nuevamente o adjunta un .ogg/.mp3.",
      );
    }
  }

  return normalizedFile;
}

async function uploadToStorage({
  caseId,
  messageId,
  filename,
  mimeType,
  content,
}: {
  caseId: string | number;
  messageId: string | number;
  filename: string;
  mimeType?: string | null;
  content: Buffer;
}) {
  const safeFilename = sanitizeFilename(filename);
  const storagePath = `cases/${caseId}/whatsapp/${messageId}/${Date.now()}-${safeFilename}`;
  const { error } = await supabase.storage.from(bucketName).upload(storagePath, content, {
    contentType: mimeType || "application/octet-stream",
    upsert: true,
  });

  if (error) throw error;

  return {
    safeFilename,
    storagePath,
  };
}

export async function downloadWhatsappMedia(whatsappMediaId: string) {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN no está configurada.");
  }

  const metadataResponse = await fetch(
    `https://graph.facebook.com/v25.0/${whatsappMediaId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  const metadata = (await metadataResponse.json().catch(() => null)) as {
    url?: string;
    mime_type?: string;
    file_size?: number;
  } | null;

  if (!metadataResponse.ok || !metadata?.url) {
    throw new Error(
      `No se pudo obtener metadata de media WhatsApp: ${metadataResponse.status}`,
    );
  }

  const mediaResponse = await fetch(metadata.url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!mediaResponse.ok) {
    throw new Error(`No se pudo descargar media WhatsApp: ${mediaResponse.status}`);
  }

  const arrayBuffer = await mediaResponse.arrayBuffer();

  return {
    content: Buffer.from(arrayBuffer),
    mimeType: metadata.mime_type || mediaResponse.headers.get("content-type"),
    sizeBytes: metadata.file_size ?? arrayBuffer.byteLength,
  };
}

export async function saveWhatsappMediaAttachment(input: SaveWhatsappMediaInput) {
  const filename =
    input.filename ||
    `${input.mediaType}-${input.whatsappMediaId}.${extensionFromMimeType(input.mimeType)}`;
  const { safeFilename, storagePath } = await uploadToStorage({
    caseId: input.caseId,
    messageId: input.messageId,
    filename,
    mimeType: input.mimeType,
    content: input.content,
  });

  const { data, error } = await supabase
    .from("whatsapp_media_attachments")
    .insert({
      message_id: input.messageId,
      case_id: input.caseId,
      whatsapp_media_id: input.whatsappMediaId,
      media_type: input.mediaType,
      mime_type: input.mimeType,
      filename: safeFilename,
      caption: input.caption,
      sha256: input.sha256,
      size_bytes: input.content.byteLength,
      storage_bucket: bucketName,
      storage_path: storagePath,
    })
    .select("id, message_id, case_id, whatsapp_media_id, media_type, mime_type, filename, caption, sha256, size_bytes, storage_bucket, storage_path, public_url, created_at")
    .single();

  if (error) throw error;

  return data;
}

async function uploadMediaToMeta(file: File) {
  const accessToken = getAccessToken();
  const phoneNumberId = getPhoneNumberId();

  if (!accessToken || !phoneNumberId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID no está configurada.");
  }

  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("file", file);

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    },
  );
  const body = (await response.json().catch(() => null)) as { id?: string } | null;

  if (!response.ok || !body?.id) {
    throw new Error(`Meta rechazó la subida de media: ${response.status}`);
  }

  return body.id;
}

export async function sendWhatsappMediaMessage({
  phoneNumber,
  file,
  mediaType,
  caption,
  needsConversion,
}: SendWhatsappMediaInput) {
  const accessToken = getAccessToken();
  const phoneNumberId = getPhoneNumberId();
  const phone = phoneNumber.trim();

  if (!accessToken || !phoneNumberId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID no está configurada.");
  }

  if (!phone) {
    throw new Error("No existe teléfono WhatsApp para enviar media.");
  }

  const validationError = validateWhatsappMediaFile(file, mediaType);

  if (validationError) {
    throw new Error(validationError);
  }

  const normalizedFile = await prepareMediaFileForMeta({
    file,
    mediaType,
    needsConversion,
  });
  let mediaId: string;

  try {
    mediaId = await uploadMediaToMeta(normalizedFile);
  } catch (error) {
    if (mediaType === "audio" && isWebmAudio(normalizedFile)) {
      throw new Error("WhatsApp no acepta este formato de audio. Usa ogg/mp3.");
    }

    throw error;
  }
  const payloadMediaType = mediaType === "voice" ? "audio" : mediaType;
  const mediaPayload: Record<string, unknown> = {
    id: mediaId,
  };

  if (normalizedFile.name && payloadMediaType === "document") {
    mediaPayload.filename = sanitizeFilename(normalizedFile.name);
  }

  if (caption && ["image", "document", "video"].includes(payloadMediaType)) {
    mediaPayload.caption = caption;
  }

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: payloadMediaType,
        [payloadMediaType]: mediaPayload,
      }),
    },
  );
  const responseBody = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    if (mediaType === "audio" && isWebmAudio(normalizedFile)) {
      throw new Error("WhatsApp no acepta este formato de audio. Usa ogg/mp3.");
    }

    throw new Error(`Meta rechazó el envío de media: ${response.status}`);
  }

  const metaMessageId = getMetaMessageId(responseBody);

  if (!metaMessageId) {
    throw new Error("Meta no devolvió message_id válido para media.");
  }

  return {
    whatsappMediaId: mediaId,
    metaMessageId,
    metaResponse: responseBody,
    file: normalizedFile,
  };
}

export async function saveOutboundWhatsappMedia({
  caseId,
  messageId,
  whatsappMediaId,
  mediaType,
  file,
  caption,
}: {
  caseId: string | number;
  messageId: string | number;
  whatsappMediaId: string;
  mediaType: WhatsappMediaType;
  file: File;
  caption?: string | null;
}) {
  const normalizedFile = await normalizeFileForWhatsapp(file);
  const content = Buffer.from(await normalizedFile.arrayBuffer());

  return saveWhatsappMediaAttachment({
    caseId,
    messageId,
    whatsappMediaId,
    mediaType,
    mimeType: normalizeWhatsappMimeType(normalizedFile.type),
    filename: normalizedFile.name,
    caption,
    content,
  });
}

export function getWhatsappMediaError(error: unknown) {
  return getErrorMessage(error);
}
