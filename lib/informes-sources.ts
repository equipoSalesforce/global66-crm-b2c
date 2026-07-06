export type ReportSource = "cases" | "accounts" | "transactions" | "activity" | "emails" | "ai";
export type ReportFieldType = "text" | "number" | "currency" | "date" | "datetime" | "boolean" | "picklist" | "email" | "phone" | "id";

export type ReportField = {
  name: string;
  label: string;
  type: ReportFieldType;
  sourceField: string;
  objectName: string;
  isCustom: boolean;
  required: boolean;
  groupable: boolean;
  filterable: boolean;
  aggregatable: boolean;
  sortable: boolean;
  visible: boolean;
  description?: string;
};

export type ReportSourceDefinition = {
  id: ReportSource;
  label: string;
  description: string;
  enabled: boolean;
  fields: ReportField[];
};

export type ReportSourceRow = Record<string, string | number | boolean | null>;

export type ReportSourceAdapter = {
  source: ReportSourceDefinition;
  defaultColumns: string[];
  dataset: ReportSourceRow[];
};

const field = (
  name: string,
  label: string,
  type: ReportFieldType,
  options: Partial<Pick<ReportField, "groupable" | "filterable" | "aggregatable" | "sortable" | "visible" | "sourceField" | "objectName" | "isCustom" | "required" | "description">> = {},
): ReportField => ({
  name,
  label,
  type,
  sourceField: options.sourceField ?? name,
  objectName: options.objectName ?? "",
  isCustom: options.isCustom ?? false,
  required: options.required ?? false,
  groupable: options.groupable ?? ["text", "picklist", "date", "datetime"].includes(type),
  filterable: options.filterable ?? true,
  aggregatable: options.aggregatable ?? ["number", "currency"].includes(type),
  sortable: options.sortable ?? true,
  visible: options.visible ?? true,
  description: options.description,
});

const rawReportSources: ReportSourceDefinition[] = [
  {
    id: "cases",
    label: "Casos",
    description: "Contrato de lectura actual de casos del CRM.",
    enabled: true,
    fields: [
      field("id", "ID", "id", { groupable: false }),
      field("case_number", "N.º de caso", "id", { groupable: false }),
      field("customer_id", "Cliente", "id", { groupable: false }),
      field("subject", "Asunto", "text", { groupable: false }),
      field("status", "Estado", "picklist"),
      field("lifecycle_status", "Estado de ciclo", "picklist"),
      field("routing_status", "Estado de enrutamiento", "picklist"),
      field("priority", "Prioridad", "picklist"),
      field("channel", "Canal", "picklist"),
      field("assigned_agent_id", "Agente asignado", "id"),
      field("created_at", "Creado", "datetime"),
      field("updated_at", "Actualizado", "datetime"),
      field("closed_at", "Cerrado", "datetime"),
    ],
  },
  {
    id: "accounts",
    label: "Cuentas",
    description: "Campos conocidos del contrato actual de Account 360.",
    enabled: true,
    fields: [
      field("account_id", "ID interno", "id", { groupable: false, sourceField: "customer_id" }),
      field("full_name", "Nombre completo", "text", { groupable: false }),
      field("email", "Email", "email", { groupable: false }),
      field("country", "País", "picklist"),
      field("document", "Documento", "text", { groupable: false }),
      field("phone", "Teléfono", "phone", { groupable: false }),
      field("username", "Username", "text", { groupable: false }),
      field("customer_type", "Tipo de cliente", "picklist"),
      field("segment", "Segmentación", "picklist", { sourceField: "segmentation" }),
      field("plan", "Plan", "picklist"),
      field("kyc_status", "KYC", "picklist"),
      field("compliance_status", "Compliance", "picklist"),
      field("nationality", "Nacionalidad", "picklist"),
    ],
  },
  {
    id: "transactions",
    label: "Transacciones",
    description: "Contrato de movimientos recientes usado por Account 360.",
    enabled: true,
    fields: [
      field("transaction_id", "ID transacción", "id", { groupable: false }),
      field("date", "Fecha", "datetime", { sourceField: "start_date" }),
      field("amount", "Monto", "currency", { groupable: false, sourceField: "origin_amount" }),
      field("currency", "Moneda", "picklist", { sourceField: "origin_currency" }),
      field("status", "Estado", "picklist", { sourceField: "tx_status" }),
    ],
  },
  { id: "activity", label: "Actividad completa", description: "Fuente pendiente de un contrato unificado estable.", enabled: false, fields: [] },
  { id: "emails", label: "Correos", description: "Fuente pendiente de desacoplar la integración actual de correo.", enabled: false, fields: [] },
  { id: "ai", label: "IA", description: "Fuente pendiente de definir métricas y contrato analítico.", enabled: false, fields: [] },
];

