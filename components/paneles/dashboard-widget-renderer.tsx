"use client";

import type { ReportRunColumn, ReportRunResult } from "@/lib/informes-engine";
import type { DashboardWidgetConfig } from "@/lib/paneles-api";
import Link from "next/link";
import { DASHBOARD_CHART_COLORS, WidgetEmptyState, WidgetLegend } from "./dashboard-widget-shell";

const palette = DASHBOARD_CHART_COLORS;
const formatNumber = (value: number) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value);

function formatCell(value: string | number | boolean | null, column?: ReportRunColumn) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return new Intl.NumberFormat("es-CL", { minimumFractionDigits: column?.type === "currency" ? 2 : 0, maximumFractionDigits: 2 }).format(value);
  return String(value);
}

function WidgetKpi({ result, widget }: { result: ReportRunResult; widget: DashboardWidgetConfig }) {
  const value = result.metricValue ?? result.totalRows;
  return <div className="flex h-full min-h-40 flex-col justify-center rounded-xl bg-gradient-to-br from-blue-50 to-white p-5"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-blue-600">{widget.metric}</p><p className="mt-2 text-4xl font-black tracking-tight text-slate-950">{formatNumber(value)}</p><div className="mt-3 flex items-center gap-2 text-[9px]"><span className="rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700">{result.totalRows} registros</span><span className="text-slate-400">Fuente: {widget.source}</span></div></div>;
}

