import { formatCaseNumber, normalizeLifecycleStatus } from "./case-status";
import { computeCaseSlaStatus, type CaseSlaResult } from "./case-sla-service";
import { supabase } from "./supabase";
import {
  getCaseResponseActivity,
  isCaseResponseStatus,
  type CaseResponseMessage,
  type CaseResponseStatus,
} from "./case-response-status-service";
import type { CaseFieldDefinition } from "./case-metadata";

export type CaseViewMetricKey =
  | "total"
  | "pending"
  | "waiting"
  | "risk"
  | "edge"
  | "standBy"
  | "resolved";

export type CaseViewColumnKey =
  | "number"
  | "subject"
  | "email"
  | "contactType"
  | "response"
  | "catPrincipal"
  | "catSecondary"
  | "catExtra"
  | "status"
  | "containmentContext"
  | "owner"
  | "priority"
  | "isEdgeCase"
  | "channel"
  | "product"
  | "subproduct";

export type CaseViewRow = {
  id: string;
  number: string;
  subject: string;
  email: string;
  channel: string;
  contactType: string;
  product: string;
  subproduct: string;
  catPrincipal: string;
  catSecondary: string;
  catExtra: string;
  status: string;
  statusLabel: string;
  containmentContext: string;
  ownerId: string | null;
  ownerName: string;
  priority: string;
  createdAt: string | null;
  updatedAt: string | null;
  isEdgeCase: boolean;
  isMerged: boolean;
  mergedIntoCaseId: string | null;
  responseStatus: CaseResponseStatus;
  sla: CaseSlaResult;
};

export type CaseViewMetric = {
  key: CaseViewMetricKey;
  label: string;
  value: number;
};

export type CaseViewData = {
  rows: CaseViewRow[];
  columns: Array<{
    key: CaseViewColumnKey;
    label: string;
  }>;
};

export type CaseViewFilters = {
  channel: string;
  contactType: string;
  product: string;
  subproduct: string;
  catPrincipal: string;
  catSecondary: string;
  catExtra: string;
  status: string;
};

export type CaseViewSorting =
  | "updated_desc"
  | "updated_asc"
  | "number_desc"
  | "number_asc";

export type CaseViewModel = {
  baseCasesForMetrics: CaseViewRow[];
  metrics: CaseViewMetric[];
  casesForTable: CaseViewRow[];
  paginatedCases: CaseViewRow[];
  totalForPagination: number;
};

type CaseRecord = {
  id: string | number | null;
  case_number: string | number | null;
  subject: string | null;
  channel: string | null;
  contact_type: string | null;
  status: string | null;
  lifecycle_status: string | null;
  priority: string | null;
  assigned_agent_id: string | null;
  assigned_to: string | null;
  area: string | null;
  category: string | null;
  contact_email: string | null;
  created_at: string | null;
  updated_at: string | null;
  resolution_type?: string | null;
  ai_summary?: string | null;
  ai_category?: string | null;
  ai_resolution?: string | null;
  product?: string | null;
  subproduct?: string | null;
  is_merged?: boolean | null;
  merged_into_case_id?: string | null;
  response_status?: string | null;
  customer: {
    email?: string | null;
  } | null;
  caso_borde?: boolean | null;
  is_edge_case?: boolean | null;
  edge_case?: boolean | null;
};

export type CaseViewMessageRecord = CaseResponseMessage & {
  id: string | number;
};

export const defaultCaseViewColumns: CaseViewData["columns"] = [
  { key: "number", label: "Número Caso" },
  { key: "subject", label: "Asunto" },
  { key: "email", label: "Correo" },
  { key: "response", label: "Respuesta" },
  { key: "contactType", label: "Tipo de Contacto" },
  { key: "catPrincipal", label: "CAT Principal" },
  { key: "catSecondary", label: "CAT Secundaria" },
  { key: "catExtra", label: "CAT Extra" },
  { key: "status", label: "Estado" },
  { key: "containmentContext", label: "Contexto Contención" },
  { key: "owner", label: "Owner" },
  { key: "priority", label: "Prioridad" },
  { key: "isEdgeCase", label: "Caso Borde" },
  { key: "channel", label: "Canal" },
  { key: "product", label: "Producto" },
  { key: "subproduct", label: "Subproducto" },
];

