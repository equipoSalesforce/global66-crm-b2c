import { getDefaultColumns, getReportFields, getReportSourceAdapter, getReportSources } from "./informes-metadata-provider";
import type { ReportSource } from "./informes-sources";

export type { ReportField, ReportFieldType, ReportSource, ReportSourceDefinition } from "./informes-sources";

export type ReportVisibility = "private" | "shared" | "internal";

export type ReportFilter = {
  id: string;
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "between" | "is_empty" | "is_not_empty";
  value: string;
  valueTo?: string;
};

export type ReportMetric = {
  id: string;
  aggregation: "count" | "sum" | "average" | "max" | "min";
  field?: string;
  label: string;
};

export type ReportGrouping = {
  field: string;
  direction: "asc" | "desc";
};

export type ReportFolder = { id: string; name: string };
export type ReportOwner = { id: string; name: string; initials: string };

export type ReportDefinition = {
  id: string;
  name: string;
  description: string;
  source: ReportSource;
  folderId: string;
  visibility: ReportVisibility;
  owner: ReportOwner;
  columns: string[];
  filters: ReportFilter[];
  groupBy: ReportGrouping[];
  metrics: ReportMetric[];
  sort: { field: string; direction: "asc" | "desc" };
  limit: number;
  updatedAt: string;
};

export const reportFolders: ReportFolder[] = [
  { id: "all", name: "Todos" }, { id: "mine", name: "Mis informes" }, { id: "operations", name: "Operación" },
  { id: "cases", name: "Casos" }, { id: "accounts", name: "Cuentas" }, { id: "sla", name: "SLA" }, { id: "ai", name: "IA" },
];

const owner: ReportOwner = { id: "owner-1", name: "Equipo Operaciones", initials: "EO" };
const countMetric: ReportMetric = { id: "records", aggregation: "count", label: "Recuento de registros" };

export const initialReports: ReportDefinition[] = [
  { id: "cases-by-channel", name: "Casos por canal", description: "Distribución de casos creados por canal de contacto.", source: "cases", folderId: "cases", visibility: "internal", owner, columns: ["case_number", "subject", "channel", "status", "created_at", "priority", "customer_id"], filters: [], groupBy: [{ field: "channel", direction: "desc" }], metrics: [countMetric], sort: { field: "created_at", direction: "desc" }, limit: 50, updatedAt: "2026-07-04T13:10:00.000Z" },
  { id: "open-cases-priority", name: "Casos abiertos por prioridad", description: "Backlog activo segmentado por nivel de prioridad.", source: "cases", folderId: "sla", visibility: "shared", owner, columns: ["case_number", "subject", "priority", "assigned_agent_id", "created_at"], filters: [{ id: "status-open", field: "status", operator: "equals", value: "Abierto" }], groupBy: [{ field: "priority", direction: "desc" }], metrics: [countMetric], sort: { field: "created_at", direction: "asc" }, limit: 100, updatedAt: "2026-07-03T17:20:00.000Z" },
  { id: "accounts-by-segment", name: "Cuentas por segmento", description: "Composición de la base de clientes por segmento y plan.", source: "accounts", folderId: "accounts", visibility: "internal", owner, columns: ["account_id", "full_name", "country", "segment", "plan", "kyc_status"], filters: [], groupBy: [{ field: "segment", direction: "desc" }], metrics: [countMetric], sort: { field: "full_name", direction: "asc" }, limit: 50, updatedAt: "2026-07-02T11:00:00.000Z" },
  { id: "transaction-volume", name: "Volumen transaccional", description: "Volumen y cantidad de transacciones por moneda.", source: "transactions", folderId: "operations", visibility: "private", owner, columns: ["transaction_id", "date", "amount", "currency", "status"], filters: [], groupBy: [{ field: "currency", direction: "desc" }], metrics: [{ id: "amount-sum", aggregation: "sum", field: "amount", label: "Suma de monto" }], sort: { field: "date", direction: "desc" }, limit: 50, updatedAt: "2026-07-01T09:30:00.000Z" },
];

const REPORTS_KEY = "global66.crm.reports.v1";
const FOLDERS_KEY = "global66.crm.report-folders.v1";
const canUseStorage = () => typeof window !== "undefined";

export function listReports(): ReportDefinition[] {
  if (!canUseStorage()) return initialReports;
  const stored = window.localStorage.getItem(REPORTS_KEY);
  if (!stored) return initialReports;
  try { return (JSON.parse(stored) as ReportDefinition[]).map(normalizeReport).filter((report): report is ReportDefinition => report !== null); } catch { return initialReports; }
}

