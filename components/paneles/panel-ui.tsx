"use client";

import type { ReportRunResult } from "@/lib/informes-engine";
import type { DashboardVisibility, DashboardWidgetConfig, DashboardWidgetType } from "@/lib/paneles-api";
import {
  AreaChart,
  BarChart3,
  ChartPie,
  CircleGauge,
  Columns3,
  GitCompareArrows,
  Grid3X3,
  LineChart,
  List,
  Rows3,
  ScatterChart,
  Table2,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { DashboardWidgetRenderer } from "./dashboard-widget-renderer";
import { WidgetChartContainer } from "./dashboard-widget-shell";

export const widgetTypes: Array<{ type: DashboardWidgetType; label: string; icon: LucideIcon }> = [
  { type: "kpi", label: "KPI / Número", icon: CircleGauge },
  { type: "table", label: "Tabla", icon: Table2 },
  { type: "list", label: "Lista", icon: List },
  { type: "bar-horizontal", label: "Barra horizontal", icon: Rows3 },
  { type: "bar-vertical", label: "Barra vertical", icon: BarChart3 },
  { type: "line", label: "Línea", icon: LineChart },
  { type: "area", label: "Área", icon: AreaChart },
  { type: "donut", label: "Dona", icon: ChartPie },
  { type: "pie", label: "Pie", icon: ChartPie },
  { type: "gauge", label: "Gauge / Medidor", icon: CircleGauge },
  { type: "funnel", label: "Funnel", icon: TrendingDown },
  { type: "scatter", label: "Dispersión", icon: ScatterChart },
  { type: "heatmap", label: "Heatmap", icon: Grid3X3 },
  { type: "stacked-bar", label: "Barra apilada", icon: Columns3 },
  { type: "comparison", label: "Comparativo", icon: GitCompareArrows },
];

export const visibilityLabels: Record<DashboardVisibility, string> = {
  private: "Privado",
  shared: "Compartido",
  internal: "Público interno",
};

export function PanelVisibilityBadge({ visibility }: { visibility: DashboardVisibility }) {
  const styles = { private: "bg-slate-100 text-slate-600", shared: "bg-violet-50 text-violet-700", internal: "bg-emerald-50 text-emerald-700" }[visibility];
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${styles}`}>{visibilityLabels[visibility]}</span>;
}

export function WidgetChartTypeSelector({ value, onChange }: { value: DashboardWidgetType; onChange: (type: DashboardWidgetType) => void }) {
  return <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">{widgetTypes.map(({ type, label, icon: Icon }) => <button key={type} type="button" onClick={() => onChange(type)} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-1.5 text-center text-[9px] font-bold transition ${value === type ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}><Icon className="h-4 w-4" /> {label}</button>)}</div>;
}

export function WidgetPreview({ widget, result, compact = false }: { widget: DashboardWidgetConfig; result?: ReportRunResult; compact?: boolean }) {
  return <WidgetChartContainer><DashboardWidgetRenderer widget={widget} result={result} compact={compact} /></WidgetChartContainer>;
}