const caseFieldKeyByViewColumn: Partial<Record<CaseViewColumnKey, string>> = {
  number: "case_number",
  subject: "subject",
  email: "contact_email",
  response: "response_status",
  contactType: "contact_type",
  catPrincipal: "area",
  catSecondary: "category",
  catExtra: "ai_category",
  status: "lifecycle_status",
  containmentContext: "resolution_type",
  owner: "assigned_to",
  priority: "priority",
  isEdgeCase: "is_edge_case",
  channel: "channel",
  product: "product",
  subproduct: "subproduct",
};

function columnsFromCaseFieldCatalog(definitions: CaseFieldDefinition[]) {
  const byKey = new Map(definitions.map((field) => [field.field_key, field]));
  return defaultCaseViewColumns.filter((column) => {
    const definition = byKey.get(caseFieldKeyByViewColumn[column.key] ?? "");
    return mandatoryCaseViewColumns.includes(column.key) || definition?.is_list_visible !== false;
  }).map((column) => {
    const definition = byKey.get(caseFieldKeyByViewColumn[column.key] ?? "");
    return { ...column, label: definition?.label?.trim() || column.label };
  });
}

export const mandatoryCaseViewColumns: CaseViewColumnKey[] = [
  "number",
  "email",
  "response",
];

export function normalizeCaseViewColumns(columns: CaseViewColumnKey[] | null | undefined) {
  const validColumns = new Set(defaultCaseViewColumns.map((column) => column.key));
  const optionalColumns = (columns ?? []).filter(
    (column, index, all) =>
      validColumns.has(column) &&
      !mandatoryCaseViewColumns.includes(column) &&
      all.indexOf(column) === index,
  );

  return [...mandatoryCaseViewColumns, ...optionalColumns];
}

