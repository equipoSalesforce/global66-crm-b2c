"use client";

import { BarChart3, Clock3, Inbox, List, PieChart, RefreshCw, TrendingUp } from "lucide-react";
import type { SafeDashboardDefinition, SafeDashboardWidget, WidgetData } from "@/lib/analytics/semantic-layer";

const palette = ["var(--g66-brand-blue)", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316", "#64748b"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL").format(value);
}

function withOthers(series: WidgetData["series"], limit: number) {
  if (series.length <= limit) return series;
  const visible = series.slice(0, limit - 1);
  return [...visible, { label: "Otros", value: series.slice(limit - 1).reduce((sum, item) => sum + item.value, 0) }];
}

function EmptyWidget({ message = "Sin datos para los filtros actuales." }: { message?: string }) {
  return <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-slate-400"><Inbox className="h-6 w-6" /><p className="mt-2 text-xs font-semibold">{message}</p></div>;
}

function WidgetSkeleton() {
  return <div className="min-h-40 animate-pulse space-y-3"><div className="h-7 w-24 rounded bg-slate-100" /><div className="h-3 w-full rounded bg-slate-100" /><div className="h-3 w-4/5 rounded bg-slate-100" /><div className="h-3 w-2/3 rounded bg-slate-100" /></div>;
}