function WidgetTable({ result, compact, reportId }: { result: ReportRunResult; compact: boolean; reportId?: string }) {
  const columns = result.columns.slice(0, compact ? 4 : 6);
  const visibleRows = result.rows.slice(0, compact ? 5 : 8);
  return <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200"><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[440px] text-left"><thead className="sticky top-0 z-[1] bg-slate-50 text-[9px] font-semibold uppercase tracking-wide text-slate-400"><tr>{columns.map((column) => <th key={column.key} className="px-2.5 py-1.5">{column.label}</th>)}</tr></thead><tbody>{visibleRows.map((row, index) => <tr key={index} className="border-t border-slate-100 text-[10px] text-slate-600 hover:bg-blue-50/30">{columns.map((column) => <td key={column.key} className="max-w-40 truncate px-2.5 py-1.5 font-medium">{formatCell(row[column.key], column)}</td>)}</tr>)}</tbody></table></div>{result.totalRows > visibleRows.length ? <Link href={reportId ? `/informes/${reportId}` : "/informes"} className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-right text-[10px] font-semibold text-blue-600 hover:underline">Ver informe</Link> : null}</div>;
}

function WidgetList({ result }: { result: ReportRunResult }) {
  const [primary, secondary, tertiary] = result.columns;
  return <ul className="h-full divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200 bg-white">{result.rows.slice(0, 8).map((row, index) => <li key={index} className="flex items-center gap-3 px-3 py-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[9px] font-black text-blue-600">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-slate-700">{formatCell(row[primary?.key], primary)}</p><p className="truncate text-[9px] text-slate-400">{formatCell(row[secondary?.key], secondary)}</p></div>{tertiary ? <span className="max-w-24 truncate rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold text-slate-600">{formatCell(row[tertiary.key], tertiary)}</span> : null}</li>)}</ul>;
}

function WidgetVerticalBar({ data, showLegend }: { data: Array<{ label: string; value: number }>; showLegend: boolean }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const scaleMax = max * 1.15;
  return <div className="flex h-full flex-col"><div className="relative min-h-32 flex-1 border-b border-l border-slate-200 pl-8 pt-3"><div className="pointer-events-none absolute inset-0 left-0 flex flex-col justify-between pb-5 text-[8px] text-slate-300">{[100, 75, 50, 25].map((tick) => <div key={tick} className="flex items-center gap-1"><span className="w-7 text-right">{formatNumber(scaleMax * tick / 100)}</span><span className="h-px flex-1 bg-slate-100" /></div>)}</div><div className={`relative z-[1] mx-auto flex h-full items-end justify-center gap-3 px-3 ${data.length <= 2 ? "max-w-sm" : "w-full"}`}>{data.slice(0, 8).map((item, index) => <div key={item.label} className="flex h-full min-w-12 max-w-20 flex-1 flex-col justify-end text-center"><span className="mb-1 text-[9px] font-semibold text-slate-600">{formatNumber(item.value)}</span><span className="mx-auto w-full max-w-12 rounded-t opacity-90" style={{ height: `${Math.max(5, item.value / scaleMax * 76)}%`, backgroundColor: palette[index % palette.length] }} /><span className="mt-1 truncate text-[9px] text-slate-400" title={item.label}>{item.label}</span></div>)}</div></div>{showLegend ? <div className="mt-2"><WidgetLegend data={data} /></div> : null}</div>;
}

function WidgetHorizontalBar({ data, showLegend }: { data: Array<{ label: string; value: number }>; showLegend: boolean }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div className="flex h-full flex-col"><div className="space-y-1.5 overflow-auto">{data.slice(0, 8).map((item, index) => <div key={item.label} className="grid grid-cols-[88px_1fr_42px] items-center gap-2 text-[10px]"><span className="truncate font-medium text-slate-500" title={item.label}>{item.label}</span><span className="h-3.5 overflow-hidden rounded bg-slate-100"><span className="block h-full rounded" style={{ width: `${Math.max(3, item.value / max * 100)}%`, backgroundColor: palette[index % palette.length] }} /></span><strong className="text-right text-slate-700">{formatNumber(item.value)}</strong></div>)}</div>{showLegend ? <div className="mt-2 border-t border-slate-100 pt-2"><WidgetLegend data={data} /></div> : null}</div>;
}

function WidgetDonutChart({ data, pie, showLegend }: { data: Array<{ label: string; value: number }>; pie: boolean; showLegend: boolean }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const gradient = data.reduce<{ offset: number; segments: string[] }>((state, item, index) => { const next = state.offset + item.value / total * 100; return { offset: next, segments: [...state.segments, `${palette[index % palette.length]} ${state.offset}% ${next}%`] }; }, { offset: 0, segments: [] }).segments.join(", ");
  return <div className="grid h-full items-center gap-3 sm:grid-cols-[132px_1fr]"><div className="relative mx-auto h-28 w-28 rounded-full shadow-inner" style={{ background: `conic-gradient(${gradient})` }}>{!pie ? <span className="absolute inset-6 rounded-full bg-white shadow-inner" /> : null}<span className={`absolute inset-0 m-auto flex flex-col items-center justify-center ${pie ? "h-12 w-18 rounded-lg bg-white/90 shadow-sm" : ""}`}><strong className="text-[22px] font-bold text-slate-900">{formatNumber(total)}</strong><span className="text-[9px] font-semibold uppercase text-slate-400">Total</span></span></div>{showLegend ? <WidgetLegend data={data} /> : null}</div>;
}

function WidgetLineChart({ data, area, showLegend }: { data: Array<{ label: string; value: number }>; area: boolean; showLegend: boolean }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const scaleMax = max * 1.15;
  const coordinates = data.map((item, index) => ({ ...item, x: data.length === 1 ? 300 : 45 + index / (data.length - 1) * 515, y: 135 - item.value / scaleMax * 105 }));
  const points = coordinates.map((item) => `${item.x},${item.y}`).join(" ");
  return <div className="flex h-full flex-col"><div className="min-h-32 flex-1"><svg viewBox="0 0 600 170" preserveAspectRatio="xMidYMid meet" className="h-full w-full">{[30, 65, 100, 135].map((y) => <line key={y} x1="38" y1={y} x2="570" y2={y} stroke="#e7ebf1" strokeWidth="1" />)}{area ? <polygon points={`45,135 ${points} 560,135`} fill="#2f6fec16" /> : null}<polyline points={points} fill="none" stroke="#2f6fec" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />{coordinates.map((item) => <g key={item.label}><circle cx={item.x} cy={item.y} r="4" fill="white" stroke="#2f6fec" strokeWidth="2.5" /><text x={item.x} y={item.y - 9} textAnchor="middle" fontSize="11" fontWeight="600" fill="#475569">{formatNumber(item.value)}</text><text x={item.x} y="155" textAnchor="middle" fontSize="10" fill="#94a3b8">{item.label.slice(0, 14)}</text></g>)}</svg></div>{data.length <= 2 ? <div className="mb-1 grid grid-cols-2 gap-2">{data.map((item, index) => <div key={item.label} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-[10px]"><span className="truncate text-slate-500">{item.label}</span><strong style={{ color: palette[index] }}>{formatNumber(item.value)}</strong></div>)}</div> : null}{showLegend ? <WidgetLegend data={data} /> : null}</div>;
}

function WidgetGauge({ result, widget }: { result: ReportRunResult; widget: DashboardWidgetConfig }) {
  const value = result.metricValue ?? 0;
  const target = Math.max(result.totalRows, value, 1);
  const percentage = Math.min(100, value / target * 100);
  const angle = Math.PI * percentage / 100;
  const endX = 100 - Math.cos(angle) * 80;
  const endY = 95 - Math.sin(angle) * 80;
  return <div className="flex h-full flex-col items-center justify-center"><svg viewBox="0 0 200 105" className="h-24 w-48"><path d="M20 95 A80 80 0 0 1 180 95" fill="none" stroke="#e7ebf1" strokeWidth="15" strokeLinecap="round" /><path d={`M20 95 A80 80 0 0 1 ${endX} ${endY}`} fill="none" stroke="#2f6fec" strokeWidth="15" strokeLinecap="round" /><text x="100" y="78" textAnchor="middle" fontSize="28" fontWeight="700" fill="#0f172a">{Math.round(percentage)}%</text><text x="100" y="98" textAnchor="middle" fontSize="10" fill="#64748b">{formatNumber(value)} de {formatNumber(target)}</text></svg><p className="text-[11px] font-semibold text-slate-600">{widget.metric}</p><p className="mt-0.5 text-[10px] text-slate-400">{percentage >= 80 ? "En rango esperado" : "Bajo la referencia"}</p></div>;
}

function WidgetFunnel({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div className="flex h-full flex-col items-center justify-center gap-1.5">{data.slice(0, 7).map((item, index) => <div key={item.label} className="flex h-7 items-center justify-between rounded px-3 text-[9px] font-bold text-white shadow-sm" style={{ width: `${Math.max(35, item.value / max * 100 - index * 2)}%`, backgroundColor: palette[index % palette.length] }}><span className="truncate">{item.label}</span><span>{formatNumber(item.value)}</span></div>)}</div>;
}

function WidgetHeatmap({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div className="grid h-full grid-cols-3 gap-2">{data.slice(0, 9).map((item) => <div key={item.label} className="flex min-h-16 flex-col items-center justify-center rounded-lg text-center text-white shadow-sm" style={{ backgroundColor: "#2563eb", opacity: Math.max(0.28, item.value / max) }}><strong className="text-sm">{formatNumber(item.value)}</strong><span className="mt-0.5 max-w-full truncate px-2 text-[8px]">{item.label}</span></div>)}</div>;
}

function WidgetComparison({ data }: { data: Array<{ label: string; value: number }> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  return <div className="grid h-full grid-cols-2 gap-2">{data.slice(0, 4).map((item, index) => <div key={item.label} className="flex flex-col justify-center rounded-lg border border-slate-100 bg-slate-50/80 p-2.5"><div className="flex items-center justify-between gap-2"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: palette[index % palette.length] }} /><span className="text-[10px] font-semibold text-slate-400">{Math.round(item.value / total * 100)}%</span></div><p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(item.value)}</p><p className="truncate text-[10px] font-medium text-slate-500">{item.label}</p><span className="mt-2 h-1 overflow-hidden rounded bg-slate-200"><span className="block h-full rounded" style={{ width: `${item.value / total * 100}%`, backgroundColor: palette[index % palette.length] }} /></span></div>)}</div>;
}

function WidgetScatter({ data, showLegend }: { data: Array<{ label: string; value: number }>; showLegend: boolean }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div className="flex h-full flex-col"><div className="relative min-h-32 flex-1 border-b border-l border-slate-200 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:25%_25%]">{data.slice(0, 12).map((item, index) => <span key={item.label} title={`${item.label}: ${item.value}`} className="absolute flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white shadow" style={{ left: `${6 + index / Math.max(1, data.length - 1) * 86}%`, bottom: `${8 + item.value / max * 78}%`, backgroundColor: palette[index % palette.length] }}><span className="sr-only">{item.label}</span></span>)}</div>{showLegend ? <div className="mt-2"><WidgetLegend data={data} /></div> : null}</div>;
}

export function DashboardWidgetRenderer({ widget, result, compact = false }: { widget: DashboardWidgetConfig; result?: ReportRunResult; compact?: boolean }) {
  const hasData = Boolean(result && (result.chartData.length || result.rows.length || result.groups.length));
  if (!result || !hasData) return <WidgetEmptyState />;
  const data = result.chartData.slice(0, Math.max(1, widget.chartConfig.topN));
  const showLegend = widget.chartConfig.showLegend !== false;
  if (widget.type === "kpi") return <WidgetKpi result={result} widget={widget} />;
  if (widget.type === "table") return <WidgetTable result={result} compact={compact} reportId={widget.reportId} />;
  if (widget.type === "list") return <WidgetList result={result} />;
  if (widget.type === "bar-horizontal") return <WidgetHorizontalBar data={data} showLegend={showLegend} />;
  if (["bar-vertical", "stacked-bar"].includes(widget.type)) return <WidgetVerticalBar data={data} showLegend={showLegend} />;
  if (["donut", "pie"].includes(widget.type)) return <WidgetDonutChart data={data} pie={widget.type === "pie"} showLegend={showLegend} />;
  if (["line", "area"].includes(widget.type)) return <WidgetLineChart data={data} area={widget.type === "area"} showLegend={showLegend} />;
  if (widget.type === "gauge") return <WidgetGauge result={result} widget={widget} />;
  if (widget.type === "funnel") return <WidgetFunnel data={data} />;
  if (widget.type === "heatmap") return <WidgetHeatmap data={data} />;
  if (widget.type === "comparison") return <WidgetComparison data={data} />;
  if (widget.type === "scatter") return <WidgetScatter data={data} showLegend={showLegend} />;
  return <WidgetVerticalBar data={data} showLegend={showLegend} />;
}