export function getReport(id: string) { return listReports().find((report) => report.id === id) ?? null; }
export function listReportFolders(): ReportFolder[] {
  if (!canUseStorage()) return reportFolders;
  const stored = window.localStorage.getItem(FOLDERS_KEY);
  if (!stored) return reportFolders;
  try { return JSON.parse(stored) as ReportFolder[]; } catch { return reportFolders; }
}
export function createReportFolder(name: string) { const folder = { id: `report-folder-${Date.now()}`, name: name.trim() }; window.localStorage.setItem(FOLDERS_KEY, JSON.stringify([...listReportFolders(), folder])); return folder; }
export function saveReport(report: ReportDefinition) { const normalized = normalizeReport(report); if (!normalized) throw new Error("Report source is not enabled"); const reports = listReports(); const index = reports.findIndex((item) => item.id === normalized.id); const next = [...reports]; if (index >= 0) next[index] = normalized; else next.unshift(normalized); window.localStorage.setItem(REPORTS_KEY, JSON.stringify(next)); return normalized; }
export function deleteReport(id: string) { window.localStorage.setItem(REPORTS_KEY, JSON.stringify(listReports().filter((report) => report.id !== id))); }
export function duplicateReport(id: string) { const report = getReport(id); if (!report) return null; return saveReport({ ...report, id: `${report.id}-copy-${Date.now()}`, name: `${report.name} (copia)`, visibility: "private", updatedAt: new Date().toISOString() }); }
export function getReportSource(source: ReportSource) { return getReportSourceAdapter(source).source; }

function normalizeFilterOperator(operator: string): ReportFilter["operator"] {
  if (operator === "greater-than") return "greater_than";
  if (operator === "less-than") return "less_than";
  const supported: ReportFilter["operator"][] = ["equals", "not_equals", "contains", "greater_than", "less_than", "between", "is_empty", "is_not_empty"];
  return supported.includes(operator as ReportFilter["operator"]) ? operator as ReportFilter["operator"] : "equals";
}

function normalizeReport(report: ReportDefinition): ReportDefinition | null {
  const source = getReportSource(report.source);
  if (!source.enabled) return null;
  const aliases: Record<string, string> = report.source === "accounts" ? { customer_id: "account_id" } : report.source === "transactions" ? { created_at: "date" } : {};
  const normalizeName = (name: string) => aliases[name] || name;
  const sourceFields = getReportFields(report.source);
  const allowed = new Set(sourceFields.map((field) => field.name));
  const preserveDynamicCaseFields = report.source === "cases";
  const columns = report.columns.map(normalizeName).filter((name) => allowed.has(name) || preserveDynamicCaseFields);
  const metrics = report.metrics.map((metric) => {
    if (metric.aggregation === "count") return { ...metric, field: undefined, label: "Recuento de registros" };
    const metricField = sourceFields.find((field) => field.name === normalizeName(metric.field || "") && field.aggregatable);
    return metricField ? { ...metric, field: metricField.name } : preserveDynamicCaseFields ? metric : null;
  }).filter((metric): metric is ReportMetric => metric !== null);
  const sortField = allowed.has(normalizeName(report.sort.field)) || preserveDynamicCaseFields ? normalizeName(report.sort.field) : sourceFields[0].name;
  return {
    ...report,
    columns: columns.length ? columns : getDefaultColumns(report.source),
    filters: report.filters.map((filter) => ({ ...filter, field: normalizeName(filter.field), operator: normalizeFilterOperator(filter.operator), value: report.source === "cases" && normalizeName(filter.field) === "status" && filter.value === "OPEN" ? "Abierto" : filter.value })).filter((filter) => sourceFields.some((field) => field.name === filter.field && field.filterable) || preserveDynamicCaseFields),
    groupBy: report.groupBy.map((group) => ({ ...group, field: normalizeName(group.field) })).filter((group) => sourceFields.some((field) => field.name === group.field && field.groupable) || preserveDynamicCaseFields),
    metrics: metrics.length ? metrics : [{ id: "records", aggregation: "count", label: "Recuento de registros" }],
    sort: { ...report.sort, field: sortField },
  };
}

export function createReportDraft(): ReportDefinition {
  const source = getReportSources().find((item) => item.enabled) ?? getReportSources()[0];
  const defaultColumns = getDefaultColumns(source.id);
  return { id: "", name: "", description: "", source: source.id, folderId: "operations", visibility: "private", owner, columns: defaultColumns, filters: [], groupBy: [], metrics: [{ ...countMetric }], sort: { field: defaultColumns[0], direction: "desc" }, limit: 50, updatedAt: "" };
}