function groupMessagesByCase(messages: CaseViewMessageRecord[]) {
  const groupedMessages = new Map<string, CaseViewMessageRecord[]>();

  messages.forEach((message) => {
    if (!message.case_id) return;

    const caseId = String(message.case_id);
    groupedMessages.set(caseId, [...(groupedMessages.get(caseId) ?? []), message]);
  });

  return groupedMessages;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    NEW: "New",
    IN_PROGRESS: "In Progress",
    STAND_BY: "Stand By",
    CLOSED: "Closed",
    RESOLVED: "Resolved",
    MERGED: "Merged",
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function normalizedSummaryStatus(row: Pick<CaseViewRow, "status">) {
  return row.status.trim().toUpperCase();
}

export function isResolvedCase(row: Pick<CaseViewRow, "status">) {
  return normalizedSummaryStatus(row) === "RESOLVED";
}

export function isClosedCase(row: Pick<CaseViewRow, "status">) {
  return normalizedSummaryStatus(row) === "CLOSED";
}

export function isMergedCase(row: Pick<CaseViewRow, "status" | "isMerged">) {
  return normalizedSummaryStatus(row) === "MERGED" || row.isMerged;
}

export function isActiveForSummary(
  row: Pick<CaseViewRow, "status" | "isMerged">,
) {
  return !isResolvedCase(row) && !isClosedCase(row) && !isMergedCase(row);
}

export function isPendingCase(row: Pick<CaseViewRow, "status">) {
  const status = normalizedSummaryStatus(row);
  return status === "NEW" || status === "IN_PROGRESS";
}

export function isStandByCase(row: Pick<CaseViewRow, "status">) {
  return normalizedSummaryStatus(row) === "STAND_BY";
}

function isEdgeCase(caseItem: CaseRecord) {
  return Boolean(
    caseItem.caso_borde ?? caseItem.is_edge_case ?? caseItem.edge_case ?? false,
  );
}

function buildRows(cases: CaseRecord[], messages: CaseViewMessageRecord[]) {
  const messagesByCase = groupMessagesByCase(messages);

  return cases
    .filter((caseItem): caseItem is CaseRecord & { id: string | number } =>
      Boolean(caseItem.id),
    )
    .map<CaseViewRow>((caseItem) => {
      const id = String(caseItem.id);
      const status = normalizeLifecycleStatus(
        caseItem.lifecycle_status?.trim().toUpperCase(),
        caseItem.status?.trim().toUpperCase(),
      );
      const caseMessages = messagesByCase.get(id) ?? [];
      const calculatedResponse = getCaseResponseActivity(caseMessages);
      const sla = computeCaseSlaStatus(
        {
          channel: caseItem.channel,
          priority: caseItem.priority,
          segment: caseItem.priority,
          created_at: caseItem.created_at,
        },
        caseMessages,
      );

      return {
        id,
        number: formatCaseNumber(caseItem.case_number, id),
        subject: caseItem.subject || "Sin asunto",
        email: caseItem.customer?.email || caseItem.contact_email || "Sin correo",
        channel: caseItem.channel || "Sin canal",
        contactType: caseItem.contact_type || "Sin tipo",
        product: caseItem.product || "Sin producto",
        subproduct: caseItem.subproduct || "Sin subproducto",
        catPrincipal: caseItem.area || caseItem.category || "Sin categoría",
        catSecondary: caseItem.category || "Sin valor",
        catExtra: caseItem.ai_category || "Sin valor",
        status,
        statusLabel: statusLabel(status),
        containmentContext:
          caseItem.ai_resolution ||
          caseItem.resolution_type ||
          caseItem.ai_summary ||
          "Sin contexto",
        ownerId: caseItem.assigned_agent_id,
        ownerName: caseItem.assigned_to || "Sin owner",
        priority: caseItem.priority || "Sin prioridad",
        createdAt: caseItem.created_at,
        updatedAt: caseItem.updated_at,
        isEdgeCase: isEdgeCase(caseItem),
        isMerged: Boolean(caseItem.is_merged || status === "MERGED"),
        mergedIntoCaseId: caseItem.merged_into_case_id ?? null,
        sla,
        responseStatus: isCaseResponseStatus(caseItem.response_status)
          ? caseItem.response_status
          : calculatedResponse.response_status,
      };
    })
    .sort((caseA, caseB) => {
      const timeA = new Date(caseA.updatedAt || caseA.createdAt || 0).getTime();
      const timeB = new Date(caseB.updatedAt || caseB.createdAt || 0).getTime();

      return timeB - timeA;
    });
}

function buildMetrics(rows: CaseViewRow[]): CaseViewMetric[] {
  const activeRows = rows.filter(isActiveForSummary);
  return [
    { key: "total", label: "TOTAL CASOS", value: activeRows.length },
    { key: "pending", label: "PENDIENTES", value: rows.filter(isPendingCase).length },
    {
      key: "waiting",
      label: "ESPERANDO",
      value: activeRows.filter(
        (row) => row.responseStatus === "WAITING_AGENT_RESPONSE",
      ).length,
    },
    {
      key: "risk",
      label: "EN RIESGO",
      value: activeRows.filter(
        (row) =>
          row.sla.first_response_sla_breached ||
          row.sla.between_responses_sla_breached,
      ).length,
    },
    { key: "edge", label: "BORDES", value: activeRows.filter((row) => row.isEdgeCase).length },
    { key: "standBy", label: "STAND BY", value: rows.filter(isStandByCase).length },
    {
      key: "resolved",
      label: "RESUELTOS",
      value: rows.filter(isResolvedCase).length,
    },
  ];
}

export function filterRowsByMetric(rows: CaseViewRow[], metric: CaseViewMetricKey) {
  const activeRows = rows.filter(isActiveForSummary);
  if (metric === "pending") return rows.filter(isPendingCase);
  if (metric === "waiting") {
    return activeRows.filter(
      (row) => row.responseStatus === "WAITING_AGENT_RESPONSE",
    );
  }
  if (metric === "risk") {
    return activeRows.filter(
      (row) =>
        row.sla.first_response_sla_breached ||
        row.sla.between_responses_sla_breached,
    );
  }
  if (metric === "edge") return activeRows.filter((row) => row.isEdgeCase);
  if (metric === "standBy") return rows.filter(isStandByCase);
  if (metric === "resolved") return rows.filter(isResolvedCase);

  return rows;
}

function matchesFilter(value: string, selected: string) {
  return !selected || value === selected;
}

function rowMatchesFilters(row: CaseViewRow, filters: CaseViewFilters) {
  return (
    matchesFilter(row.channel, filters.channel) &&
    matchesFilter(row.contactType, filters.contactType) &&
    matchesFilter(row.product, filters.product) &&
    matchesFilter(row.subproduct, filters.subproduct) &&
    matchesFilter(row.catPrincipal, filters.catPrincipal) &&
    matchesFilter(row.catSecondary, filters.catSecondary) &&
    matchesFilter(row.catExtra, filters.catExtra) &&
    matchesFilter(row.statusLabel, filters.status)
  );
}

function rowMatchesSearch(row: CaseViewRow, searchTerm: string) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) return true;

  const searchable = [
    row.number,
    row.email,
    row.contactType,
    row.responseStatus,
    row.catPrincipal,
    row.catSecondary,
    row.catExtra,
    row.statusLabel,
    row.containmentContext,
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(normalizedSearch);
}

