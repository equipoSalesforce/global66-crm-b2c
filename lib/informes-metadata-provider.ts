import {
  reportSourceAdapters,
  type ReportField,
  type ReportSource,
  type ReportSourceAdapter,
} from "./informes-sources";
import type { CasesReportSourcePayload } from "./report-sources/cases-report-source";

/**
 * Stable metadata boundary for the report builder/runner. A future provider can
 * resolve the same contract from Supabase, Redshift, CRM object metadata or
 * `/reports/sources` without changing UI components.
 */
export interface ReportMetadataProvider {
  getReportSources(): ReportSourceAdapter["source"][];
  getReportSource(sourceId: ReportSource): ReportSourceAdapter;
  getReportFields(sourceId: ReportSource): ReportField[];
  getReportField(sourceId: ReportSource, fieldName: string): ReportField | undefined;
  getDefaultColumns(sourceId: ReportSource): string[];
  getGroupableFields(sourceId: ReportSource): ReportField[];
  getFilterableFields(sourceId: ReportSource): ReportField[];
  getAggregatableFields(sourceId: ReportSource): ReportField[];
  getSortableFields(sourceId: ReportSource): ReportField[];
}

const resolveAdapter = (sourceId: ReportSource) => reportSourceAdapters[sourceId] ?? Object.values(reportSourceAdapters).find((adapter) => adapter.source.enabled) ?? Object.values(reportSourceAdapters)[0];

const localMetadataProvider: ReportMetadataProvider = {
  getReportSources: () => Object.values(reportSourceAdapters).map((adapter) => adapter.source),
  getReportSource: resolveAdapter,
  getReportFields: (sourceId) => resolveAdapter(sourceId).source.fields.filter((field) => field.visible),
  getReportField: (sourceId, fieldName) => resolveAdapter(sourceId).source.fields.find((field) => field.name === fieldName && field.visible),
  getDefaultColumns: (sourceId) => [...resolveAdapter(sourceId).defaultColumns],
  getGroupableFields: (sourceId) => resolveAdapter(sourceId).source.fields.filter((field) => field.visible && field.groupable),
  getFilterableFields: (sourceId) => resolveAdapter(sourceId).source.fields.filter((field) => field.visible && field.filterable),
  getAggregatableFields: (sourceId) => resolveAdapter(sourceId).source.fields.filter((field) => field.visible && field.aggregatable && ["number", "currency"].includes(field.type)),
  getSortableFields: (sourceId) => resolveAdapter(sourceId).source.fields.filter((field) => field.visible && field.sortable),
};

export const getReportSources = () => localMetadataProvider.getReportSources();
export const getReportSourceAdapter = (sourceId: ReportSource) => localMetadataProvider.getReportSource(sourceId);
export const getReportFields = (sourceId: ReportSource) => localMetadataProvider.getReportFields(sourceId);
export const getReportField = (sourceId: ReportSource, fieldName: string) => localMetadataProvider.getReportField(sourceId, fieldName);
export const getDefaultColumns = (sourceId: ReportSource) => localMetadataProvider.getDefaultColumns(sourceId);
export const getGroupableFields = (sourceId: ReportSource) => localMetadataProvider.getGroupableFields(sourceId);
export const getFilterableFields = (sourceId: ReportSource) => localMetadataProvider.getFilterableFields(sourceId);
export const getAggregatableFields = (sourceId: ReportSource) => localMetadataProvider.getAggregatableFields(sourceId);
export const getSortableFields = (sourceId: ReportSource) => localMetadataProvider.getSortableFields(sourceId);

let casesLoadPromise: Promise<boolean> | null = null;

export async function refreshReportSource(sourceId: ReportSource) {
  if (sourceId !== "cases") return false;
  if (casesLoadPromise) return casesLoadPromise;
  casesLoadPromise = fetch("/api/reports/sources/cases", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return false;
      const payload = await response.json() as CasesReportSourcePayload;
      if (!Array.isArray(payload.fields) || !Array.isArray(payload.rows)) return false;
      reportSourceAdapters.cases = {
        source: { ...reportSourceAdapters.cases.source, description: "Casos y campos personalizados del Object Manager.", fields: payload.fields },
        defaultColumns: payload.defaultColumns,
        dataset: payload.rows,
      };
      return true;
    })
    .catch(() => false)
    .finally(() => { casesLoadPromise = null; });
  return casesLoadPromise;
}
