export const allowedMetricKeys = [
  "total_cases",
  "active_cases",
  "resolved_cases",
  "closed_cases",
  "merged_cases",
  "waiting_agent_response",
  "no_agent_activity",
  "no_customer_activity",
  "cases_in_risk",
  "stand_by_cases",
  "cases_by_owner",
  "cases_by_customer",
  "cases_by_channel",
  "cases_by_priority",
  "cases_by_response_status",
] as const;

export const allowedDimensionKeys = [
  "owner",
  "customer",
  "channel",
  "priority",
  "lifecycle_status",
  "response_status",
  "area",
  "product",
  "created_day",
  "created_week",
  "created_month",
  "closed_month",
] as const;

export const allowedWidgetTypes = ["kpi", "bar", "line", "donut", "table"] as const;
export const allowedPeriods = ["ALL_TIME", "THIS_MONTH", "LAST_7_DAYS", "LAST_30_DAYS"] as const;
export const allowedFilterTypes = [
  "date_range",
  "this_month",
  "last_7_days",
  "last_30_days",
  "lifecycle_status",
  "response_status",
  "owner",
  "customer",
  "channel",
  "priority",
  "area",
  "product",
] as const;

export type AnalyticsMetricKey = (typeof allowedMetricKeys)[number];
export type AnalyticsDimensionKey = (typeof allowedDimensionKeys)[number];
export type DashboardWidgetType = (typeof allowedWidgetTypes)[number];
export type DashboardPeriod = (typeof allowedPeriods)[number];

export type DashboardFilters = {
  period?: DashboardPeriod;
  dateField?: "created_at" | "closed_at";
  lifecycle_status?: string;
  response_status?: string;
  owner?: string;
  customer?: string;
  channel?: string;
  priority?: string;
  area?: string;
  product?: string;
};

export type SafeDashboardWidget = {
  id: string;
  type: DashboardWidgetType;
  title: string;
  metric: AnalyticsMetricKey;
  dimension?: AnalyticsDimensionKey;
  filters?: DashboardFilters;
};

export type SafeDashboardDefinition = {
  title: string;
  description: string;
  filters: DashboardFilters;
  widgets: SafeDashboardWidget[];
};

export type WidgetData = {
  widgetId: string;
  type: DashboardWidgetType;
  total: number;
  series: Array<{ label: string; value: number }>;
  rows: Array<{ label: string; value: number }>;
};

type MetricDefinition = {
  label: string;
  defaultDimension?: AnalyticsDimensionKey;
};

export const metricDefinitions: Record<AnalyticsMetricKey, MetricDefinition> = {
  total_cases: { label: "Total de casos" },
  active_cases: { label: "Casos activos" },
  resolved_cases: { label: "Casos resueltos" },
  closed_cases: { label: "Casos cerrados" },
  merged_cases: { label: "Casos fusionados" },
  waiting_agent_response: { label: "Esperando respuesta" },
  no_agent_activity: { label: "Sin actividad agente" },
  no_customer_activity: { label: "Sin actividad cliente" },
  cases_in_risk: { label: "Casos en riesgo" },
  stand_by_cases: { label: "Casos en stand by" },
  cases_by_owner: { label: "Casos por ejecutivo", defaultDimension: "owner" },
  cases_by_customer: { label: "Casos por cliente", defaultDimension: "customer" },
  cases_by_channel: { label: "Casos por canal", defaultDimension: "channel" },
  cases_by_priority: { label: "Casos por prioridad", defaultDimension: "priority" },
  cases_by_response_status: { label: "Casos por estado de respuesta", defaultDimension: "response_status" },
};

const allowedDefinitionFilterFields = new Set([
  "period",
  "dateField",
  "lifecycle_status",
  "response_status",
  "owner",
  "customer",
  "channel",
  "priority",
  "area",
  "product",
]);
const allowedDefinitionKeys = new Set(["title", "description", "filters", "widgets"]);
const allowedWidgetKeys = new Set(["id", "type", "title", "metric", "dimension", "filters"]);
const forbiddenKeyPattern = /sql|query|table|column|select|from|join|where/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: Set<string>, scope: string) {
  const invalid = Object.keys(value).find((key) => !allowed.has(key) || forbiddenKeyPattern.test(key));
  if (invalid) throw new Error(`${scope} contiene el campo no permitido “${invalid}”.`);
}

