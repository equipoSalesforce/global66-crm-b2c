export type DashboardWidgetType =
  | "kpi"
  | "table"
  | "list"
  | "bar-horizontal"
  | "bar-vertical"
  | "line"
  | "area"
  | "donut"
  | "pie"
  | "gauge"
  | "funnel"
  | "scatter"
  | "heatmap"
  | "stacked-bar"
  | "comparison";

export type DashboardVisibility = "private" | "shared" | "internal";

export type DashboardOwner = {
  id: string;
  name: string;
  initials: string;
};

export type DashboardFilterConfig = {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "between" | "is_empty" | "is_not_empty";
  value: string;
};

export type DashboardChartConfig = {
  showValues: boolean;
  showLegend: boolean;
  showXAxis: boolean;
  showYAxis: boolean;
  showGrid: boolean;
  showPercentage: boolean;
  sortDirection: "asc" | "desc";
  topN: number;
  accent: "blue" | "cyan" | "emerald" | "violet" | "amber";
  useReportChart: boolean;
  useReportTable: boolean;
  showReferenceLine: boolean;
  showUnits: boolean;
};

export type DashboardWidgetConfig = {
  id: string;
  reportId?: string;
  reportName?: string;
  title: string;
  description: string;
  type: DashboardWidgetType;
  source: string;
  metric: string;
  groupBy: string;
  xAxis: string;
  yAxis: string;
  filters: DashboardFilterConfig[];
  chartConfig: DashboardChartConfig;
  layout: { size: "small" | "medium" | "large" };
  updatedAt: string;
};

export type DashboardFolder = {
  id: string;
  name: string;
};

export type DashboardDefinition = {
  id: string;
  name: string;
  description: string;
  folderId: string;
  visibility: DashboardVisibility;
  owner: DashboardOwner;
  updatedAt: string;
  widgets: DashboardWidgetConfig[];
};

export const dashboardFolders: DashboardFolder[] = [
  { id: "all", name: "Todos" },
  { id: "mine", name: "Mis paneles" },
  { id: "cx", name: "Equipo CX" },
  { id: "operations", name: "Operación" },
  { id: "compliance", name: "Compliance" },
  { id: "automation", name: "IA y automatización" },
];

const defaultChartConfig: DashboardChartConfig = {
  showValues: true,
  showLegend: true,
  showXAxis: true,
  showYAxis: true,
  showGrid: true,
  showPercentage: false,
  sortDirection: "desc",
  topN: 5,
  accent: "blue",
  useReportChart: false,
  useReportTable: false,
  showReferenceLine: false,
  showUnits: true,
};

function widget(
  id: string,
  title: string,
  type: DashboardWidgetType,
  metric: string,
  groupBy: string,
  size: DashboardWidgetConfig["layout"]["size"] = "medium",
): DashboardWidgetConfig {
  const reportByWidget: Record<string, { id: string; name: string; source: string }> = {
    "open-cases": { id: "open-cases-priority", name: "Casos abiertos por prioridad", source: "Casos" },
    sla: { id: "open-cases-priority", name: "Casos abiertos por prioridad", source: "Casos" },
    channels: { id: "cases-by-channel", name: "Casos por canal", source: "Casos" },
    trend: { id: "cases-by-channel", name: "Casos por canal", source: "Casos" },
    agents: { id: "open-cases-priority", name: "Casos abiertos por prioridad", source: "Casos" },
    resolution: { id: "cases-by-channel", name: "Casos por canal", source: "Casos" },
    reopens: { id: "open-cases-priority", name: "Casos abiertos por prioridad", source: "Casos" },
    detail: { id: "open-cases-priority", name: "Casos abiertos por prioridad", source: "Casos" },
    alerts: { id: "accounts-by-segment", name: "Cuentas por segmento", source: "Cuentas" },
    funnel: { id: "accounts-by-segment", name: "Cuentas por segmento", source: "Cuentas" },
  };
  const report = reportByWidget[id];
  return {
    id,
    reportId: report?.id,
    reportName: report?.name,
    title,
    description: "Vista operativa actualizada automáticamente.",
    type,
    source: report?.source || "Informe de operación CRM",
    metric,
    groupBy,
    xAxis: groupBy,
    yAxis: metric,
    filters: [{ field: "periodo", operator: "equals", value: "Últimos 30 días" }],
    chartConfig: { ...defaultChartConfig },
    layout: { size },
    updatedAt: "2026-07-04T12:30:00.000Z",
  };
}

