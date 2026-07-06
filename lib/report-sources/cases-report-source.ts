import type { CaseCustomValue, CaseFieldDefinition } from "../case-metadata";
import type { ReportField, ReportFieldType, ReportSourceAdapter, ReportSourceRow } from "../informes-sources";

export type CaseReportRecord = Record<string, string | number | boolean | null> & { id: string | number | null };

export type CasesReportSourcePayload = {
  fields: ReportField[];
  rows: ReportSourceRow[];
  defaultColumns: string[];
  dataSource: "supabase";
};

const standardFields: ReportField[] = [
  ["id", "ID", "id"], ["case_number", "N.º de caso", "id"], ["customer_id", "Cliente", "id"],
  ["subject", "Asunto", "text"], ["status", "Estado", "picklist"], ["lifecycle_status", "Estado de ciclo", "picklist"],
  ["routing_status", "Estado de enrutamiento", "picklist"], ["priority", "Prioridad", "picklist"], ["channel", "Canal", "picklist"],
  ["assigned_agent_id", "Agente asignado", "id"], ["assigned_to", "Propietario del caso", "text"],
  ["created_at", "Fecha/Hora de apertura", "datetime"], ["updated_at", "Actualizado", "datetime"], ["closed_at", "Cerrado", "datetime"],
].map(([name, label, type]) => buildReportField({ name, label, type: type as ReportFieldType, isCustom: false }));

function mapFieldType(type: string): ReportFieldType {
  const normalized = type.trim().toLowerCase();
  if (["text", "textarea", "url"].includes(normalized)) return "text";
  if (normalized === "picklist") return "picklist";
  if (normalized === "date") return "date";
  if (normalized === "datetime") return "datetime";
  if (normalized === "number") return "number";
  if (normalized === "currency") return "currency";
  if (["checkbox", "boolean"].includes(normalized)) return "boolean";
  if (normalized === "email") return "email";
  if (normalized === "phone") return "phone";
  return "text";
}

function buildReportField(input: { name: string; label: string; type: ReportFieldType; isCustom: boolean; required?: boolean; description?: string | null }): ReportField {
  const groupable = ["picklist", "date", "datetime", "boolean"].includes(input.type) || (input.type === "text" && input.isCustom);
  const aggregatable = ["number", "currency"].includes(input.type);
  return {
    name: input.name,
    label: input.label,
    type: input.type,
    sourceField: input.name,
    objectName: "case",
    isCustom: input.isCustom,
    required: input.required ?? false,
    groupable,
    filterable: true,
    aggregatable,
    sortable: true,
    visible: true,
    description: input.description ?? undefined,
  };
}

export function getCaseReportFields(definitions: CaseFieldDefinition[]): ReportField[] {
  const fields = new Map(standardFields.map((field) => [field.name, field]));
  definitions.filter((definition) => definition.is_active !== false).forEach((definition) => {
    const existing = fields.get(definition.field_key);
    fields.set(definition.field_key, buildReportField({
      name: definition.field_key,
      label: definition.label || existing?.label || definition.field_key,
      type: mapFieldType(definition.field_type),
      isCustom: definition.is_standard !== true,
      required: definition.is_required === true,
      description: definition.description,
    }));
  });
  return [...fields.values()];
}

export function getCaseCustomFieldDefinitions(definitions: CaseFieldDefinition[]) {
  return definitions.filter((definition) => definition.is_active !== false && definition.is_standard !== true);
}

export function getCaseCustomValues(values: CaseCustomValue[]) {
  return values;
}

function customValue(value: CaseCustomValue) {
  if (value.value_number !== null) return Number(value.value_number);
  if (value.value_boolean !== null) return value.value_boolean;
  if (value.value_date !== null) return value.value_date;
  if (value.value_datetime !== null) return value.value_datetime;
  if (value.value_text !== null) return value.value_text;
  if (value.value_json !== null && value.value_json !== undefined) return JSON.stringify(value.value_json);
  return null;
}

export function buildCaseReportRows(cases: CaseReportRecord[], definitions: CaseFieldDefinition[], customValues: CaseCustomValue[]): ReportSourceRow[] {
  const fieldKeyById = new Map(definitions.map((definition) => [definition.id, definition.field_key]));
  const valuesByCase = new Map<string, Record<string, string | number | boolean | null>>();
  customValues.forEach((value) => {
    const fieldKey = fieldKeyById.get(value.field_definition_id);
    if (!fieldKey) return;
    const caseId = String(value.case_id);
    valuesByCase.set(caseId, { ...(valuesByCase.get(caseId) ?? {}), [fieldKey]: customValue(value) });
  });
  return cases.filter((caseItem) => caseItem.id !== null).map((caseItem) => ({ ...caseItem, id: String(caseItem.id), ...(valuesByCase.get(String(caseItem.id)) ?? {}) }));
}

export function getCaseReportRows(cases: CaseReportRecord[], definitions: CaseFieldDefinition[], customValues: CaseCustomValue[]) {
  return buildCaseReportRows(cases, definitions, customValues);
}

export function buildCasesReportSourceAdapter(cases: CaseReportRecord[], definitions: CaseFieldDefinition[], customValues: CaseCustomValue[]): ReportSourceAdapter {
  return {
    source: { id: "cases", label: "Casos", description: "Casos y campos personalizados del Object Manager.", enabled: true, fields: getCaseReportFields(definitions) },
    defaultColumns: ["case_number", "subject", "channel", "status", "created_at", "priority", "customer_id"],
    dataset: buildCaseReportRows(cases, definitions, customValues),
  };
}
