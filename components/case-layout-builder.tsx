"use client";

import type {
  CaseAreaLayout,
  CaseAreaLayoutField,
  CaseFieldDefinition,
} from "@/lib/case-metadata";
import { ArrowDown, ArrowUp, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "./toast-provider";

type LayoutsResponse = {
  layouts?: CaseAreaLayout[];
  availableFields?: CaseFieldDefinition[];
  error?: string;
};

const areas = ["GENERAL", "SOPORTE", "FACTURACION", "OPERACIONES", "COMPLIANCE", "VENTAS"];

export function CaseLayoutBuilder({
  initialLayouts,
  initialAvailableFields,
}: {
  initialLayouts: CaseAreaLayout[];
  initialAvailableFields: CaseFieldDefinition[];
}) {
  const toast = useToast();
  const [layouts, setLayouts] = useState<CaseAreaLayout[]>(initialLayouts);
  const [availableFields, setAvailableFields] = useState<CaseFieldDefinition[]>(initialAvailableFields);
  const [area, setArea] = useState("GENERAL");
  const initialLayout = initialLayouts.find((layout) => layout.area === "GENERAL");
  const [name, setName] = useState(initialLayout?.name || "Formulario General");
  const [description, setDescription] = useState(initialLayout?.description || "");
  const [fields, setFields] = useState<CaseAreaLayoutField[]>(
    () => [...(initialLayout?.fields ?? [])].sort((left, right) => left.order - right.order),
  );
  const [isSaving, setIsSaving] = useState(false);
  const activeLayout = useMemo(
    () => layouts.find((layout) => layout.area === area),
    [area, layouts],
  );

  async function loadLayouts() {
    const response = await fetch("/api/case-layouts", { cache: "no-store" });
    const payload = (await response.json()) as LayoutsResponse;
    if (!response.ok) throw new Error(payload.error || "No se pudieron cargar los layouts.");
    setLayouts(payload.layouts ?? []);
    setAvailableFields(payload.availableFields ?? []);
  }

  function selectArea(nextArea: string) {
    const nextLayout = layouts.find((layout) => layout.area === nextArea);
    setArea(nextArea);
    setName(nextLayout?.name || `Formulario ${nextArea}`);
    setDescription(nextLayout?.description || "");
    setFields([...(nextLayout?.fields ?? [])].sort((left, right) => left.order - right.order));
  }

  function toggleField(definition: CaseFieldDefinition) {
    setFields((current) => {
      const existing = current.find((field) => field.fieldKey === definition.field_key);
      if (existing) return current.filter((field) => field.fieldKey !== definition.field_key);
      return [...current, {
        fieldKey: definition.field_key,
        label: definition.label,
        order: (current.length + 1) * 10,
        required: Boolean(definition.is_required),
        editable: true,
      }];
    });
  }

  function updateField(fieldKey: string, patch: Partial<CaseAreaLayoutField>) {
    setFields((current) => current.map((field) => field.fieldKey === fieldKey ? { ...field, ...patch } : field));
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((field, fieldIndex) => ({ ...field, order: (fieldIndex + 1) * 10 }));
    });
  }

  async function saveLayout() {
    setIsSaving(true);
    try {
      const response = await fetch(
        activeLayout ? `/api/case-layouts/${activeLayout.id}` : "/api/case-layouts",
        {
          method: activeLayout ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ area, name, description, is_active: true, fields }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar el layout.");
      await loadLayouts();
      toast.success("✓ Layout guardado correctamente");
    } catch (error) {
      toast.error(`✗ ${error instanceof Error ? error.message : "Error guardando layout"}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-[var(--g66-border)] bg-white p-4 shadow-sm">
        <label className="grid gap-2 text-xs font-bold uppercase text-[var(--g66-text-secondary)]">
          Área
          <select value={area} onChange={(event) => selectArea(event.target.value)} className="h-10 rounded-md border border-[var(--g66-border)] px-3 text-sm text-[var(--g66-text-primary)]">
            {areas.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="mt-4 grid gap-2 text-xs font-bold uppercase text-[var(--g66-text-secondary)]">
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-md border border-[var(--g66-border)] px-3 text-sm normal-case" />
        </label>
        <label className="mt-4 grid gap-2 text-xs font-bold uppercase text-[var(--g66-text-secondary)]">
          Descripción
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24 rounded-md border border-[var(--g66-border)] p-3 text-sm font-normal normal-case" />
        </label>
        <button type="button" onClick={saveLayout} disabled={isSaving || !name.trim()} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--g66-brand-blue)] px-4 text-sm font-bold text-white disabled:bg-slate-300">
          <Save className="h-4 w-4" /> {isSaving ? "Guardando..." : "Guardar layout"}
        </button>
      </aside>

      <section className="rounded-lg border border-[var(--g66-border)] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-black text-[var(--g66-text-primary)]">Campos para {area}</h2>
        <p className="mt-1 text-xs text-[var(--g66-text-secondary)]">Activa campos y define su orden, obligatoriedad y edición.</p>
        <div className="mt-4 grid gap-2">
          {availableFields.map((definition) => {
            const index = fields.findIndex((field) => field.fieldKey === definition.field_key);
            const selected = index >= 0;
            const field = selected ? fields[index] : null;
            return (
              <article key={definition.id} className={`rounded-md border p-3 ${selected ? "border-blue-200 bg-blue-50/40" : "border-[var(--g66-border-soft)]"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-w-52 flex-1 items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={selected} onChange={() => toggleField(definition)} />
                    {definition.label}
                    <span className="text-[10px] font-semibold text-slate-400">{definition.field_key}</span>
                  </label>
                  {field ? (
                    <>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={field.required} onChange={(event) => updateField(field.fieldKey, { required: event.target.checked })} /> Requerido</label>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={field.editable} onChange={(event) => updateField(field.fieldKey, { editable: event.target.checked })} /> Editable</label>
                      <button type="button" onClick={() => moveField(index, -1)} disabled={index === 0} aria-label="Subir campo" className="rounded border p-1 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1} aria-label="Bajar campo" className="rounded border p-1 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