export const initialDashboards: DashboardDefinition[] = [
  {
    id: "operacion-cx",
    name: "Operación CX",
    description: "Seguimiento ejecutivo de volumen, SLA y canales de atención.",
    folderId: "cx",
    visibility: "internal",
    owner: { id: "owner-1", name: "Equipo Operaciones", initials: "EO" },
    updatedAt: "2026-07-04T12:30:00.000Z",
    widgets: [
      widget("open-cases", "Casos abiertos", "kpi", "Casos abiertos", "Estado", "small"),
      widget("sla", "Cumplimiento de SLA", "gauge", "% dentro de SLA", "Prioridad", "small"),
      widget("channels", "Casos por canal", "donut", "Cantidad de casos", "Canal"),
      widget("trend", "Evolución semanal", "line", "Casos creados", "Semana"),
      widget("agents", "Productividad por agente", "bar-horizontal", "Casos resueltos", "Agente", "large"),
    ],
  },
  {
    id: "calidad-servicio",
    name: "Calidad de servicio",
    description: "Indicadores de resolución, reaperturas y experiencia del cliente.",
    folderId: "operations",
    visibility: "shared",
    owner: { id: "owner-2", name: "María Soto", initials: "MS" },
    updatedAt: "2026-07-03T18:10:00.000Z",
    widgets: [
      widget("resolution", "Resolución en primer contacto", "comparison", "Tasa FCR", "Mes"),
      widget("reopens", "Motivos de reapertura", "bar-vertical", "Reaperturas", "Motivo"),
      widget("detail", "Detalle de casos críticos", "table", "Casos", "Prioridad", "large"),
    ],
  },
  {
    id: "compliance-monitor",
    name: "Monitoreo Compliance",
    description: "Alertas y revisiones que requieren seguimiento interno.",
    folderId: "compliance",
    visibility: "private",
    owner: { id: "owner-3", name: "Analista Compliance", initials: "AC" },
    updatedAt: "2026-07-02T09:45:00.000Z",
    widgets: [
      widget("alerts", "Alertas pendientes", "kpi", "Alertas", "Severidad", "small"),
      widget("funnel", "Flujo de revisión", "funnel", "Revisiones", "Etapa"),
    ],
  },
  {
    id: "automatizacion-ia",
    name: "IA y automatización",
    description: "Adopción de automatizaciones y resultados asistidos por IA.",
    folderId: "automation",
    visibility: "internal",
    owner: { id: "owner-1", name: "Equipo Operaciones", initials: "EO" },
    updatedAt: "2026-07-01T16:20:00.000Z",
    widgets: [],
  },
];

const STORAGE_KEY = "global66.crm.paneles.v1";
const FOLDERS_STORAGE_KEY = "global66.crm.panel-folders.v1";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function listDashboards(): DashboardDefinition[] {
  if (!canUseStorage()) return initialDashboards;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return initialDashboards;
  try {
    return JSON.parse(stored) as DashboardDefinition[];
  } catch {
    return initialDashboards;
  }
}

export function listDashboardFolders(): DashboardFolder[] {
  if (!canUseStorage()) return dashboardFolders;
  const stored = window.localStorage.getItem(FOLDERS_STORAGE_KEY);
  if (!stored) return dashboardFolders;
  try {
    return JSON.parse(stored) as DashboardFolder[];
  } catch {
    return dashboardFolders;
  }
}

export function createDashboardFolder(name: string) {
  const folder = { id: `folder-${Date.now()}`, name: name.trim() };
  const next = [...listDashboardFolders(), folder];
  window.localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(next));
  return folder;
}

export function getDashboard(id: string) {
  return listDashboards().find((dashboard) => dashboard.id === id) ?? null;
}

export function saveDashboard(dashboard: DashboardDefinition) {
  const dashboards = listDashboards();
  const existingIndex = dashboards.findIndex((item) => item.id === dashboard.id);
  const next = [...dashboards];
  if (existingIndex >= 0) next[existingIndex] = dashboard;
  else next.unshift(dashboard);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return dashboard;
}

export function deleteDashboard(id: string) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(listDashboards().filter((dashboard) => dashboard.id !== id)),
  );
}

export function duplicateDashboard(id: string) {
  const source = getDashboard(id);
  if (!source) return null;
  const copy = {
    ...source,
    id: `${source.id}-copy-${Date.now()}`,
    name: `${source.name} (copia)`,
    visibility: "private" as const,
    updatedAt: new Date().toISOString(),
    widgets: source.widgets.map((item) => ({ ...item, id: `${item.id}-${Date.now()}` })),
  };
  return saveDashboard(copy);
}

export function createWidgetDraft(): DashboardWidgetConfig {
  return widget(`widget-${Date.now()}`, "Nuevo widget", "kpi", "Casos", "Estado");
}