function validateTitle(value: unknown, scope: string) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 120) {
    throw new Error(`${scope} debe tener entre 1 y 120 caracteres.`);
  }
  return value.trim();
}

export function validateDashboardFilters(value: unknown): DashboardFilters {
  if (value == null) return {};
  if (!isObject(value)) throw new Error("Los filtros del dashboard no son válidos.");
  assertAllowedKeys(value, allowedDefinitionFilterFields, "Filtros");
  const filters = { ...value } as Record<string, unknown>;
  if (filters.period != null && !allowedPeriods.includes(filters.period as DashboardPeriod)) {
    throw new Error("El período solicitado no está permitido.");
  }
  if (filters.dateField != null && !["created_at", "closed_at"].includes(String(filters.dateField))) {
    throw new Error("El campo de fecha no está permitido.");
  }
  for (const [key, filterValue] of Object.entries(filters)) {
    if (!["period", "dateField"].includes(key) && typeof filterValue !== "string") {
      throw new Error(`El filtro ${key} debe ser texto.`);
    }
  }
  return filters as DashboardFilters;
}

export function validateDashboardDefinition(value: unknown): SafeDashboardDefinition {
  if (!isObject(value)) throw new Error("La definición del dashboard debe ser un objeto JSON.");
  assertAllowedKeys(value, allowedDefinitionKeys, "Dashboard");
  if (!Array.isArray(value.widgets) || value.widgets.length < 1 || value.widgets.length > 8) {
    throw new Error("El dashboard debe tener entre 1 y 8 widgets.");
  }
  const widgets = value.widgets.map((rawWidget, index): SafeDashboardWidget => {
    if (!isObject(rawWidget)) throw new Error(`El widget ${index + 1} no es válido.`);
    assertAllowedKeys(rawWidget, allowedWidgetKeys, `Widget ${index + 1}`);
    if (!allowedWidgetTypes.includes(rawWidget.type as DashboardWidgetType)) {
      throw new Error(`El tipo del widget ${index + 1} no está permitido.`);
    }
    if (!allowedMetricKeys.includes(rawWidget.metric as AnalyticsMetricKey)) {
      throw new Error(`La métrica del widget ${index + 1} no está permitida.`);
    }
    if (rawWidget.dimension != null && !allowedDimensionKeys.includes(rawWidget.dimension as AnalyticsDimensionKey)) {
      throw new Error(`La dimensión del widget ${index + 1} no está permitida.`);
    }
    const metric = rawWidget.metric as AnalyticsMetricKey;
    const type = rawWidget.type as DashboardWidgetType;
    const dimension = type === "kpi"
      ? undefined
      : (rawWidget.dimension as AnalyticsDimensionKey | undefined) ?? metricDefinitions[metric].defaultDimension;
    if (type !== "kpi" && !dimension) throw new Error(`El widget ${index + 1} requiere una dimensión permitida.`);
    return {
      id: typeof rawWidget.id === "string" && /^[a-z0-9_-]{1,64}$/i.test(rawWidget.id)
        ? rawWidget.id
        : `widget_${index + 1}`,
      type,
      title: validateTitle(rawWidget.title, `El título del widget ${index + 1}`),
      metric,
      ...(type !== "kpi" && dimension ? { dimension } : {}),
      filters: validateDashboardFilters(rawWidget.filters),
    };
  });
  if (new Set(widgets.map((widget) => widget.id)).size !== widgets.length) {
    throw new Error("Los identificadores de widgets deben ser únicos.");
  }
  return {
    title: validateTitle(value.title, "El título del dashboard"),
    description: typeof value.description === "string" ? value.description.trim().slice(0, 500) : "",
    filters: validateDashboardFilters(value.filters),
    widgets,
  };
}

export function promptContainsSql(prompt: string) {
  return /\b(select|insert|update|delete|drop|alter|create)\b[\s\S]{0,80}\b(from|into|table|where|join)\b/i.test(prompt);
}