function sortCaseViewRows(rows: CaseViewRow[], sorting: CaseViewSorting) {
  return [...rows].sort((rowA, rowB) => {
    if (sorting === "number_asc" || sorting === "number_desc") {
      const comparison = rowA.number.localeCompare(rowB.number);

      return sorting === "number_asc" ? comparison : -comparison;
    }

    const timeA = new Date(rowA.updatedAt || rowA.createdAt || 0).getTime();
    const timeB = new Date(rowB.updatedAt || rowB.createdAt || 0).getTime();

    return sorting === "updated_asc" ? timeA - timeB : timeB - timeA;
  });
}

export function buildCaseViewModel({
  allCases,
  activeFilters,
  searchTerm,
  activeKpiFilter,
  sorting,
  pageSize,
}: {
  allCases: CaseViewRow[];
  activeFilters: CaseViewFilters;
  searchTerm: string;
  activeKpiFilter: CaseViewMetricKey;
  sorting: CaseViewSorting;
  pageSize: number;
}): CaseViewModel {
  const baseCasesForMetrics = allCases.filter(
    (row) =>
      rowMatchesFilters(row, activeFilters) && rowMatchesSearch(row, searchTerm),
  );
  const metrics = buildMetrics(baseCasesForMetrics);
  const casesForTable = sortCaseViewRows(
    filterRowsByMetric(baseCasesForMetrics, activeKpiFilter),
    sorting,
  );

  return {
    baseCasesForMetrics,
    metrics,
    casesForTable,
    paginatedCases: casesForTable.slice(0, pageSize),
    totalForPagination: casesForTable.length,
  };
}

export async function getCaseViewData(): Promise<{
  data: CaseViewData | null;
  error: string | null;
}> {
  const { error: responseStatusError } = await supabase.rpc(
    "recalculate_all_case_response_statuses",
  );

  if (responseStatusError) {
    return { data: null, error: responseStatusError.message };
  }

  const [casesResult, messagesResult, fieldsResult] = await Promise.all([
    supabase
      .from("cases")
      .select(
        "id, case_number, subject, channel, contact_type, status, lifecycle_status, priority, assigned_agent_id, assigned_to, area, category, contact_email, created_at, updated_at, resolution_type, ai_summary, ai_category, ai_resolution, product, subproduct, is_edge_case, is_merged, merged_into_case_id, response_status, customer:customers(email)",
      )
      .order("created_at", { ascending: false })
      .returns<CaseRecord[]>(),
    supabase
      .from("messages")
      .select("id, case_id, sender_type, direction, created_at, channel, message_type")
      .order("created_at", { ascending: false })
      .limit(1200)
      .returns<CaseViewMessageRecord[]>(),
    supabase
      .from("case_field_definitions")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .returns<CaseFieldDefinition[]>(),
  ]);

  const error = casesResult.error?.message ?? messagesResult.error?.message ?? fieldsResult.error?.message ?? null;

  if (error) return { data: null, error };

  const rows = buildRows(casesResult.data ?? [], messagesResult.data ?? []);

  return {
    data: {
      rows,
      columns: columnsFromCaseFieldCatalog(fieldsResult.data ?? []),
    },
    error: null,
  };
}
