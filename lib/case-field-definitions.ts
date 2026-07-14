import type { CaseViewColumnKey } from "./case-view-service";

export type CaseEditableFieldKey =
  | "channel"
  | "contactType"
  | "product"
  | "subproduct"
  | "catPrincipal"
  | "catSecondary"
  | "catExtra"
  | "status"
  | "containmentContext"
  | "ownerId"
  | "priority"
  | "isEdgeCase";

export type CaseFieldType =
  | "text"
  | "textarea"
  | "picklist"
  | "boolean"
  | "date"
  | "datetime"
  | "user";

export type CaseFieldDefinition = {
  key: CaseEditableFieldKey;
  columnKey?: CaseViewColumnKey;
  label: string;
  editable: boolean;
  type: CaseFieldType;
  persistFieldName: string;
  options?: string[];
};

export const caseStatusOptions = [
  "New",
  "In Progress",
  "Stand By",
  "Resolved",
  "Closed",
  "Merged",
];

export const caseFieldDefinitions: Record<
  CaseEditableFieldKey,
  CaseFieldDefinition
> = {
  channel: {
    key: "channel",
    columnKey: "channel",
    label: "Canal",
    editable: true,
    type: "picklist",
    persistFieldName: "channel",
    options: ["WHATSAPP", "GMAIL", "EMAIL", "WEB", "TICKET"],
  },
  contactType: {
    key: "contactType",
    columnKey: "contactType",
    label: "Tipo de Contacto",
    editable: true,
    type: "picklist",
    persistFieldName: "contact_type",
    options: ["WHATSAPP", "GMAIL", "EMAIL", "WEB", "CHATBOT", "PHONE", "MANUAL"],
  },
  product: {
    key: "product",
    columnKey: "product",
    label: "Producto",
    editable: true,
    type: "picklist",
    persistFieldName: "product",
    options: ["Global66", "Cuenta", "Transferencias", "Tarjeta", "Remesas"],
  },
  subproduct: {
    key: "subproduct",
    columnKey: "subproduct",
    label: "Subproducto",
    editable: true,
    type: "picklist",
    persistFieldName: "subproduct",
    options: ["Carga de dinero", "Envío en curso", "Retiro", "KYC", "Soporte General"],
  },
  catPrincipal: {
    key: "catPrincipal",
    columnKey: "catPrincipal",
    label: "CAT Principal",
    editable: true,
    type: "picklist",
    persistFieldName: "area",
    options: ["GENERAL", "SOPORTE", "FACTURACION", "OPERACIONES", "COMPLIANCE", "VENTAS"],
  },
  catSecondary: {
    key: "catSecondary",
    columnKey: "catSecondary",
    label: "CAT Secundaria",
    editable: true,
    type: "picklist",
    persistFieldName: "category",
    options: ["CONSULTA", "ACCESO", "INCIDENCIA", "PAGO", "DOCUMENTACION", "FACTURACION", "RECLAMO", "OTRO"],
  },
  catExtra: {
    key: "catExtra",
    columnKey: "catExtra",
    label: "CAT Extra",
    editable: true,
    type: "picklist",
    persistFieldName: "ai_category",
    options: ["Soporte General", "Escalado a Tech", "Seguimiento para Retención", "Valor 129", "Valor 157", "Valor 164", "Valor 171"],
  },
  status: {
    key: "status",
    columnKey: "status",
    label: "Estado",
    editable: true,
    type: "picklist",
    persistFieldName: "lifecycle_status",
    options: caseStatusOptions,
  },
  containmentContext: {
    key: "containmentContext",
    columnKey: "containmentContext",
    label: "Contexto Contención",
    editable: true,
    type: "text",
    persistFieldName: "resolution_type",
  },
  ownerId: {
    key: "ownerId",
    columnKey: "owner",
    label: "Owner",
    editable: true,
    type: "user",
    persistFieldName: "assigned_agent_id",
  },
  priority: {
    key: "priority",
    columnKey: "priority",
    label: "Prioridad",
    editable: true,
    type: "picklist",
    persistFieldName: "priority",
    options: ["LOW", "MEDIUM", "HIGH", "URGENT"],
  },
  isEdgeCase: {
    key: "isEdgeCase",
    columnKey: "isEdgeCase",
    label: "Caso Borde",
    editable: true,
    type: "boolean",
    persistFieldName: "is_edge_case",
  },
};

export function normalizeCaseStatusForStorage(status: string) {
  const normalized = status.trim().toUpperCase().replaceAll(" ", "_");

  if (normalized === "MERGED") return "MERGED";

  return normalized || "NEW";
}

export function formatCaseStatusForView(status: string) {
  if (status === "NEW") return "New";
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "STAND_BY") return "Stand By";
  if (status === "RESOLVED") return "Resolved";
  if (status === "CLOSED") return "Closed";
  if (status === "MERGED") return "Merged";

  return status;
}

export function getEditableFieldByColumn(columnKey: CaseViewColumnKey) {
  return Object.values(caseFieldDefinitions).find(
    (definition) => definition.columnKey === columnKey,
  );
}