const objectNameBySource: Record<ReportSource, string> = {
  cases: "case",
  accounts: "account_360",
  transactions: "transaction",
  activity: "activity",
  emails: "email",
  ai: "ai_execution",
};

export const reportSources: ReportSourceDefinition[] = rawReportSources.map((source) => ({
  ...source,
  fields: source.fields.map((reportField) => ({
    ...reportField,
    objectName: objectNameBySource[source.id],
  })),
}));

export const reportSourceMocks: Record<ReportSource, ReportSourceRow[]> = {
  cases: [
    { id: "case-001", case_number: "000010", customer_id: "463836", subject: "Transferencia no recibida", status: "Abierto", lifecycle_status: "En atención", routing_status: "Asignado", priority: "Alta", channel: "Email", assigned_agent_id: "Agente CX 01", created_at: "04 jul 2026, 09:12", updated_at: "04 jul 2026, 10:45", closed_at: null },
    { id: "case-002", case_number: "000011", customer_id: "581204", subject: "Validación de identidad pendiente", status: "Pendiente", lifecycle_status: "Esperando cliente", routing_status: "Asignado", priority: "Media", channel: "WhatsApp", assigned_agent_id: "Agente CX 02", created_at: "03 jul 2026, 16:08", updated_at: "04 jul 2026, 08:30", closed_at: null },
    { id: "case-003", case_number: "000012", customer_id: "720315", subject: "Consulta por tipo de cambio", status: "Resuelto", lifecycle_status: "Cerrado", routing_status: "Completado", priority: "Baja", channel: "Chat", assigned_agent_id: "Agente CX 03", created_at: "03 jul 2026, 11:40", updated_at: "03 jul 2026, 12:05", closed_at: "03 jul 2026, 12:05" },
    { id: "case-004", case_number: "000013", customer_id: "194827", subject: "Tarjeta rechazada en comercio", status: "Abierto", lifecycle_status: "En atención", routing_status: "En cola", priority: "Alta", channel: "Teléfono", assigned_agent_id: null, created_at: "02 jul 2026, 18:22", updated_at: "04 jul 2026, 09:01", closed_at: null },
  ],
  accounts: [
    { account_id: "463836", full_name: "Cliente Demo Uno", email: "cliente.uno@example.com", country: "Chile", document: "RUT 11.111.111-1", phone: "+56 9 5000 1001", username: "CLIENTEUNO", customer_type: "Persona", segment: "Premium", plan: "Pro", kyc_status: "Aprobado", compliance_status: "Aprobado", nationality: "Chilena" },
    { account_id: "581204", full_name: "Cliente Demo Dos", email: "cliente.dos@example.com", country: "Perú", document: "DNI 70000002", phone: "+51 900 000 002", username: "CLIENTEDOS", customer_type: "Persona", segment: "Retail", plan: "Smart", kyc_status: "Aprobado", compliance_status: "En revisión", nationality: "Peruana" },
    { account_id: "720315", full_name: "Comercial Demo SpA", email: "contacto@example.com", country: "Chile", document: "RUT 76.000.003-3", phone: "+56 2 2000 3003", username: "COMERCIALDEMO", customer_type: "Empresa", segment: "Business", plan: "Business", kyc_status: "Aprobado", compliance_status: "Aprobado", nationality: "Chilena" },
  ],
  transactions: [
    { transaction_id: "tx-90001", date: "04 jul 2026, 10:32", amount: 1250.5, currency: "USD", status: "Completada" },
    { transaction_id: "tx-90002", date: "04 jul 2026, 09:18", amount: 850000, currency: "CLP", status: "En proceso" },
    { transaction_id: "tx-90003", date: "03 jul 2026, 17:45", amount: 320.25, currency: "USD", status: "Completada" },
    { transaction_id: "tx-90004", date: "02 jul 2026, 14:06", amount: 1450, currency: "PEN", status: "Rechazada" },
  ],
  activity: [],
  emails: [],
  ai: [],
};

const defaultColumnsBySource: Record<ReportSource, string[]> = {
  cases: ["case_number", "subject", "channel", "status", "created_at", "priority", "customer_id"],
  accounts: ["account_id", "full_name", "email", "country", "document", "plan", "kyc_status"],
  transactions: ["transaction_id", "date", "amount", "currency", "status"],
  activity: [],
  emails: [],
  ai: [],
};

export const reportSourceAdapters: Record<ReportSource, ReportSourceAdapter> = Object.fromEntries(
  reportSources.map((source) => [
    source.id,
    {
      source,
      defaultColumns: defaultColumnsBySource[source.id],
      dataset: reportSourceMocks[source.id],
    },
  ]),
) as Record<ReportSource, ReportSourceAdapter>;
