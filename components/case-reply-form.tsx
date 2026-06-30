"use client";

import { hasPermission } from "@/lib/permissions";
import {
  FileText,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
  Sticker,
  ThumbsUp,
  Wand2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { useToast } from "./toast-provider";
import { useDemoRole } from "./use-demo-role";

type AgentReplyResponse = {
  ok?: boolean;
  error?: string;
  whatsappSent?: boolean;
  whatsappError?: string;
};

type MediaReplyResponse = {
  success?: boolean;
  error?: string;
};

type AiSuggestionResponse = {
  ok?: boolean;
  suggestion?: string;
  error?: string;
};

type MediaKind = "image" | "audio" | "document" | "video" | "sticker" | null;
type PopoverKind = "emoji" | "sticker" | "template" | null;

const frequentEmojis = ["😀", "😅", "😂", "😊", "🙌", "👍", "👀", "🙏", "❤️", "🚀", "✅", "❌", "⚠️"];

const templates = [
  {
    label: "Solicitud de antecedentes",
    text: "Para revisar tu solicitud, compártenos el correo asociado, fecha, monto aproximado y comprobante si corresponde. No envíes claves ni códigos.",
  },
  {
    label: "Transferencia en revisión",
    text: "Estamos revisando el estado de tu transferencia. Te avisaremos apenas tengamos una actualización.",
  },
  {
    label: "Cierre cordial",
    text: "Gracias por contactarnos. Si necesitas algo más, quedamos atentos para ayudarte.",
  },
];

const demoStickers = [
  { key: "ok", label: "OK", text: "OK" },
  { key: "gracias", label: "Gracias", text: "Gracias" },
  { key: "revision", label: "En revisión", text: "En revisión" },
];

const maxDemoAudioFileSizeBytes = 5 * 1024 * 1024;
const maxDemoAudioSeconds = 60;
const fileAccept =
  "image/png,image/jpeg,image/webp,audio/ogg,audio/webm,audio/mpeg,audio/mp4,audio/wav,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,video/mp4";

function isMediaReplyResponse(
  payload: AgentReplyResponse | MediaReplyResponse,
): payload is MediaReplyResponse {
  return "success" in payload;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function inferMediaKind(file: File): MediaKind {
  if (file.type.startsWith("image/")) return file.type === "image/webp" ? "sticker" : "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";

  return "document";
}

function isWebmAudio(file: File) {
  return file.type.toLowerCase().split(";")[0]?.trim() === "audio/webm";
}

async function createStickerFile(sticker: { key: string; text: string }) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo crear sticker demo.");
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const brandBlueSoft =
    rootStyles.getPropertyValue("--g66-brand-blue-soft").trim() || "#EAF1FF";
  const brandBlue =
    rootStyles.getPropertyValue("--g66-brand-blue").trim() || "#205EF1";

  context.fillStyle = brandBlueSoft;
  context.fillRect(0, 0, 512, 512);
  context.fillStyle = brandBlue;
  context.font = "bold 58px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(sticker.text, 256, 256, 430);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.92),
  );

  if (!blob) {
    throw new Error("Este navegador no pudo generar sticker WebP.");
  }

  return new File([blob], `${sticker.key}.webp`, { type: "image/webp" });
}

function ToolbarButton({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:bg-[var(--g66-surface-soft)] disabled:text-[var(--g66-text-muted)]"
    >
      {children}
    </button>
  );
}

