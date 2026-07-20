"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Layers3, Search, UserRound, UsersRound, X } from "lucide-react";
import type { CaseFieldDefinition } from "@/lib/case-metadata";
import type {
  CaseAssignmentOptionsResponse,
  CaseAssignmentResult,
  CaseOwnerType,
  DuplicateCaseResult,
} from "@/lib/case-ownership-types";

type ApiPayload<T> = { ok?: boolean; error?: string } & T;
type OwnerSelection = `${CaseOwnerType}:${string}`;

function ModalFrame({
  title,
  description,
  children,
  onClose,
  busy = false,
  widthClass = "max-w-2xl",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  widthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section role="dialog" aria-modal="true" aria-labelledby="case-action-modal-title" className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-[var(--g66-border)] bg-white shadow-2xl ${widthClass}`}>
        <header className="flex items-start justify-between gap-4 border-b border-[var(--g66-border-soft)] px-5 py-4">
          <div>
            <h2 id="case-action-modal-title" className="text-lg font-black text-[var(--g66-text-primary)]">{title}</h2>
            <p className="mt-1 text-xs font-semibold text-[var(--g66-text-secondary)]">{description}</p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar modal" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--g66-border)] text-[var(--g66-text-secondary)] hover:bg-[var(--g66-surface-soft)] disabled:opacity-50">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

async function loadAssignmentOptions(caseId: string) {
  const response = await fetch(`/api/cases/${caseId}/assignment`, { cache: "no-store" });
  const payload = (await response.json()) as ApiPayload<CaseAssignmentOptionsResponse>;
  if (!response.ok || !payload.ok) throw new Error(payload.error || "No se pudieron cargar los owners.");
  return payload;
}

export function CaseAssignmentModal({
  caseId,
  onClose,
  onAssigned,
}: {
  caseId: string;
  onClose: () => void;
  onAssigned: (assignment: CaseAssignmentResult) => void;
}) {
  const [options, setOptions] = useState<CaseAssignmentOptionsResponse | null>(null);
  const [tab, setTab] = useState<CaseOwnerType>("USER");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<OwnerSelection | "">("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadAssignmentOptions(caseId).then((payload) => {
      if (!active) return;
      setOptions(payload);
      setTab(payload.currentOwner.type);
      if (payload.currentOwner.id) setSelection(`${payload.currentOwner.type}:${payload.currentOwner.id}`);
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "No se pudieron cargar los owners.");
    });
    return () => { active = false; };
  }, [caseId]);

  const filteredUsers = useMemo(() => (options?.users ?? []).filter((user) => `${user.name} ${user.email} ${user.role} ${user.team ?? ""}`.toLowerCase().includes(query.toLowerCase())), [options?.users, query]);
  const filteredQueues = useMemo(() => (options?.queues ?? []).filter((queue) => `${queue.name} ${queue.description ?? ""} ${queue.area ?? ""}`.toLowerCase().includes(query.toLowerCase())), [options?.queues, query]);

  async function submit() {
    if (!selection) return;
    const [ownerType, ownerId] = selection.split(":") as [CaseOwnerType, string];
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/cases/${caseId}/assignment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerType,
          assignedAgentId: ownerType === "USER" ? ownerId : null,
          assignedQueueId: ownerType === "QUEUE" ? ownerId : null,
          notify: ownerType === "USER" && notify,
        }),
      });
      const payload = (await response.json()) as ApiPayload<{ assignment?: CaseAssignmentResult }>;
      if (!response.ok || !payload.ok || !payload.assignment) throw new Error(payload.error || "No se pudo asignar el caso.");
      onAssigned(payload.assignment);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo asignar el caso.");
      setSaving(false);
    }
  }

  return (
    <ModalFrame title="Asignar caso" description="Selecciona un ejecutivo activo o una cola operativa." onClose={onClose} busy={saving}>
      <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
        <div className="grid grid-cols-2 rounded-xl bg-[var(--g66-surface-soft)] p-1">
          {(["USER", "QUEUE"] as const).map((ownerType) => (
            <button key={ownerType} type="button" onClick={() => { setTab(ownerType); setSelection(""); }} className={`flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-black transition ${tab === ownerType ? "bg-white text-[var(--g66-brand-blue)] shadow-sm" : "text-[var(--g66-text-secondary)]"}`}>
              {ownerType === "USER" ? <UserRound className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />}
              {ownerType === "USER" ? "Ejecutivos" : "Colas"}
            </button>
          ))}
        </div>
        <label className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-[var(--g66-border)] bg-white px-3 text-[var(--g66-text-muted)] focus-within:border-[var(--g66-brand-blue)]">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "USER" ? "Buscar por nombre, email o equipo..." : "Buscar cola por nombre o área..."} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <div className="mt-3 min-h-48 flex-1 space-y-2 overflow-y-auto pr-1">
          {!options && !error ? <p className="py-12 text-center text-sm font-semibold text-[var(--g66-text-muted)]">Cargando owners...</p> : null}
          {tab === "USER" ? filteredUsers.map((user) => {
            const value: OwnerSelection = `USER:${user.id}`;
            return <label key={user.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selection === value ? "border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue-soft)]" : "border-[var(--g66-border)] hover:bg-[var(--g66-surface-soft)]"}`}><input type="radio" name="owner" value={value} checked={selection === value} onChange={() => setSelection(value)} /><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-xs font-black text-[var(--g66-brand-blue)]">{user.name.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[var(--g66-text-primary)]">{user.name}</strong><small className="block truncate text-[11px] font-semibold text-[var(--g66-text-secondary)]">{user.email} · {[user.role, user.team || user.area].filter(Boolean).join(" · ")}</small></span></label>;
          }) : filteredQueues.map((queue) => {
            const value: OwnerSelection = `QUEUE:${queue.id}`;
            return <label key={queue.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selection === value ? "border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue-soft)]" : "border-[var(--g66-border)] hover:bg-[var(--g66-surface-soft)]"}`}><input type="radio" name="owner" value={value} checked={selection === value} onChange={() => setSelection(value)} /><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[var(--g66-brand-blue)]"><Layers3 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[var(--g66-text-primary)]">{queue.name}</strong><small className="block truncate text-[11px] font-semibold text-[var(--g66-text-secondary)]">{queue.description || queue.area || "Sin descripción"} · {queue.memberCount} miembros</small></span></label>;
          })}
          {options && ((tab === "USER" && !filteredUsers.length) || (tab === "QUEUE" && !filteredQueues.length)) ? <p className="py-12 text-center text-sm font-semibold text-[var(--g66-text-muted)]">No hay resultados para esta búsqueda.</p> : null}
        </div>
        {tab === "USER" ? <label className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[var(--g66-text-secondary)]"><input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />Notificar al nuevo owner</label> : null}
        {error ? <p className="mt-3 rounded-lg bg-[var(--g66-danger-soft)] px-3 py-2 text-xs font-bold text-[var(--g66-danger)]">{error}</p> : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-[var(--g66-border-soft)] px-5 py-4"><button type="button" disabled={saving} onClick={onClose} className="h-10 rounded-xl border border-[var(--g66-border)] px-4 text-xs font-black text-[var(--g66-text-secondary)]">Cancelar</button><button type="button" disabled={!selection || saving} onClick={() => void submit()} className="h-10 rounded-xl bg-[var(--g66-brand-blue)] px-5 text-xs font-black text-white disabled:opacity-50">{saving ? "Asignando..." : "Asignar"}</button></footer>
    </ModalFrame>
  );
}

export type DuplicateModalCase = {
  id: string;
  customerLabel: string;
  area: string | null;
  channel: string | null;
  product: string | null;
  priority: string | null;
  category: string | null;
  contactType: string | null;
  description: string | null;
  ownerType: CaseOwnerType;
  assignedAgentId: string | null;
  assignedQueueId: string | null;
};

export type DuplicateModalCustomField = { field: CaseFieldDefinition; value: unknown };

function DynamicDuplicateInput({ item }: { item: DuplicateModalCustomField }) {
  const name = `custom:${item.field.id}`;
  const value = typeof item.value === "string" ? item.value : "";
  const classes = "mt-1 h-10 w-full rounded-xl border border-[var(--g66-border)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]";
  if (item.field.field_type === "boolean") return <span className="mt-2 inline-flex h-9 items-center gap-2 text-sm font-semibold"><input name={name} type="checkbox" defaultChecked={Boolean(item.value)} />Sí</span>;
  if (item.field.field_type === "textarea") return <textarea name={name} defaultValue={value} required={Boolean(item.field.is_required)} className="mt-1 min-h-20 w-full rounded-xl border border-[var(--g66-border)] p-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]" />;
  if (item.field.field_type === "picklist") return <select name={name} defaultValue={value} required={Boolean(item.field.is_required)} className={classes}><option value="">Seleccionar</option>{(item.field.picklist_values ?? []).map((option) => <option key={option}>{option}</option>)}</select>;
  const type = ({ number: "number", currency: "number", date: "date", datetime: "datetime-local", email: "email", phone: "tel", url: "url" } as Record<string, string>)[item.field.field_type] ?? "text";
  return <input name={name} type={type} step={item.field.field_type === "currency" ? "0.01" : undefined} defaultValue={value} required={Boolean(item.field.is_required)} className={classes} />;
}

export function DuplicateCaseModal({ source, customFields, onClose, onDuplicated }: { source: DuplicateModalCase; customFields: DuplicateModalCustomField[]; onClose: () => void; onDuplicated: (result: DuplicateCaseResult) => void }) {
  const [options, setOptions] = useState<CaseAssignmentOptionsResponse | null>(null);
  const [ownerSelection, setOwnerSelection] = useState<OwnerSelection | "">(source.ownerType === "QUEUE" && source.assignedQueueId ? `QUEUE:${source.assignedQueueId}` : source.assignedAgentId ? `USER:${source.assignedAgentId}` : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadAssignmentOptions(source.id).then((payload) => { if (active) setOptions(payload); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "No se pudieron cargar los owners."); });
    return () => { active = false; };
  }, [source.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const customValues = customFields.map(({ field }) => ({ fieldDefinitionId: field.id, value: field.field_type === "boolean" ? formData.get(`custom:${field.id}`) === "on" : String(formData.get(`custom:${field.id}`) ?? "") }));
    const [ownerType, ownerId] = ownerSelection ? ownerSelection.split(":") as [CaseOwnerType, string] : ["USER", ""];
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/cases/${source.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            area: formData.get("area"), channel: formData.get("channel"), product: formData.get("product"), priority: formData.get("priority"), category: formData.get("category"), contactType: formData.get("contactType"), description: formData.get("description"), customValues,
          },
          assignment: ownerSelection ? { ownerType, assignedAgentId: ownerType === "USER" ? ownerId : null, assignedQueueId: ownerType === "QUEUE" ? ownerId : null } : null,
        }),
      });
      const payload = (await response.json()) as ApiPayload<{ duplicatedCase?: DuplicateCaseResult }>;
      if (!response.ok || !payload.ok || !payload.duplicatedCase) throw new Error(payload.error || "No se pudo duplicar el caso.");
      onDuplicated(payload.duplicatedCase);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo duplicar el caso.");
      setSaving(false);
    }
  }

  const fieldClass = "mt-1 h-10 w-full rounded-xl border border-[var(--g66-border)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]";
  return <ModalFrame title="Duplicar caso" description="Edita los datos principales antes de crear el nuevo caso." onClose={onClose} busy={saving} widthClass="max-w-3xl"><form onSubmit={submit} className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 overflow-y-auto px-5 py-4"><div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-black text-[var(--g66-text-secondary)] md:col-span-2">Cliente<input value={source.customerLabel} readOnly className={`${fieldClass} bg-[var(--g66-surface-soft)] text-[var(--g66-text-muted)]`} /></label><label className="text-xs font-black text-[var(--g66-text-secondary)]">Área<input name="area" defaultValue={source.area ?? ""} className={fieldClass} /></label><label className="text-xs font-black text-[var(--g66-text-secondary)]">Canal<input name="channel" defaultValue={source.channel ?? ""} className={fieldClass} /></label><label className="text-xs font-black text-[var(--g66-text-secondary)]">Producto<input name="product" defaultValue={source.product ?? ""} className={fieldClass} /></label><label className="text-xs font-black text-[var(--g66-text-secondary)]">Prioridad<select name="priority" defaultValue={source.priority ?? "MEDIUM"} className={fieldClass}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-xs font-black text-[var(--g66-text-secondary)]">Categoría<input name="category" defaultValue={source.category ?? ""} className={fieldClass} /></label><label className="text-xs font-black text-[var(--g66-text-secondary)]">Tipo de contacto<input name="contactType" defaultValue={source.contactType ?? ""} className={fieldClass} /></label><label className="text-xs font-black text-[var(--g66-text-secondary)] md:col-span-2">Owner<select value={ownerSelection} onChange={(event) => setOwnerSelection(event.target.value as OwnerSelection | "")} className={fieldClass}><option value="">Sin owner</option><optgroup label="Ejecutivos">{(options?.users ?? []).map((user) => <option key={user.id} value={`USER:${user.id}`}>{user.name} · {user.team || user.area || user.role}</option>)}</optgroup><optgroup label="Colas">{(options?.queues ?? []).map((queue) => <option key={queue.id} value={`QUEUE:${queue.id}`}>{queue.name} · {queue.area || "Sin área"}</option>)}</optgroup></select></label><label className="text-xs font-black text-[var(--g66-text-secondary)] md:col-span-2">Descripción inicial<textarea name="description" defaultValue={source.description ?? ""} className="mt-1 min-h-24 w-full rounded-xl border border-[var(--g66-border)] p-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]" /></label>{customFields.length ? <div className="md:col-span-2"><h3 className="border-t border-[var(--g66-border-soft)] pt-4 text-xs font-black uppercase tracking-wide text-[var(--g66-text-muted)]">Campos del área</h3><div className="mt-3 grid gap-4 md:grid-cols-2">{customFields.map((item) => <label key={item.field.id} className="text-xs font-black text-[var(--g66-text-secondary)]">{item.field.label}<DynamicDuplicateInput item={item} /></label>)}</div></div> : null}</div>{error ? <p className="mt-4 rounded-lg bg-[var(--g66-danger-soft)] px-3 py-2 text-xs font-bold text-[var(--g66-danger)]">{error}</p> : null}</div><footer className="flex justify-end gap-2 border-t border-[var(--g66-border-soft)] px-5 py-4"><button type="button" disabled={saving} onClick={onClose} className="h-10 rounded-xl border border-[var(--g66-border)] px-4 text-xs font-black text-[var(--g66-text-secondary)]">Cancelar</button><button type="submit" disabled={saving} className="h-10 rounded-xl bg-[var(--g66-brand-blue)] px-5 text-xs font-black text-white disabled:opacity-50">{saving ? "Creando caso..." : "Crear caso"}</button></footer></form></ModalFrame>;
}
