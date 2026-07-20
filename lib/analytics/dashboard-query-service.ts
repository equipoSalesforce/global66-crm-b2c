import "server-only";

import { supabase } from "@/lib/supabase";
import {
  metricDefinitions,
  validateDashboardDefinition,
  type AnalyticsDimensionKey,
  type AnalyticsMetricKey,
  type DashboardFilters,
  type SafeDashboardDefinition,
  type WidgetData,
} from "@/lib/analytics/semantic-layer";

type AnalyticsCase = {
  id: string;
  customer_id: string | null;
  channel: string | null;
  priority: string | null;
  lifecycle_status: string | null;
  response_status: string | null;
  area: string | null;
  product: string | null;
  assigned_agent_id: string | null;
  assigned_to: string | null;
  is_merged: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  contact_name: string | null;
  contact_email: string | null;
  customer: { name: string | null; email: string | null } | null;
};

type AnalyticsAgent = { id: string; name: string | null; email: string | null };
type DimensionBucket = { key: string; label: string; chronological: boolean };

const PAGE_SIZE = 1000;
const terminalStatuses = new Set(["RESOLVED", "CLOSED", "MERGED"]);
const metricPredicates: Record<AnalyticsMetricKey, (item: AnalyticsCase) => boolean> = {
  total_cases: () => true,
  active_cases: (item) => !terminalStatuses.has(item.lifecycle_status?.toUpperCase() ?? ""),
  resolved_cases: (item) => item.lifecycle_status?.toUpperCase() === "RESOLVED",
  closed_cases: (item) => item.lifecycle_status?.toUpperCase() === "CLOSED",
  merged_cases: (item) => item.lifecycle_status?.toUpperCase() === "MERGED" || item.is_merged === true,
  waiting_agent_response: (item) => item.response_status === "WAITING_AGENT_RESPONSE",
  no_agent_activity: (item) => item.response_status === "NO_AGENT_ACTIVITY",
  no_customer_activity: (item) => item.response_status === "NO_CUSTOMER_ACTIVITY_24H",
  cases_in_risk: (item) => item.priority?.toUpperCase() === "HIGH" && !terminalStatuses.has(item.lifecycle_status?.toUpperCase() ?? ""),
  stand_by_cases: (item) => item.lifecycle_status?.toUpperCase() === "STAND_BY",
  cases_by_owner: () => true,
  cases_by_customer: () => true,
  cases_by_channel: () => true,
  cases_by_priority: () => true,
  cases_by_response_status: () => true,
};

function dateWindow(period: DashboardFilters["period"]) {
  if (!period || period === "ALL_TIME") return null;
  const now = new Date();
  if (period === "THIS_MONTH") {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    };
  }
  const days = period === "LAST_7_DAYS" ? 7 : 30;
  return { start: new Date(Date.now() - days * 24 * 60 * 60 * 1000), end: null };
}

function effectiveDate(item: AnalyticsCase, dateField: DashboardFilters["dateField"]) {
  if (dateField === "closed_at") return item.closed_at ?? item.updated_at ?? item.created_at;
  return item.created_at;
}

function matchesFilters(item: AnalyticsCase, filters: DashboardFilters) {
  const window = dateWindow(filters.period);
  if (window) {
    const value = effectiveDate(item, filters.dateField ?? "created_at");
    if (!value) return false;
    const timestamp = new Date(value);
    if (timestamp < window.start || (window.end && timestamp >= window.end)) return false;
  }
  const normalized = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";
  if (filters.lifecycle_status && normalized(item.lifecycle_status) !== normalized(filters.lifecycle_status)) return false;
  if (filters.response_status && normalized(item.response_status) !== normalized(filters.response_status)) return false;
  if (filters.channel && normalized(item.channel) !== normalized(filters.channel)) return false;
  if (filters.priority && normalized(item.priority) !== normalized(filters.priority)) return false;
  if (filters.area && normalized(item.area) !== normalized(filters.area)) return false;
  if (filters.product && normalized(item.product) !== normalized(filters.product)) return false;
  if (filters.owner && ![item.assigned_agent_id, item.assigned_to].some((value) => normalized(value) === normalized(filters.owner))) return false;
  if (filters.customer && ![item.customer_id, item.customer?.name, item.customer?.email].some((value) => normalized(value) === normalized(filters.customer))) return false;
  return true;
}

