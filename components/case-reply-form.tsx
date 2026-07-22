"use client";

import { hasPermission } from "@/lib/permissions";
import {
  defaultChatSettings,
  type CrmQuickMessage,
  type CrmUserChatSettings,
} from "@/lib/whatsapp-chat-types";
import {
  Clock3,
  Expand,
  FileText,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Settings,
  Wand2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
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
  customerReply?: string;
  agentSummary?: string;
  nextActions?: string[];
  sources?: Array<{ title: string; source: string; version: string; metadata: Record<string, string | null> }>;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  missingInfo?: string[];
  warnings?: string[];
  error?: string;
};

type MediaKind = "image" | "audio" | "document" | "video" | "sticker" | null;
type PopoverKind = "quick-messages" | "snooze" | null;

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

function ColorSettingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_34px_92px] items-center gap-2 text-xs text-[var(--g66-text-secondary)]">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-8 w-8 cursor-pointer rounded border border-[var(--g66-border)] bg-white p-0.5" />
      <input value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} maxLength={7} className="h-8 rounded-lg border border-[var(--g66-border)] px-2 font-mono text-xs uppercase outline-none focus:border-[var(--g66-brand-blue)]" />
    </label>
  );
}

export function CaseReplyForm({
  caseId,
  compact = false,
  onToggleSearch,
  onToggleExpanded,
  onRefresh,
  isExpanded = false,
}: {
  caseId: string;
  compact?: boolean;
  onToggleSearch?: () => void;
  onToggleExpanded?: () => void;
  onRefresh?: () => Promise<void> | void;
  isExpanded?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { role, isCheckingRole } = useDemoRole();
  const formRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [body, setBody] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<MediaKind>(null);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverKind>(null);
  const [quickMessages, setQuickMessages] = useState<CrmQuickMessage[]>([]);
  const [isLoadingQuickMessages, setIsLoadingQuickMessages] = useState(false);
  const [chatSettings, setChatSettings] = useState<CrmUserChatSettings>(defaultChatSettings);
  const [settingsDraft, setSettingsDraft] = useState<CrmUserChatSettings>(defaultChatSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const canRespond = hasPermission(role, "respondToCustomers");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/chat/settings", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as {
          settings?: CrmUserChatSettings;
          error?: string;
        };
        if (!response.ok || !payload.settings) {
          throw new Error(payload.error || "No se pudo cargar la configuración.");
        }
        setChatSettings(payload.settings);
        setSettingsDraft(payload.settings);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("[case-reply-form] Error loading chat settings", error);
      });

    return () => {
      controller.abort();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

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
    setError(null);
    if (!file && fileInputRef.current) {
      fileInputRef.current.value = "";
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
      window.dispatchEvent(new CustomEvent("case-ai-knowledge-suggestion", {
        detail: { caseId, ...payload },
      }));
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

  async function openQuickMessages() {
    const nextPopover = popover === "quick-messages" ? null : "quick-messages";
    setPopover(nextPopover);
    if (!nextPopover || quickMessages.length > 0 || isLoadingQuickMessages) return;

    setIsLoadingQuickMessages(true);
    try {
      const response = await fetch("/api/chat/quick-messages", { cache: "no-store" });
      const payload = (await response.json()) as {
        messages?: CrmQuickMessage[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "No se pudieron cargar los mensajes rápidos.");
      setQuickMessages(payload.messages ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los mensajes rápidos.");
      setPopover(null);
    } finally {
      setIsLoadingQuickMessages(false);
    }
  }

  function selectSnooze(minutes: number) {
    setPopover(null);
    toast.info(`Snooze seleccionado: ${minutes} minutos`);
  }

  async function refreshConversation() {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
      router.refresh();
      toast.success("Actualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la conversación.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function saveChatSettings() {
    setIsSavingSettings(true);
    try {
      const response = await fetch("/api/chat/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsDraft),
      });
      const payload = (await response.json()) as {
        settings?: CrmUserChatSettings;
        error?: string;
      };
      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || "No se pudo guardar la configuración.");
      }
      setChatSettings(payload.settings);
      setSettingsDraft(payload.settings);
      setIsSettingsOpen(false);
      toast.success("Configuración guardada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!chatSettings.enter_to_send || event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!composerDisabled && (body.trim() || mediaFile)) {
      formRef.current?.requestSubmit();
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
    !composerDisabled && (body.trim().length > 0 || Boolean(mediaFile));

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
        onKeyDown={handleComposerKeyDown}
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
              Sticker
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

      <div className="relative mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <ToolbarButton label="Mensajes Rápidos" disabled={composerDisabled} onClick={() => void openQuickMessages()}>
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label={isGeneratingSuggestion ? "Generando sugerencia IA" : "Sugerencia IA"}
            disabled={composerDisabled}
            onClick={handleAiSuggestion}
          >
            <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <label
            title="Adjuntar"
            aria-label="Adjuntar"
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
          <ToolbarButton label="Snooze" disabled={composerDisabled} onClick={() => setPopover(popover === "snooze" ? null : "snooze")}>
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Buscar" onClick={() => onToggleSearch?.()}>
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label={isExpanded ? "Cerrar ventana ampliada" : "Abrir ventana"} onClick={() => onToggleExpanded?.()}>
            <Expand className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Configuración" onClick={() => { setSettingsDraft(chatSettings); setPopover(null); setIsSettingsOpen(true); }}>
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Actualizar" disabled={isRefreshing} onClick={() => void refreshConversation()}>
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
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
            {popover === "quick-messages" ? (
              <div className="grid max-h-64 gap-1 overflow-y-auto">
                {isLoadingQuickMessages ? (
                  <p className="px-2 py-3 text-xs text-[var(--g66-text-secondary)]">Cargando mensajes rápidos...</p>
                ) : quickMessages.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-[var(--g66-text-secondary)]">No hay mensajes rápidos activos.</p>
                ) : quickMessages.map((message) => (
                  <button key={message.id} type="button" onClick={() => { insertText(message.content); setPopover(null); }} className="rounded border border-[var(--g66-border)] px-2 py-2 text-left hover:bg-[var(--g66-background)]">
                    <span className="block text-xs font-bold text-[var(--g66-brand-blue)]">{message.title}</span>
                    <span className="line-clamp-2 block text-[11px] font-semibold text-[var(--g66-text-secondary)]">{message.content}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {popover === "snooze" ? (
              <div className="grid gap-1">
                {[10, 20, 30].map((minutes) => (
                  <button key={minutes} type="button" onClick={() => selectSnooze(minutes)} className="rounded border border-[var(--g66-border)] px-3 py-2 text-left text-xs font-semibold text-[var(--g66-text-primary)] hover:bg-[var(--g66-background)]">
                    {minutes} minutos
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
    <>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={compact ? "bg-white px-3 py-2" : "border-t border-[var(--g66-border)] bg-white p-4 sm:p-6"}
      >
        <label htmlFor="case-reply" className="sr-only">Responder como agente</label>
        {composer}
        {error ? <p className="mt-1 truncate text-xs text-[var(--g66-danger)]">{error}</p> : null}
      </form>

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="chat-settings-title">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--g66-border)] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--g66-border)] px-5 py-4">
              <h2 id="chat-settings-title" className="text-base font-bold text-[var(--g66-text-primary)]">Configuración</h2>
              <button type="button" onClick={() => setIsSettingsOpen(false)} aria-label="Cerrar configuración" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)]">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
              <details open className="rounded-xl border border-[var(--g66-border)] p-4">
                <summary className="cursor-pointer text-sm font-bold text-[var(--g66-text-primary)]">Envío de Mensajes</summary>
                <label className="mt-4 flex items-center justify-between gap-4 text-sm text-[var(--g66-text-secondary)]">
                  Habilitar presionar ENTER para enviar mensajes
                  <input type="checkbox" checked={settingsDraft.enter_to_send} onChange={(event) => setSettingsDraft((current) => ({ ...current, enter_to_send: event.target.checked }))} className="h-4 w-4 accent-[var(--g66-brand-blue)]" />
                </label>
              </details>
              <details open className="rounded-xl border border-[var(--g66-border)] p-4">
                <summary className="cursor-pointer text-sm font-bold text-[var(--g66-text-primary)]">Colores</summary>
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase text-[var(--g66-text-muted)]">Mis conversaciones</p>
                    <ColorSettingRow label="Borde" value={settingsDraft.my_conversation_border_color} onChange={(value) => setSettingsDraft((current) => ({ ...current, my_conversation_border_color: value }))} />
                    <ColorSettingRow label="Texto" value={settingsDraft.my_conversation_text_color} onChange={(value) => setSettingsDraft((current) => ({ ...current, my_conversation_text_color: value }))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase text-[var(--g66-text-muted)]">Mis notas</p>
                    <ColorSettingRow label="Borde" value={settingsDraft.my_notes_border_color} onChange={(value) => setSettingsDraft((current) => ({ ...current, my_notes_border_color: value }))} />
                    <ColorSettingRow label="Texto" value={settingsDraft.my_notes_text_color} onChange={(value) => setSettingsDraft((current) => ({ ...current, my_notes_text_color: value }))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase text-[var(--g66-text-muted)]">Conversación del Cliente</p>
                    <ColorSettingRow label="Borde" value={settingsDraft.customer_conversation_border_color} onChange={(value) => setSettingsDraft((current) => ({ ...current, customer_conversation_border_color: value }))} />
                    <ColorSettingRow label="Texto" value={settingsDraft.customer_conversation_text_color} onChange={(value) => setSettingsDraft((current) => ({ ...current, customer_conversation_text_color: value }))} />
                  </div>
                </div>
              </details>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--g66-border)] px-5 py-4">
              <button type="button" onClick={() => setIsSettingsOpen(false)} className="h-9 rounded-lg border border-[var(--g66-border)] px-4 text-sm font-semibold text-[var(--g66-text-secondary)]">Salir</button>
              <button type="button" disabled={isSavingSettings} onClick={() => void saveChatSettings()} className="h-9 rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-bold text-white disabled:opacity-60">{isSavingSettings ? "Guardando..." : "Guardar Cambios"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
