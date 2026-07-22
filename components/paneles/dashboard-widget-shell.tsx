"use client";

import type { ReactNode } from "react";

export const DASHBOARD_CHART_COLORS = ["var(--g66-brand-blue)", "#2c9b6f", "#7556d8", "#e58a3a", "#d66767", "#64748b", "#2395ad", "#ba9238"] as const;

export function WidgetLegend({ data, showPercentage = true }: { data: Array<{ label: string; value: number }>; showPercentage?: boolean }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">{data.slice(0, 8).map((item, index) => <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5 text-[10px]"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length] }} /><span className="min-w-0 flex-1 truncate text-slate-500">{item.label}</span><strong className="font-semibold text-slate-700">{new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(item.value)}</strong>{showPercentage && total > 0 ? <span className="w-8 text-right text-slate-400">{Math.round(item.value / total * 100)}%</span> : null}</div>)}</div>;
}

export function WidgetEmptyState() {
  return <div className="flex h-full min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base text-slate-300 shadow-sm">∿</span><p className="mt-1.5 text-[11px] font-semibold text-slate-500">Sin datos disponibles</p><p className="text-[10px] text-slate-400">Revisa los filtros o la fuente del informe.</p></div>;
}

export function WidgetChartContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`h-full min-h-0 w-full overflow-hidden ${className}`}>{children}</div>;
}

export function WidgetHeader({ title, subtitle, detail, action }: { title: string; subtitle: string; detail: string; action: ReactNode }) {
  return <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5"><div className="min-w-0"><h2 className="truncate text-[15px] font-semibold leading-5 text-slate-900">{title}</h2><p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-blue-600">{subtitle}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{detail}</p></div>{action}</header>;
}

export function WidgetFooter({ filters, totalRows, updatedAt }: { filters: number; totalRows: number; updatedAt: string }) {
  return <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] text-slate-400"><span>{filters} filtro(s) · {totalRows} registros</span><span>Actualizado: {updatedAt}</span></footer>;
}

export function DashboardWidgetShell({ children, header, footer, wide = false }: { children: ReactNode; header: ReactNode; footer: ReactNode; wide?: boolean }) {
  return <article className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgb(15_23_42/0.045)] ${wide ? "md:col-span-2" : ""}`}>{header}{children}{footer}</article>;
}
