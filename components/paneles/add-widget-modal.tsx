"use client";

import { createWidgetDraft, type DashboardWidgetConfig } from "@/lib/paneles-api";
import { initialReports, listReports, type ReportDefinition } from "@/lib/informes-api";
import { runReport } from "@/lib/informes-engine";
import { getReportField, getReportSourceAdapter } from "@/lib/informes-metadata-provider";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { WidgetChartTypeSelector, WidgetPreview, widgetTypes } from "./panel-ui";
import { useReportSource } from "@/components/informes/use-report-source";

const fieldClass = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export function AddWidgetModal({ onClose, onSave, initialWidget }: { onClose: () => void; onSave: (widget: DashboardWidgetConfig) => void; initialWidget?: DashboardWidgetConfig }) {
  const [widget, setWidget] = useState(() => initialWidget || createWidgetDraft());
  const [reports, setReports] = useState(initialReports);
  const selectedReport = reports.find((report) => report.id === widget.reportId);
  const sourceRevision = useReportSource(selectedReport?.source ?? "cases");
  const reportResult = useMemo(() => selectedReport ? runReport(selectedReport, sourceRevision) : undefined, [selectedReport, sourceRevision]);
  const setChart = (key: keyof DashboardWidgetConfig["chartConfig"], value: boolean | number | string) => setWidget((current) => ({ ...current, chartConfig: { ...current.chartConfig, [key]: value } }));
  useEffect(() => { const id = window.setTimeout(() => setReports(listReports()), 0); return () => window.clearTimeout(id); }, []);

  function selectReport(reportId: string) {
    const report = reports.find((item) => item.id === reportId);
    if (!report) return;
    const source = getReportSourceAdapter(report.source).source;
    const groupByKey = report.groupBy[0]?.field || report.columns[0] || "";
    const groupBy = getReportField(report.source, groupByKey)?.label || groupByKey;
    const metric = report.metrics[0]?.label || "Recuento de registros";
    setWidget((current) => ({
      ...current,
      reportId: report.id,
      reportName: report.name,
      title: initialWidget ? current.title : report.name,
      description: report.description,
      source: source.label,
      metric,
      groupBy,
      xAxis: groupBy,
      yAxis: metric,
      filters: report.filters.map((filter) => ({ field: filter.field, operator: filter.operator, value: filter.value })),
    }));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Agregar widget">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5"><div><h2 className="text-base font-extrabold text-slate-900">{initialWidget ? "Editar widget" : "Agregar widget"}</h2><p className="text-[11px] text-slate-500">Configura la fuente, visualización y presentación.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase text-slate-500">Informe guardado<select className={`${fieldClass} mt-1`} value={widget.reportId || ""} onChange={(event) => selectReport(event.target.value)}><option value="">Seleccionar informe...</option>{reports.map((report: ReportDefinition) => { const source = getReportSourceAdapter(report.source).source; return <option key={report.id} value={report.id}>{report.name} · {source.label}</option>; })}</select><span className="mt-1 block text-[9px] font-medium normal-case text-slate-400">{widget.reportId ? `${widget.source} · ${widget.reportName}` : "Crea informes reutilizables desde el módulo Informes."}</span></label><label className="text-[10px] font-bold uppercase text-slate-500">Tamaño<select className={`${fieldClass} mt-1`} value={widget.layout.size} onChange={(event) => setWidget({ ...widget, layout: { size: event.target.value as DashboardWidgetConfig["layout"]["size"] } })}><option value="small">Pequeño</option><option value="medium">Mediano</option><option value="large">Grande</option></select></label></div>
            <div><p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Mostrar como</p><WidgetChartTypeSelector value={widget.type} onChange={(type) => setWidget({ ...widget, type })} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase text-slate-500">Eje X / Agrupar por<input readOnly className={`${fieldClass} mt-1 cursor-default bg-slate-50 text-slate-500`} value={widget.groupBy} /></label><label className="text-[10px] font-bold uppercase text-slate-500">Eje Y / Métrica<input readOnly className={`${fieldClass} mt-1 cursor-default bg-slate-50 text-slate-500`} value={widget.metric} /></label></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase text-slate-500">Título<input className={`${fieldClass} mt-1`} value={widget.title} onChange={(event) => setWidget({ ...widget, title: event.target.value })} /></label><label className="text-[10px] font-bold uppercase text-slate-500">Top N<input type="number" min="1" max="50" className={`${fieldClass} mt-1`} value={widget.chartConfig.topN} onChange={(event) => setChart("topN", Number(event.target.value))} /></label></div>
            <label className="block text-[10px] font-bold uppercase text-slate-500">Descripción<textarea className="mt-1 min-h-16 w-full rounded-lg border border-slate-200 p-3 text-xs outline-none focus:border-blue-400" value={widget.description} onChange={(event) => setWidget({ ...widget, description: event.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{([['showValues','Mostrar valores'],['showLegend','Mostrar leyenda'],['showXAxis','Mostrar eje X'],['showYAxis','Mostrar eje Y'],['showGrid','Mostrar grilla'],['showPercentage','Mostrar porcentaje'],['showReferenceLine','Línea de referencia'],['showUnits','Mostrar unidades'],['useReportChart','Usar gráfico del informe'],['useReportTable','Usar tabla del informe']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-semibold text-slate-600"><input type="checkbox" checked={widget.chartConfig[key]} onChange={(event) => setChart(key, event.target.checked)} className="accent-blue-600" />{label}</label>)}</div>
            <div className="grid gap-3 sm:grid-cols-3"><label className="text-[10px] font-bold uppercase text-slate-500">Orden<select className={`${fieldClass} mt-1`} value={widget.chartConfig.sortDirection} onChange={(event) => setChart("sortDirection", event.target.value)}><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></label><label className="text-[10px] font-bold uppercase text-slate-500">Color<select className={`${fieldClass} mt-1`} value={widget.chartConfig.accent} onChange={(event) => setChart("accent", event.target.value)}><option value="blue">Azul</option><option value="cyan">Cian</option><option value="emerald">Verde</option><option value="violet">Violeta</option><option value="amber">Ámbar</option></select></label><div className="text-[10px] font-bold uppercase text-slate-500">Filtros del informe<div className="mt-1 flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium normal-case text-slate-500">{widget.filters.length ? `${widget.filters.length} filtro(s) aplicados` : "Sin filtros"}</div></div></div>
          </div>
          <aside className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Vista previa</p><div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-4 py-2.5"><p className="text-[15px] font-semibold text-slate-900">{widget.title || "Sin título"}</p><p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-600">{widgetTypes.find((item) => item.type === widget.type)?.label} · {widget.source}</p><p className="mt-0.5 text-[11px] text-slate-400">{widget.metric}{widget.groupBy ? ` · ${widget.groupBy}` : ""}</p></div><div className="h-56 p-4"><WidgetPreview widget={widget} result={reportResult} /></div><div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-400">{widget.filters.length} filtro(s) · {reportResult?.totalRows ?? 0} registros</div></div></aside>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3"><button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600">Cancelar</button><button type="button" disabled={!widget.reportId} onClick={() => onSave({ ...widget, updatedAt: new Date().toISOString() })} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{initialWidget ? "Guardar cambios" : "Agregar widget"}</button></div>
      </div>
    </div>
  );
}
