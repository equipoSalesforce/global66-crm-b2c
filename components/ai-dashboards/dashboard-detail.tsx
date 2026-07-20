"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Clock3, LayoutDashboard, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  allowedDimensionKeys,
  allowedMetricKeys,
  allowedWidgetTypes,
  metricDefinitions,
  type AnalyticsDimensionKey,
  type AnalyticsMetricKey,
  type DashboardWidgetType,
  type SafeDashboardDefinition,
  type WidgetData,
} from "@/lib/analytics/semantic-layer";
import { AiDashboardRenderer } from "@/components/ai-dashboards/ai-dashboard-renderer";

type DashboardPayload = {
  ok?: boolean;
  error?: string;
  dashboard?: {
    id: string;
    name: string;
    description: string | null;
    owner_user_name: string | null;
    visibility: "PRIVATE" | "TEAM" | "PUBLIC";
    definition: SafeDashboardDefinition;
  };
  permissions?: { canEdit: boolean; canDelete: boolean; canChangeVisibility: boolean };
  data?: WidgetData[];
  resolvedAt?: string;
};

export function DashboardDetail({ dashboardId }: { dashboardId: string }) {
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [draft, setDraft] = useState<SafeDashboardDefinition | null>(null);
  const [draftData, setDraftData] = useState<WidgetData[]>([]);
  const [visibility, setVisibility] = useState<"PRIVATE" | "TEAM" | "PUBLIC">("PRIVATE");
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/dashboards/${dashboardId}`, { cache: "no-store" });
        const next = (await response.json()) as DashboardPayload;
        if (!response.ok || !next.ok || !next.dashboard) throw new Error(next.error || "Dashboard no encontrado.");
        setPayload(next);
        setVisibility(next.dashboard.visibility);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo cargar el dashboard.");
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [dashboardId, reloadKey]);

  useEffect(() => {
    if (!editing || !draft) return;
    const timeoutId = window.setTimeout(async () => {
      setResolving(true);
      try {
        const response = await fetch("/api/analytics/widgets/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ definition: draft }),
        });
        const next = (await response.json()) as { ok?: boolean; error?: string; widgets?: WidgetData[] };
        if (!response.ok || !next.ok) throw new Error(next.error || "No se pudo actualizar la previsualización.");
        setDraftData(next.widgets ?? []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo actualizar la previsualización.");
      } finally {
        setResolving(false);
      }
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [draft, editing]);

  function startEditing() {
    if (!payload?.dashboard) return;
    setDraft(structuredClone(payload.dashboard.definition));
    setDraftData(payload.data ?? []);
    setVisibility(payload.dashboard.visibility);
    setEditing(true);
    setError(null);
  }

  function updateWidget(index: number, patch: Partial<SafeDashboardDefinition["widgets"][number]>) {
    setDraft((current) => current ? { ...current, widgets: current.widgets.map((widget, widgetIndex) => widgetIndex === index ? { ...widget, ...patch } : widget) } : current);
  }

  function moveWidget(index: number, direction: -1 | 1) {
    setDraft((current) => {
      if (!current) return current;
      const destination = index + direction;
      if (destination < 0 || destination >= current.widgets.length) return current;
      const widgets = [...current.widgets];
      [widgets[index], widgets[destination]] = [widgets[destination], widgets[index]];
      return { ...current, widgets };
    });
  }

  function addWidget() {
    setDraft((current) => current && current.widgets.length < 8 ? {
      ...current,
      widgets: [...current.widgets, {
        id: `widget_${Date.now()}`,
        type: "kpi",
        title: "Nuevo indicador",
        metric: "total_cases",
        filters: {},
      }],
    } : current);
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition: draft, visibility }),
      });
      const next = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !next.ok) throw new Error(next.error || "No se pudo guardar el dashboard.");
      setEditing(false);
      setDraft(null);
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el dashboard.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}`, { method: "DELETE" });
      const next = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !next.ok) throw new Error(next.error || "No se pudo eliminar el dashboard.");
      router.push("/dashboards");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo eliminar el dashboard.");
      setShowDelete(false);
      setBusy(false);
    }
  }

  if (error && !payload?.dashboard) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>;
  if (!payload?.dashboard) return <div className="rounded-xl border bg-white p-8 text-sm font-semibold text-slate-500">Resolviendo datos del dashboard...</div>;
  const dashboard = payload.dashboard;
  const definition = editing && draft ? draft : dashboard.definition;
  const data = editing ? draftData : payload.data ?? [];

  return <div className="space-y-4 pb-8"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><LayoutDashboard className="h-5 w-5" /></span><div><Link href="/dashboards" className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600"><ArrowLeft className="h-3 w-3" />Volver a dashboards</Link><h1 className="mt-1 text-2xl font-black text-slate-950">{editing ? draft?.title : dashboard.name}</h1><p className="mt-1 text-xs text-slate-500">{editing ? draft?.description : dashboard.description}</p></div></div><div className="flex flex-wrap items-center justify-end gap-2">{payload.permissions?.canEdit && !editing ? <button type="button" onClick={startEditing} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 px-3 text-xs font-black text-blue-600"><Pencil className="h-3.5 w-3.5" />Editar</button> : null}{payload.permissions?.canDelete && !editing ? <button type="button" onClick={() => setShowDelete(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-black text-red-600"><Trash2 className="h-3.5 w-3.5" />Eliminar</button> : null}{editing ? <><button type="button" onClick={() => { setEditing(false); setDraft(null); setError(null); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold text-slate-600"><X className="h-3.5 w-3.5" />Cancelar</button><button type="button" disabled={busy} onClick={() => void save()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-black text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{busy ? "Guardando..." : "Guardar cambios"}</button></> : null}<div className="ml-2 text-right"><span className="rounded-full bg-slate-100 px-3 py-1 text-[9px] font-black text-slate-500">{visibility}</span><p className="mt-2 text-[10px] text-slate-400">Owner: {dashboard.owner_user_name || "Sin owner"}</p>{payload.resolvedAt ? <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400"><Clock3 className="h-3 w-3" />Actualizado {new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" }).format(new Date(payload.resolvedAt))}</p> : null}</div></div></div></section>

  {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

  {editing && draft ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-wide text-blue-600">Edición</p><h2 className="text-lg font-black text-slate-950">Configuración del dashboard</h2></div><button type="button" disabled={draft.widgets.length >= 8} onClick={addWidget} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 px-3 text-xs font-black text-blue-600 disabled:opacity-40"><Plus className="h-3.5 w-3.5" />Agregar widget</button></div><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-[10px] font-black uppercase text-slate-500">Nombre<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold normal-case text-slate-900" /></label><label className="text-[10px] font-black uppercase text-slate-500">Descripción<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-semibold normal-case text-slate-900" /></label>{payload.permissions?.canChangeVisibility ? <label className="text-[10px] font-black uppercase text-slate-500">Visibilidad<select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold normal-case text-slate-900"><option value="PRIVATE">Privado</option><option value="TEAM">Equipo</option><option value="PUBLIC">Público</option></select></label> : null}</div><div className="mt-4 space-y-2">{draft.widgets.map((widget, index) => <article key={widget.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(170px,1.5fr)_115px_180px_150px_auto]"><input aria-label="Título del widget" value={widget.title} onChange={(event) => updateWidget(index, { title: event.target.value })} className="h-9 rounded-lg border bg-white px-3 font-bold" /><select aria-label="Tipo de widget" value={widget.type} onChange={(event) => { const type = event.target.value as DashboardWidgetType; updateWidget(index, { type, ...(type === "kpi" ? { dimension: undefined } : {}) }); }} className="h-9 rounded-lg border bg-white px-2">{allowedWidgetTypes.map((type) => <option key={type}>{type}</option>)}</select><select aria-label="Métrica" value={widget.metric} onChange={(event) => updateWidget(index, { metric: event.target.value as AnalyticsMetricKey })} className="h-9 rounded-lg border bg-white px-2">{allowedMetricKeys.map((metric) => <option key={metric} value={metric}>{metricDefinitions[metric].label}</option>)}</select><select aria-label="Dimensión" disabled={widget.type === "kpi"} value={widget.dimension ?? ""} onChange={(event) => updateWidget(index, { dimension: event.target.value ? event.target.value as AnalyticsDimensionKey : undefined })} className="h-9 rounded-lg border bg-white px-2 disabled:bg-slate-100 disabled:text-slate-400"><option value="">Sin dimensión</option>{allowedDimensionKeys.map((dimension) => <option key={dimension}>{dimension}</option>)}</select><div className="flex gap-1"><button type="button" disabled={index === 0} onClick={() => moveWidget(index, -1)} aria-label="Mover widget arriba" className="h-9 rounded-lg border bg-white px-2 text-slate-500 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" disabled={index === draft.widgets.length - 1} onClick={() => moveWidget(index, 1)} aria-label="Mover widget abajo" className="h-9 rounded-lg border bg-white px-2 text-slate-500 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button><button type="button" disabled={draft.widgets.length === 1} onClick={() => setDraft({ ...draft, widgets: draft.widgets.filter((_, widgetIndex) => widgetIndex !== index) })} aria-label="Eliminar widget" className="h-9 rounded-lg border border-red-200 bg-white px-2 text-red-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button></div></article>)}</div></section> : null}

  <AiDashboardRenderer definition={definition} data={data} loading={resolving} />

  {showDelete ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div role="dialog" aria-modal="true" aria-labelledby="delete-dashboard-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start gap-3"><span className="rounded-xl bg-red-50 p-2.5 text-red-600"><Trash2 className="h-5 w-5" /></span><div><h2 id="delete-dashboard-title" className="text-lg font-black text-slate-950">Eliminar dashboard</h2><p className="mt-2 text-sm leading-6 text-slate-600">¿Eliminar este dashboard? Esta acción no se puede deshacer.</p></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setShowDelete(false)} className="h-9 rounded-lg border px-4 text-xs font-bold text-slate-600">Cancelar</button><button type="button" disabled={busy} onClick={() => void remove()} className="h-9 rounded-lg bg-red-600 px-4 text-xs font-black text-white disabled:opacity-50">{busy ? "Eliminando..." : "Eliminar dashboard"}</button></div></div></div> : null}</div>;
}
