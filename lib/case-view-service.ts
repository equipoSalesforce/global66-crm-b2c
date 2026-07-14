import { formatCaseNumber, normalizeLifecycleStatus } from "./case-status";
import { computeCaseSlaStatus, type CaseSlaResult } from "./case-sla-service";
import { supabase } from "./supabase";
import type { CaseResponseMessage } from "./case-response-status-service";

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
  { key: "number", label: "Número" },
  { key: "email", label: "Correo" },
  { key: "contactType", label: "Tipo de Contacto" },
  { key: "response", label: "Respuesta" },
  { key: "catPrincipal", label: "CAT Principal" },
  { key: "catSecondary", label: "CAT Secundaria" },
  { key: "catExtra", label: "CAT Extra" },
  { key: "status", label: "Estado" },
  { key: "containmentContext", label: "Contexto Contención" },
];

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

function isResolvedStatus(status: string) {
  return status === "CLOSED" || status === "RESOLVED";
}

function isPendingCase(row: CaseViewRow) {
  return (
    (row.status === "NEW" || row.status === "IN_PROGRESS") &&
    !row.sla.has_agent_interaction
  );
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
        caseItem.lifecycle_status,
        caseItem.status,
      );
      const caseMessages = messagesByCase.get(id) ?? [];
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
      };
    })
    .sort((caseA, caseB) => {
      const timeA = new Date(caseA.updatedAt || caseA.createdAt || 0).getTime();
      const timeB = new Date(caseB.updatedAt || caseB.createdAt || 0).getTime();

      return timeB - timeA;
    });
}

function buildMetrics(rows: CaseViewRow[]): CaseViewMetric[] {
  return [
    { key: "total", label: "TOTAL CASOS", value: rows.length },
    { key: "pending", label: "PENDIENTES", value: rows.filter(isPendingCase).length },
    {
      key: "waiting",
      label: "ESPERANDO",
      value: rows.filter((row) => row.sla.is_waiting_for_agent).length,
    },
    {
      key: "risk",
      label: "EN RIESGO",
      value: rows.filter(
        (row) =>
          row.sla.first_response_sla_breached ||
          row.sla.between_responses_sla_breached,
      ).length,
    },
    { key: "edge", label: "BORDES", value: rows.filter((row) => row.isEdgeCase).length },
    { key: "standBy", label: "STAND BY", value: rows.filter((row) => row.status === "STAND_BY").length },
    {
      key: "resolved",
      label: "RESUELTOS",
      value: rows.filter((row) => isResolvedStatus(row.status)).length,
    },
  ];
}

export function filterRowsByMetric(rows: CaseViewRow[], metric: CaseViewMetricKey) {
  if (metric === "pending") return rows.filter(isPendingCase);
  if (metric === "waiting") return rows.filter((row) => row.sla.is_waiting_for_agent);
  if (metric === "risk") {
    return rows.filter(
      (row) =>
        row.sla.first_response_sla_breached ||
        row.sla.between_responses_sla_breached,
    );
  }
  if (metric === "edge") return rows.filter((row) => row.isEdgeCase);
  if (metric === "standBy") return rows.filter((row) => row.status === "STAND_BY");
  if (metric === "resolved") return rows.filter((row) => isResolvedStatus(row.status));

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
    row.sla.response_label,
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
  const [casesResult, messagesResult] = await Promise.all([
    supabase
      .from("cases")
      .select(
        "id, case_number, subject, channel, contact_type, status, lifecycle_status, priority, assigned_agent_id, assigned_to, area, category, contact_email, created_at, updated_at, resolution_type, ai_summary, ai_category, ai_resolution, product, subproduct, is_edge_case, is_merged, merged_into_case_id, customer:customers(email)",
      )
      .order("created_at", { ascending: false })
      .returns<CaseRecord[]>(),
    supabase
      .from("messages")
      .select("id, case_id, sender_type, direction, created_at, channel, message_type")
      .order("created_at", { ascending: false })
      .limit(1200)
      .returns<CaseViewMessageRecord[]>(),
  ]);

  const error = casesResult.error?.message ?? messagesResult.error?.message ?? null;

  if (error) return { data: null, error };

  const rows = buildRows(casesResult.data ?? [], messagesResult.data ?? []);

  return {
    data: {
      rows,
      columns: defaultCaseViewColumns,
    },
    error: null,
  };
}