function dateLabel(value: string | null, mode: "day" | "week" | "month") {
  if (!value) return { key: "missing", label: "Sin fecha", chronological: true };
  const date = new Date(value);
  if (mode === "week") {
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 1);
  }
  const key = mode === "month"
    ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    : date.toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat("es-CL", mode === "month"
    ? { month: "short", year: "2-digit", timeZone: "UTC" }
    : { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
  return { key, label: mode === "week" ? `Sem ${label}` : label, chronological: true };
}

function ownerLabel(item: AnalyticsCase, agents: Map<string, string>) {
  const agent = (item.assigned_agent_id ? agents.get(String(item.assigned_agent_id).toLowerCase()) : null)
    || (item.assigned_to ? agents.get(item.assigned_to.toLowerCase()) : null);
  return agent || item.assigned_to?.trim() || "Sin ejecutivo";
}

function customerLabel(item: AnalyticsCase) {
  return item.customer?.name?.trim()
    || item.contact_name?.trim()
    || item.customer?.email?.trim()
    || item.contact_email?.trim()
    || "Sin cliente";
}

function dimensionBucket(item: AnalyticsCase, dimension: AnalyticsDimensionKey, agents: Map<string, string>): DimensionBucket {
  if (dimension === "created_day") return dateLabel(item.created_at, "day");
  if (dimension === "created_week") return dateLabel(item.created_at, "week");
  if (dimension === "created_month") return dateLabel(item.created_at, "month");
  if (dimension === "closed_month") return dateLabel(effectiveDate(item, "closed_at"), "month");
  const values: Record<Exclude<AnalyticsDimensionKey, "created_day" | "created_week" | "created_month" | "closed_month">, string> = {
    owner: ownerLabel(item, agents),
    customer: customerLabel(item),
    channel: item.channel || "Sin canal",
    priority: item.priority || "Sin prioridad",
    lifecycle_status: item.lifecycle_status || "Sin estado",
    response_status: item.response_status || "Sin estado",
    area: item.area || "Sin área",
    product: item.product || "Sin producto",
  };
  const label = values[dimension];
  return { key: label, label, chronological: false };
}

async function loadCases() {
  const cases: AnalyticsCase[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("cases")
      .select("id, customer_id, channel, priority, lifecycle_status, response_status, area, product, assigned_agent_id, assigned_to, is_merged, created_at, updated_at, closed_at, contact_name, contact_email, customer:customers(name,email)")
      .range(start, start + PAGE_SIZE - 1)
      .returns<AnalyticsCase[]>();
    if (error) throw new Error(`No se pudieron resolver los datos del dashboard: ${error.message}`);
    cases.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return cases;
}

async function loadAgents() {
  const { data, error } = await supabase.from("crm_users").select("id, name, email").returns<AnalyticsAgent[]>();
  if (error) throw new Error(`No se pudieron resolver los ejecutivos del dashboard: ${error.message}`);
  const agents = new Map<string, string>();
  (data ?? []).forEach((agent) => {
    const label = agent.name?.trim() || agent.email?.trim() || "Sin ejecutivo";
    agents.set(String(agent.id).toLowerCase(), label);
    if (agent.email) agents.set(agent.email.toLowerCase(), label);
  });
  return agents;
}

export async function resolveDashboardWidgets(definitionInput: SafeDashboardDefinition | unknown) {
  const definition = validateDashboardDefinition(definitionInput);
  const [cases, agents] = await Promise.all([loadCases(), loadAgents()]);
  const widgets: WidgetData[] = definition.widgets.map((widget) => {
    const filters = { ...definition.filters, ...widget.filters };
    const matching = cases.filter((item) => matchesFilters(item, filters)).filter(metricPredicates[widget.metric]);
    const dimension = widget.type === "kpi"
      ? undefined
      : widget.dimension ?? metricDefinitions[widget.metric].defaultDimension;
    const groups = new Map<string, { label: string; value: number; chronological: boolean }>();
    if (dimension) {
      matching.forEach((item) => {
        const bucket = dimensionBucket(item, dimension, agents);
        const current = groups.get(bucket.key);
        groups.set(bucket.key, { ...bucket, value: (current?.value ?? 0) + 1 });
      });
    }
    const chronological = [...groups.values()].some((group) => group.chronological);
    const series = [...groups.entries()]
      .sort(([leftKey, left], [rightKey, right]) => chronological ? leftKey.localeCompare(rightKey) : right.value - left.value)
      .map(([, group]) => ({ label: group.label, value: group.value }));
    if (process.env.NODE_ENV === "development") {
      console.info("[dashboard-query] widget resolved", {
        widgetId: widget.id,
        metric: widget.metric,
        dimension: dimension ?? null,
        sourceRows: cases.length,
        matchingRows: matching.length,
        groups: series.length,
        filterKeys: Object.keys(filters).filter((key) => filters[key as keyof DashboardFilters] != null),
      });
    }
    return { widgetId: widget.id, type: widget.type, total: matching.length, series, rows: series };
  });
  return { definition, widgets, resolvedAt: new Date().toISOString() };
}
