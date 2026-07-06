"use client";

import {
  duplicateDashboard,
  getDashboard,
  listDashboardFolders,
  saveDashboard,
  type DashboardDefinition,
  type DashboardWidgetConfig,
  dashboardFolders,
} from "@/lib/paneles-api";
import { initialReports, listReports, type ReportDefinition } from "@/lib/informes-api";
import { runReport, type ReportRunResult } from "@/lib/informes-engine";
import { ArrowLeft, Copy, Edit3, MoreHorizontal, Plus, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AddWidgetModal } from "./add-widget-modal";
import { PanelVisibilityBadge, WidgetPreview, widgetTypes } from "./panel-ui";
import { useReportSource } from "@/components/informes/use-report-source";
import { DashboardWidgetShell, WidgetFooter, WidgetHeader } from "./dashboard-widget-shell";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function PanelWidgetCard({ widget, result, onEdit, onDuplicate, onDelete }: { widget: DashboardWidgetConfig; result?: ReportRunResult; onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const typeLabel = widgetTypes.find((item) => item.type === widget.type)?.label || widget.type;
  const chartHeight = widget.layout.size === "large" ? "h-60" : widget.layout.size === "small" ? "h-40" : "h-48";
  const action = <div className="group relative"><button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><MoreHorizontal className="h-4 w-4" /></button><div className="invisible absolute right-0 top-7 z-10 w-32 rounded-lg border border-slate-200 bg-white p-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100"><button type="button" onClick={onEdit} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"><Edit3 className="h-3 w-3" /> Editar</button><button type="button" onClick={onDuplicate} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"><Copy className="h-3 w-3" /> Duplicar</button><button type="button" onClick={onDelete} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-3 w-3" /> Eliminar</button></div></div>;
  return (
    <DashboardWidgetShell wide={widget.layout.size === "large"} header={<WidgetHeader title={widget.title} subtitle={`${typeLabel} · ${widget.source}`} detail={`${widget.metric}${widget.groupBy ? ` · ${widget.groupBy}` : ""}`} action={action} />} footer={<WidgetFooter filters={widget.filters.length} totalRows={result?.totalRows ?? 0} updatedAt={formatDate(widget.updatedAt)} />}>
      <div className={`${chartHeight} p-4`}><WidgetPreview widget={widget} result={result} compact={widget.layout.size === "small"} /></div>
    </DashboardWidgetShell>
  );
}

export function PanelDetailView({ panelId }: { panelId: string }) {
  useReportSource("cases");
  const router = useRouter();
  const [panel, setPanel] = useState<DashboardDefinition | null>(null);
  const [folders, setFolders] = useState(dashboardFolders);
  const [reports, setReports] = useState<ReportDefinition[]>(initialReports);
  const [loaded, setLoaded] = useState(false);
  const [addingWidget, setAddingWidget] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidgetConfig | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPanel(getDashboard(panelId));
      setFolders(listDashboardFolders());
      setReports(listReports());
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [panelId]);

  function persist(next: DashboardDefinition) { const updated = { ...next, updatedAt: new Date().toISOString() }; saveDashboard(updated); setPanel(updated); }
  function addWidget(widget: DashboardWidgetConfig) { if (!panel) return; persist({ ...panel, widgets: [...panel.widgets, widget] }); setAddingWidget(false); }
  function duplicateWidget(widget: DashboardWidgetConfig) { if (!panel) return; persist({ ...panel, widgets: [...panel.widgets, { ...widget, id: `${widget.id}-copy-${panel.widgets.length + 1}`, title: `${widget.title} (copia)` }] }); }
  function updateWidget(widget: DashboardWidgetConfig) { if (!panel) return; persist({ ...panel, widgets: panel.widgets.map((item) => item.id === widget.id ? widget : item) }); setEditingWidget(null); }
  function removeWidget(id: string) { if (!panel || !window.confirm("¿Eliminar este widget?")) return; persist({ ...panel, widgets: panel.widgets.filter((widget) => widget.id !== id) }); }
  function duplicatePanel() { if (!panel) return; const copy = duplicateDashboard(panel.id); if (copy) router.push(`/paneles/${copy.id}`); }

  if (!loaded) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">Cargando panel…</div>;
  if (!panel) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center"><p className="text-sm font-bold text-slate-800">Panel no encontrado</p><Link href="/paneles" className="mt-3 inline-flex text-xs font-bold text-blue-600">Volver a Paneles</Link></div>;
  const folder = folders.find((item) => item.id === panel.folderId);

  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><Link href="/paneles" className="hover:text-blue-600">Paneles</Link><span>›</span><span className="text-slate-800">{panel.name}</span></div>
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between"><div className="flex gap-3"><Link href="/paneles" className="mt-0.5 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></Link><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-extrabold text-slate-950">{panel.name}</h1><PanelVisibilityBadge visibility={panel.visibility} /></div><p className="mt-1 max-w-2xl text-xs text-slate-500">{panel.description}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400"><span>Carpeta: {folder?.name || "—"}</span><span>Dueño: {panel.owner.name}</span><span>Actualizado: {formatDate(panel.updatedAt)}</span></div></div></div><div className="flex flex-wrap gap-2"><button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600"><Edit3 className="h-3.5 w-3.5" /> Editar</button><button type="button" onClick={() => setShareOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600"><Share2 className="h-3.5 w-3.5" /> Compartir</button><button type="button" onClick={duplicatePanel} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600"><Copy className="h-3.5 w-3.5" /> Duplicar</button><button type="button" onClick={() => setAddingWidget(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" /> Agregar widget</button></div></section>
      <section className="grid gap-3 md:grid-cols-2">{panel.widgets.map((widget) => { const report = reports.find((item) => item.id === widget.reportId); return <PanelWidgetCard key={widget.id} widget={widget} result={report ? runReport(report) : undefined} onEdit={() => setEditingWidget(widget)} onDuplicate={() => duplicateWidget(widget)} onDelete={() => removeWidget(widget.id)} />; })}</section>
      {!panel.widgets.length ? <button type="button" onClick={() => setAddingWidget(true)} className="flex min-h-56 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-400 hover:border-blue-400 hover:text-blue-600"><Plus className="h-6 w-6" /><span className="mt-2 text-xs font-bold">Agregar el primer widget</span></button> : null}
      {addingWidget ? <AddWidgetModal onClose={() => setAddingWidget(false)} onSave={addWidget} /> : null}
      {editingWidget ? <AddWidgetModal initialWidget={editingWidget} onClose={() => setEditingWidget(null)} onSave={updateWidget} /> : null}
      {shareOpen ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h2 className="text-base font-extrabold">Compartir panel</h2><p className="mt-2 text-xs text-slate-500">Selecciona personas o equipos. Los permisos reales se conectarán en una etapa posterior.</p><input placeholder="Buscar personas o equipos..." className="mt-4 h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none" /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setShareOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-bold">Cancelar</button><button type="button" onClick={() => setShareOpen(false)} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white">Compartir</button></div></div></div> : null}
    </div>
  );
}