export function CaseReplyForm({
  caseId,
  compact = false,
}: {
  caseId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { role, isCheckingRole } = useDemoRole();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingCancelledRef = useRef(false);
  const recordingSecondsRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const [body, setBody] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<MediaKind>(null);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedStickerLabel, setSelectedStickerLabel] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const canRespond = hasPermission(role, "respondToCustomers");

  useEffect(
    () => () => {
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  function insertText(text: string) {
    const textarea = textareaRef.current;

    if (!textarea) {
      setBody((current) => `${current}${text}`);
      return;
    }

    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const nextValue = `${body.slice(0, start)}${text}${body.slice(end)}`;

    setBody(nextValue);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  }

  function selectFile(file: File | null, forcedKind?: MediaKind) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setMediaFile(file);
    setMediaKind(file ? forcedKind ?? inferMediaKind(file) : null);
    setAudioDurationSeconds(null);
    const nextPreviewUrl = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setSelectedStickerLabel(null);
    setError(null);
    if (!file && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function selectDemoSticker(sticker: (typeof demoStickers)[number]) {
    try {
      const file = await createStickerFile(sticker);
      selectFile(file, "sticker");
      setSelectedStickerLabel(sticker.label);
      setPopover(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(`✗ ${message}`);
    }
  }

  async function startRecording() {
    if (typeof window === "undefined" || !navigator.mediaDevices || !window.MediaRecorder) {
      toast.error("Grabación de audio no soportada en este navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recordingCancelledRef.current = false;
      recordingSecondsRef.current = 0;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (recordingCancelledRef.current) {
          recordingCancelledRef.current = false;
          chunksRef.current = [];
          return;
        }

        const mimeType = recorder.mimeType?.split(";")[0] || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `nota-voz-${Date.now()}.webm`, {
          type: mimeType,
        });

        selectFile(file, "audio");
        setAudioDurationSeconds(recordingSecondsRef.current);
        recordingSecondsRef.current = 0;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      setRecordingSeconds(0);
      setIsRecording(true);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => {
          const nextSeconds = seconds + 1;
          recordingSecondsRef.current = nextSeconds;

          if (nextSeconds >= maxDemoAudioSeconds) {
            window.setTimeout(stopRecording, 0);
          }

          return nextSeconds;
        });
      }, 1000);
    } catch (error) {
      console.error("[case-reply-form] Error starting audio recording", { error });
      toast.error("No se pudo iniciar la grabación de audio.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }

  function cancelRecording() {
    recordingCancelledRef.current = true;
    recorderRef.current?.stop();
    recorderRef.current = null;
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }

  async function handleAiSuggestion() {
    if (!canRespond || isGeneratingSuggestion) return;

    setIsGeneratingSuggestion(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${caseId}/ai-suggestion`, {
        method: "POST",
      });
      const payload = (await response.json()) as AiSuggestionResponse;

      if (!response.ok || !payload.ok || !payload.suggestion) {
        throw new Error(payload.error || "No se pudo generar sugerencia IA.");
      }

      insertText(payload.suggestion);
      toast.info("ℹ Sugerencia IA insertada");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.error("[case-reply-form] Error generating AI suggestion", {
        caseId,
        message,
        error,
      });
      setError(message);
      toast.error(`✗ ${message}`);
    } finally {
      setIsGeneratingSuggestion(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canRespond) {
      setError("Tu perfil no puede responder clientes.");
      return;
    }

    const trimmedBody = body.trim();

    if (!trimmedBody && !mediaFile) {
      setError("Escribe una respuesta antes de enviar.");
      return;
    }

    if (mediaKind === "audio" && mediaFile) {
      if (mediaFile.size > maxDemoAudioFileSizeBytes) {
        setError("La nota de voz supera el máximo demo de 5 MB.");
        toast.error("✗ La nota de voz supera el máximo demo de 5 MB.");
        return;
      }

      if (audioDurationSeconds && audioDurationSeconds > maxDemoAudioSeconds) {
        setError("La nota de voz supera el máximo demo de 60 segundos.");
        toast.error("✗ La nota de voz supera el máximo demo de 60 segundos.");
        return;
      }
    }

    setIsSending(true);
    setError(null);

    let response: Response;
    let payload: AgentReplyResponse | MediaReplyResponse;

    try {
      if (mediaFile) {
        const formData = new FormData();
        formData.append("caseId", caseId);
        formData.append("file", mediaFile);
        formData.append("caption", trimmedBody);
        if (mediaKind) formData.append("mediaType", mediaKind);
        if (mediaKind === "audio" && isWebmAudio(mediaFile)) {
          formData.append("needsConversion", "true");
        }

        response = await fetch("/api/integrations/whatsapp/send-media", {
          method: "POST",
          body: formData,
        });
        payload = (await response.json()) as MediaReplyResponse;
      } else {
        response = await fetch(`/api/cases/${caseId}/agent-reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmedBody }),
        });
        payload = (await response.json()) as AgentReplyResponse;
      }
    } catch (error) {
      console.error("[case-reply-form] Error calling reply API", {
        message: error instanceof Error ? error.message : String(error),
        error,
      });
      setError("No se pudo enviar la respuesta.");
      toast.error("✗ No se pudo enviar");
      setIsSending(false);
      return;
    }

    const isMediaPayload = isMediaReplyResponse(payload);
    const isOk = isMediaPayload
      ? (payload as MediaReplyResponse).success
      : (payload as AgentReplyResponse).ok;

    if (!response.ok || !isOk) {
      const message = payload.error ?? "No se pudo enviar la respuesta.";
      console.error("[case-reply-form] Error sending message", { message, payload });
      setError(message);
      toast.error(`✗ ${message}`);
      setIsSending(false);
      return;
    }

    setBody("");
    selectFile(null);
    setSelectedStickerLabel(null);
    if (isMediaPayload) {
      toast.success("Archivo enviado por WhatsApp");
    } else {
      const agentPayload = payload as AgentReplyResponse;

      if (agentPayload.whatsappError) {
        setError(`Mensaje guardado, pero WhatsApp falló: ${agentPayload.whatsappError}`);
        toast.error("✗ No se pudo enviar por WhatsApp");
      } else if (agentPayload.whatsappSent) {
        toast.success("Mensaje enviado por WhatsApp");
      } else {
        toast.success("✓ Mensaje enviado correctamente");
      }
    }
    window.dispatchEvent(new CustomEvent("case-whatsapp-notifications-refresh"));
    window.dispatchEvent(new CustomEvent("case-messages-refresh"));
    window.dispatchEvent(new CustomEvent("case-attachments-refresh"));
    setIsSending(false);
    router.refresh();
  }

  const composerDisabled =
    isCheckingRole || !canRespond || isSending || isGeneratingSuggestion;
  const isProcessingAudio = isSending && mediaKind === "audio";
  const canSend =
    !composerDisabled && !isRecording && (body.trim().length > 0 || Boolean(mediaFile));

  const composer = (
    <>
      <textarea
        ref={textareaRef}
        id="case-reply"
        value={body}
        disabled={isCheckingRole || !canRespond}
        onChange={(event) => {
          setBody(event.target.value);
          if (error) setError(null);
        }}
        rows={compact ? 1 : 3}
        placeholder={canRespond ? "Escribe tu mensaje..." : "Tu perfil tiene acceso de solo lectura."}
        className="max-h-28 min-h-11 w-full resize-none rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white px-4 py-3 text-sm leading-5 text-[var(--g66-text-primary)] outline-none transition [field-sizing:content] placeholder:text-[var(--g66-text-muted)] focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:bg-[var(--g66-surface-soft)] disabled:text-[var(--g66-text-secondary)]"
      />

      {mediaFile ? (
        <div className="mt-2 flex items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-[var(--g66-surface-soft)] p-2">
          {mediaKind === "image" && previewUrl ? (
            <span
              role="img"
              aria-label={mediaFile.name}
              className="h-10 w-10 rounded bg-cover bg-center"
              style={{ backgroundImage: `url(${previewUrl})` }}
            />
          ) : mediaKind === "audio" && previewUrl ? (
            <audio
              controls
              src={previewUrl}
              className="h-9 max-w-56"
              onLoadedMetadata={(event) => {
                if (Number.isFinite(event.currentTarget.duration)) {
                  setAudioDurationSeconds(event.currentTarget.duration);
                }
              }}
            />
          ) : mediaKind === "sticker" ? (
            <span className="rounded bg-[var(--g66-brand-blue-soft)] px-2 py-1 text-xs font-bold text-[var(--g66-brand-blue)]">
              {selectedStickerLabel || "Sticker"}
            </span>
          ) : (
            <FileText className="h-5 w-5 text-[var(--g66-accent-cyan)]" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[var(--g66-text-primary)]">{mediaFile.name}</p>
            <p className="truncate text-[11px] font-semibold text-[var(--g66-text-secondary)]">
              {[mediaFile.type || mediaKind, formatFileSize(mediaFile.size)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            title="Quitar adjunto"
            onClick={() => selectFile(null)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {isRecording ? (
        <div className="mt-1 flex items-center gap-2 rounded-md border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-2 text-xs font-bold text-[var(--g66-danger)]">
          Grabando... {recordingSeconds}s
          <button type="button" onClick={stopRecording} className="rounded bg-white px-2 py-1">
            Detener
          </button>
          <button type="button" onClick={cancelRecording} className="rounded bg-white px-2 py-1">
            Cancelar
          </button>
        </div>
      ) : null}

      <div className="relative mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <ToolbarButton label="Emoji" disabled={composerDisabled} onClick={() => setPopover(popover === "emoji" ? null : "emoji")}>
            <Smile className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Sticker" disabled={composerDisabled} onClick={() => setPopover(popover === "sticker" ? null : "sticker")}>
            <Sticker className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <label
            title="Adjuntar archivo"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
          >
            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept={fileAccept}
              disabled={composerDisabled}
              onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <ToolbarButton label="Audio" disabled={composerDisabled} onClick={isRecording ? stopRecording : startRecording}>
            {isRecording ? <Square className="h-3.5 w-3.5" aria-hidden="true" /> : <Mic className="h-3.5 w-3.5" aria-hidden="true" />}
          </ToolbarButton>
          <ToolbarButton label="Plantilla" disabled={composerDisabled} onClick={() => setPopover(popover === "template" ? null : "template")}>
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label={isGeneratingSuggestion ? "Generando sugerencia IA" : "Sugerencia IA"}
            disabled={composerDisabled}
            onClick={handleAiSuggestion}
          >
            <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Like rápido" disabled={composerDisabled} onClick={() => insertText("👍")}>
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
        </div>
        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-[var(--g66-brand-blue)] px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgb(32_94_241/0.22)] transition hover:bg-[var(--g66-brand-blue-hover)] disabled:cursor-not-allowed disabled:border-[var(--g66-border)] disabled:bg-[var(--g66-border)] disabled:text-[var(--g66-text-muted)] disabled:shadow-none"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          {isProcessingAudio ? "Procesando audio..." : isSending ? "Enviando..." : "Enviar"}
        </button>

        {popover ? (
          <div className="absolute bottom-11 left-0 z-20 w-72 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white p-2 shadow-[var(--g66-shadow-soft)]">
            {popover === "emoji" ? (
              <div className="grid grid-cols-7 gap-1">
                {frequentEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insertText(emoji);
                      setPopover(null);
                    }}
                    className="h-8 rounded text-lg hover:bg-[var(--g66-background)]"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
            {popover === "sticker" ? (
              <div className="grid gap-1">
                {demoStickers.map((sticker) => (
                  <button
                    key={sticker.key}
                    type="button"
                    onClick={() => void selectDemoSticker(sticker)}
                    className="rounded border border-[var(--g66-border)] px-2 py-2 text-left text-xs font-bold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-background)]"
                  >
                    {sticker.label}
                  </button>
                ))}
              </div>
            ) : null}
            {popover === "template" ? (
              <div className="grid gap-1">
                {templates.map((template) => (
                  <button
                    key={template.label}
                    type="button"
                    onClick={() => {
                      insertText(template.text);
                      setPopover(null);
                    }}
                    className="rounded border border-[var(--g66-border)] px-2 py-2 text-left hover:bg-[var(--g66-background)]"
                  >
                    <span className="block text-xs font-bold text-[var(--g66-brand-blue)]">{template.label}</span>
                    <span className="block text-[11px] font-semibold text-[var(--g66-text-secondary)]">{template.text}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? "bg-white px-3 py-2"
          : "border-t border-[var(--g66-border)] bg-white p-4 sm:p-6"
      }
    >
      <label htmlFor="case-reply" className="sr-only">
        Responder como agente
      </label>
      {composer}
      {error ? <p className="mt-1 truncate text-xs text-[var(--g66-danger)]">{error}</p> : null}
    </form>
  );
}
