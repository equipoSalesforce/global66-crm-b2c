import type { ReportDefinition, ReportFilter, ReportMetric } from "./informes-api";
import { getReportFields, getReportSourceAdapter } from "./informes-metadata-provider";
import type { ReportField, ReportFieldType, ReportSourceRow } from "./informes-sources";

export type ReportRunColumn = { key: string; label: string; type: ReportFieldType };
export type ReportGroupedValue = { label: string; value: number; count: number };
export type ReportChartDatum = { label: string; value: number };
export type ReportRunGroup = { key: string; label: string; rows: ReportSourceRow[]; count: number; metrics: Record<string, number> };

export type ReportRunResult = {
  columns: ReportRunColumn[];
  rows: ReportSourceRow[];
  groups: ReportRunGroup[];
  groupedData: ReportGroupedValue[];
  chartData: ReportChartDatum[];
  totalRows: number;
  metricValue?: number;
  summary: { totalRows: number; metricLabel: string; metricValue: number };
};

function comparable(value: string | number | boolean | null, field?: ReportField) {
  if (value === null) return null;
  if (field?.type === "number" || field?.type === "currency") return Number(value);
  if (field?.type === "date" || field?.type === "datetime") {
    if (typeof value === "number") return value;
    const textValue = String(value);
    const monthByName: Record<string, number> = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
    const match = textValue.toLocaleLowerCase("es-CL").match(/(\d{1,2})\s+([a-z]{3})\s+(\d{4})(?:,\s*(\d{1,2}):(\d{2}))?/);
    if (match) return new Date(Number(match[3]), monthByName[match[2]] ?? 0, Number(match[1]), Number(match[4] ?? 0), Number(match[5] ?? 0)).getTime();
    const parsed = Date.parse(textValue);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return String(value).trim().toLocaleLowerCase("es-CL");
}

function filterMatches(row: ReportSourceRow, filter: ReportFilter, fields: Map<string, ReportField>) {
  const field = fields.get(filter.field);
  if (!field?.filterable) return true;
  const rawValue = row[filter.field];
  const value = comparable(rawValue, field);
  const expected = comparable(filter.value, field);
  if (filter.operator === "is_empty") return rawValue === null || String(rawValue).trim() === "";
  if (filter.operator === "is_not_empty") return rawValue !== null && String(rawValue).trim() !== "";
  if (filter.operator === "contains") return String(value ?? "").includes(String(expected ?? ""));
  if (filter.operator === "not_equals") return value !== expected;
  if (filter.operator === "greater_than") return value !== null && expected !== null && value > expected;
  if (filter.operator === "less_than") return value !== null && expected !== null && value < expected;
  if (filter.operator === "between") {
    const upper = comparable(filter.valueTo ?? "", field);
    return value !== null && expected !== null && upper !== null && value >= expected && value <= upper;
  }
  return value === expected;
}

export function applyFilters(rows: ReportSourceRow[], filters: ReportFilter[], fields: ReportField[]) {
  const fieldsByName = new Map(fields.map((field) => [field.name, field]));
  return rows.filter((row) => filters.every((filter) => filterMatches(row, filter, fieldsByName)));
}

export function applySorting(rows: ReportSourceRow[], sort: ReportDefinition["sort"], fields: ReportField[]) {
  const field = fields.find((item) => item.name === sort.field);
  return [...rows].sort((left, right) => {
    const a = comparable(left[sort.field], field);
    const b = comparable(right[sort.field], field);
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    const result = a < b ? -1 : 1;
    return sort.direction === "asc" ? result : -result;
  });
}

export function applyLimit<T>(rows: T[], limit: number) {
  return rows.slice(0, Math.max(0, limit));
}

export function calculateMetric(rows: ReportSourceRow[], metric: ReportMetric, fields: ReportField[]) {
  if (metric.aggregation === "count") return rows.length;
  const field = fields.find((item) => item.name === metric.field && item.aggregatable);
  if (!field) return 0;
  const values = rows.map((row) => Number(row[field.name])).filter(Number.isFinite);
  if (!values.length) return 0;
  if (metric.aggregation === "sum") return values.reduce((total, value) => total + value, 0);
  if (metric.aggregation === "average") return values.reduce((total, value) => total + value, 0) / values.length;
  if (metric.aggregation === "max") return Math.max(...values);
  return Math.min(...values);
}

export function groupRows(rows: ReportSourceRow[], groupBy: ReportDefinition["groupBy"], metric: ReportMetric, fields: ReportField[]): ReportRunGroup[] {
  if (!groupBy.length) return [];
  const groups = new Map<string, ReportSourceRow[]>();
  rows.forEach((row) => {
    const label = groupBy.map((group) => String(row[group.field] ?? "Sin valor")).join(" · ");
    groups.set(label, [...(groups.get(label) ?? []), row]);
  });
  const direction = groupBy[0]?.direction ?? "asc";
  return [...groups.entries()].map(([label, group]) => ({ key: label, label, rows: group, count: group.length, metrics: { [metric.id]: calculateMetric(group, metric, fields) } })).sort((left, right) => direction === "asc" ? left.label.localeCompare(right.label, "es-CL") : right.label.localeCompare(left.label, "es-CL"));
}

export function buildPreviewRows(report: ReportDefinition, rows: ReportSourceRow[]) {
  const fields = getReportFields(report.source);
  const allowed = new Set(fields.map((field) => field.name));
  const columns = report.columns.filter((name) => allowed.has(name));
  return rows.map((row) => Object.fromEntries(columns.map((name) => [name, row[name] ?? null])));
}

export function buildChartData(groupedData: ReportGroupedValue[], metricValue: number, reportName: string) {
  return groupedData.length ? groupedData.map(({ label, value }) => ({ label, value })) : [{ label: reportName, value: metricValue }];
}

export function runReport(report: ReportDefinition, metadataRevision = 0): ReportRunResult {
  void metadataRevision;
  const adapter = getReportSourceAdapter(report.source);
  const source = adapter.source;
  if (!source.enabled) return { columns: [], rows: [], groups: [], groupedData: [], chartData: [], totalRows: 0, summary: { totalRows: 0, metricLabel: "", metricValue: 0 } };
  const fields = getReportFields(report.source);
  const metric = report.metrics[0] ?? { id: "records", aggregation: "count", label: "Recuento de registros" };
  const filtered = applyFilters(adapter.dataset, report.filters, fields);
  const sorted = applySorting(filtered, report.sort, fields);
  const limited = applyLimit(sorted, report.limit);
  const groups = applyLimit(groupRows(sorted, report.groupBy, metric, fields), report.limit);
  const groupedData = groups.map((group) => ({ label: group.label, value: group.metrics[metric.id] ?? 0, count: group.count }));
  const metricValue = calculateMetric(filtered, metric, fields);
  const columns = report.columns.map((name) => fields.find((field) => field.name === name)).filter((field): field is ReportField => Boolean(field)).map((field) => ({ key: field.name, label: field.label, type: field.type }));
  return {
    columns,
    rows: buildPreviewRows(report, limited),
    groups: groups.map((group) => ({ ...group, rows: buildPreviewRows(report, applyLimit(group.rows, report.limit)) })),
    groupedData,
    chartData: buildChartData(groupedData, metricValue, report.name),
    totalRows: filtered.length,
    metricValue,
    summary: { totalRows: filtered.length, metricLabel: metric.label, metricValue },
  };
}
