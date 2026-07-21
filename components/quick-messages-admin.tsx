"use client";

import type { CrmQuickMessage, QuickMessageInput } from "@/lib/whatsapp-chat-types";
import { Edit3, MessageSquareText, Plus, Search, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "./toast-provider";

const emptyForm: QuickMessageInput = {
  title: "",
  content: "",
  channel: "WHATSAPP",
  category: "",
  is_active: true,
};

type QuickMessagesResponse = {
  messages?: CrmQuickMessage[];
  message?: CrmQuickMessage;
  error?: string;
};

export function QuickMessagesAdmin() {
  const toast = useToast();
  const [messages, setMessages] = useState<CrmQuickMessage[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuickMessageInput>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/chat/quick-messages?includeInactive=true", {
        cache: "no-store",
      });
      const payload = (await response.json()) as QuickMessagesResponse;
      if (!response.ok) throw new Error(payload.error || "No se pudieron cargar los mensajes rápidos.");
      setMessages(payload.messages ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los mensajes rápidos.");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/chat/quick-messages?includeInactive=true", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as QuickMessagesResponse;
        if (!response.ok) {
          throw new Error(payload.error || "No se pudieron cargar los mensajes rápidos.");
        }
        setMessages(payload.messages ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar los mensajes rápidos.");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [toast]);

  const filteredMessages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return messages;
    return messages.filter((message) =>
      [message.title, message.content, message.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [messages, query]);

  function editMessage(message: CrmQuickMessage) {
    setEditingId(message.id);
    setForm({
      title: message.title,
      content: message.content,
      channel: message.channel || "WHATSAPP",
      category: message.category || "",
      is_active: message.is_active,
    });
  }

  function clearForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/chat/quick-messages/${editingId}` : "/api/chat/quick-messages",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const payload = (await response.json()) as QuickMessagesResponse;
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar el mensaje rápido.");
      toast.success(editingId ? "Mensaje rápido actualizado." : "Mensaje rápido creado.");
      clearForm();
      await loadMessages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el mensaje rápido.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(message: CrmQuickMessage) {
    const response = await fetch(`/api/chat/quick-messages/${message.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: message.title,
        content: message.content,
        channel: message.channel,
        category: message.category,
        is_active: !message.is_active,
      }),
    });
    const payload = (await response.json()) as QuickMessagesResponse;
    if (!response.ok) {
      toast.error(payload.error || "No se pudo cambiar el estado.");
      return;
    }
    toast.success(message.is_active ? "Mensaje desactivado." : "Mensaje activado.");
    await loadMessages();
  }

  async function deleteMessage(message: CrmQuickMessage) {
    if (!window.confirm(`¿Eliminar “${message.title}”?`)) return;
    const response = await fetch(`/api/chat/quick-messages/${message.id}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(payload.error || "No se pudo eliminar el mensaje.");
      return;
    }
    toast.success("Mensaje rápido eliminado.");
    if (editingId === message.id) clearForm();
    await loadMessages();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--g66-border-soft)] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--g66-text-primary)]">Mensajes rápidos</h2>
            <p className="text-xs text-[var(--g66-text-secondary)]">Respuestas reutilizables para WhatsApp.</p>
          </div>
          <label className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-[var(--g66-border)] px-3 text-[var(--g66-text-muted)]">
            <Search className="h-4 w-4" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o contenido" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>
        <div className="divide-y divide-[var(--g66-border-soft)]">
          {filteredMessages.map((message) => (
            <article key={message.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[var(--g66-text-primary)]">{message.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${message.is_active ? "bg-[var(--g66-success-soft)] text-[var(--g66-success)]" : "bg-[var(--g66-surface-soft)] text-[var(--g66-text-muted)]"}`}>
                    {message.is_active ? "Activo" : "Inactivo"}
                  </span>
                  {message.category ? <span className="text-xs text-[var(--g66-text-muted)]">{message.category}</span> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--g66-text-secondary)]">{message.content}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void toggleActive(message)} className="h-8 rounded-lg border border-[var(--g66-border)] px-3 text-xs font-medium text-[var(--g66-text-secondary)]">
                  {message.is_active ? "Desactivar" : "Activar"}
                </button>
                <button type="button" onClick={() => editMessage(message)} aria-label={`Editar ${message.title}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--g66-border)] text-[var(--g66-brand-blue)]">
                  <Edit3 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => void deleteMessage(message)} aria-label={`Eliminar ${message.title}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--g66-danger-soft)] text-[var(--g66-danger)]">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
          {!isLoading && filteredMessages.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--g66-text-muted)]">No hay mensajes rápidos.</p>
          ) : null}
          {isLoading ? <p className="p-8 text-center text-sm text-[var(--g66-text-muted)]">Cargando...</p> : null}
        </div>
      </section>

      <form onSubmit={saveMessage} className="h-fit rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--g66-text-primary)]">
          {editingId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editingId ? "Editar mensaje" : "Nuevo mensaje"}
        </h2>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-[var(--g66-text-secondary)]">Nombre
            <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="h-9 rounded-lg border border-[var(--g66-border)] px-3 text-sm outline-none focus:border-[var(--g66-brand-blue)]" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--g66-text-secondary)]">Contenido
            <textarea required rows={6} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} className="resize-y rounded-lg border border-[var(--g66-border)] px-3 py-2 text-sm leading-5 outline-none focus:border-[var(--g66-brand-blue)]" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs font-medium text-[var(--g66-text-secondary)]">Canal
              <select value={form.channel || "WHATSAPP"} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))} className="h-9 rounded-lg border border-[var(--g66-border)] px-2 text-sm">
                <option value="WHATSAPP">WhatsApp</option>
                <option value="GLOBAL">Global</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--g66-text-secondary)]">Categoría
              <input value={form.category || ""} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="h-9 rounded-lg border border-[var(--g66-border)] px-3 text-sm outline-none" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--g66-text-secondary)]">
            <input type="checkbox" checked={form.is_active ?? true} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
            Mensaje activo
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={isSaving} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white disabled:opacity-60">
            <MessageSquareText className="h-4 w-4" />
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
          {editingId ? <button type="button" onClick={clearForm} className="h-9 rounded-lg border border-[var(--g66-border)] px-3 text-sm">Cancelar</button> : null}
        </div>
      </form>
    </div>
  );
}