function BarWidget({ series }: { series: WidgetData["series"] }) {
  const visible = withOthers(series, 10);
  const total = visible.reduce((sum, item) => sum + item.value, 0) || 1;
  const max = Math.max(...visible.map((item) => item.value), 1);
  return <div className="space-y-3">{visible.map((item, index) => <div key={item.label}><div className="mb-1 flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-semibold text-slate-600">{item.label}</span><span className="shrink-0 font-black text-slate-800">{formatNumber(item.value)} <i className="font-medium not-italic text-slate-400">({Math.round(item.value / total * 100)}%)</i></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full min-w-1 rounded-full transition-[width]" style={{ width: `${item.value / max * 100}%`, backgroundColor: palette[index % palette.length] }} /></div></div>)}</div>;
}

function DonutWidget({ series }: { series: WidgetData["series"] }) {
  const visible = withOthers(series, 8);
  const total = visible.reduce((sum, item) => sum + item.value, 0) || 1;
  const segments = visible.reduce<{ offset: number; values: string[] }>((state, item, index) => {
    const nextOffset = state.offset + item.value / total * 100;
    return { offset: nextOffset, values: [...state.values, `${palette[index % palette.length]} ${state.offset}% ${nextOffset}%`] };
  }, { offset: 0, values: [] }).values;
  return <div className="grid items-center gap-5 sm:grid-cols-[150px_1fr]"><div className="relative mx-auto h-32 w-32 rounded-full shadow-inner" style={{ background: `conic-gradient(${segments.join(",")})` }}><span className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white shadow-sm"><strong className="text-xl font-black text-slate-950">{formatNumber(total)}</strong><small className="text-[9px] font-bold uppercase text-slate-400">casos</small></span></div><div className="space-y-2">{visible.map((item, index) => <div key={item.label} className="flex items-center justify-between gap-2 text-[11px]"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: palette[index % palette.length] }} /><span className="truncate font-semibold text-slate-600">{item.label}</span></span><strong className="shrink-0 text-slate-800">{formatNumber(item.value)} <i className="font-medium not-italic text-slate-400">{Math.round(item.value / total * 100)}%</i></strong></div>)}</div></div>;
}

function LineWidget({ series }: { series: WidgetData["series"] }) {
  const ordered = series.slice(-12);
  if (ordered.length < 2) return <EmptyWidget message="Se necesitan al menos dos períodos para mostrar una tendencia." />;
  const max = Math.max(...ordered.map((item) => item.value), 1);
  const x = (index: number) => 24 + index / (ordered.length - 1) * 352;
  const y = (value: number) => 118 - value / max * 88;
  const points = ordered.map((item, index) => `${x(index)},${y(item.value)}`).join(" ");
  return <svg viewBox="0 0 400 150" className="h-44 w-full" role="img" aria-label="Gráfico de tendencia">{[30, 60, 90, 120].map((lineY) => <line key={lineY} x1="20" x2="380" y1={lineY} y2={lineY} stroke="#e2e8f0" />)}<polyline points={`24,120 ${points} 376,120`} fill="var(--g66-brand-blue-soft)" opacity="0.65" stroke="none" /><polyline points={points} fill="none" stroke="var(--g66-brand-blue)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />{ordered.map((item, index) => <g key={`${item.label}-${index}`}><circle cx={x(index)} cy={y(item.value)} r="4" fill="white" stroke="var(--g66-brand-blue)" strokeWidth="2" /><text x={x(index)} y="143" textAnchor="middle" fontSize="9" fill="#64748b">{item.label.slice(0, 9)}</text></g>)}</svg>;
}

function TableWidget({ data }: { data: WidgetData }) {
  const visible = withOthers(data.rows, 15);
  return <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-2.5">Dimensión</th><th className="px-3 py-2.5 text-right">Casos</th></tr></thead><tbody>{visible.map((row, index) => <tr key={row.label} className={index % 2 ? "bg-slate-50/60" : "bg-white"}><td className="px-3 py-2.5 font-semibold text-slate-600">{row.label}</td><td className="px-3 py-2.5 text-right font-black text-slate-900">{formatNumber(row.value)}</td></tr>)}</tbody><tfoot className="border-t border-slate-200 bg-slate-50"><tr><td className="px-3 py-2.5 font-black text-slate-600">Total</td><td className="px-3 py-2.5 text-right font-black text-slate-950">{formatNumber(data.total)}</td></tr></tfoot></table></div>;
}

function WidgetBody({ widget, data, loading }: { widget: SafeDashboardWidget; data?: WidgetData; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;
  if (!data || (!data.total && !data.series.length)) return <EmptyWidget />;
  if (widget.type === "kpi") return <div className="flex min-h-40 flex-col justify-center"><p className="text-5xl font-black tracking-tight text-slate-950">{formatNumber(data.total)}</p><div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />Resultado actualizado con datos del CRM</div></div>;
  if (widget.type === "bar") return <BarWidget series={data.series} />;
  if (widget.type === "donut") return <DonutWidget series={data.series} />;
  if (widget.type === "line") return <LineWidget series={data.series} />;
  return <TableWidget data={data} />;
}

function WidgetIcon({ type }: { type: SafeDashboardWidget["type"] }) {
  const Icon = type === "donut" ? PieChart : type === "line" ? TrendingUp : type === "table" ? List : BarChart3;
  return <Icon className="h-4 w-4" />;
}

export function AiDashboardRenderer({ definition, data, loading = false }: { definition: SafeDashboardDefinition; data: WidgetData[]; loading?: boolean }) {
  const period = (definition.filters.period ?? "ALL_TIME").replaceAll("_", " ");
  return <div className="space-y-3"><div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-bold text-slate-600"><span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-blue-700"><Clock3 className="h-3 w-3" />Período: {period}</span><span className="rounded-full bg-slate-100 px-3 py-1">Fecha base: {definition.filters.dateField ?? "created_at"}</span>{loading ? <span className="ml-auto inline-flex items-center gap-1.5 text-blue-600"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Actualizando datos</span> : null}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{definition.widgets.map((widget) => <article key={widget.id} className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${widget.type === "table" || widget.type === "line" ? "md:col-span-2" : ""}`}><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5"><div><h3 className="font-black text-slate-900">{widget.title}</h3><p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{widget.metric}{widget.dimension ? ` · ${widget.dimension}` : ""}</p></div><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><WidgetIcon type={widget.type} /></span></header><div className="p-4"><WidgetBody widget={widget} data={data.find((item) => item.widgetId === widget.id)} loading={loading} /></div><footer className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">Fuente: casos CRM · Agregación semántica segura</footer></article>)}</div></div>;
}
