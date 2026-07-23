export const caseFieldTypes = [
  "text",
  "textarea",
  "number",
  "currency",
  "date",
  "datetime",
  "boolean",
  "picklist",
  "email",
  "phone",
  "url",
] as const;

export type CaseFieldType = (typeof caseFieldTypes)[number];

export type CaseFieldDefinition = {
  id: string;
  field_key: string;
  label: string;
  field_type: CaseFieldType;
  description: string | null;
  is_required: boolean | null;
  is_active: boolean | null;
  is_standard?: boolean | null;
  storage_type?: "COLUMN" | "CUSTOM_VALUE" | "VIRTUAL" | null;
  column_name?: string | null;
  is_editable?: boolean | null;
  is_filterable?: boolean | null;
  is_list_visible?: boolean | null;
  is_form_eligible?: boolean | null;
  is_detail_eligible?: boolean | null;
  is_system?: boolean | null;
  sort_order?: number | null;
  picklist_values: string[] | null;
  default_value: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function isCustomValueCaseField(field: CaseFieldDefinition) {
  return field.storage_type === "CUSTOM_VALUE" ||
    (field.storage_type == null && field.is_standard !== true);
}

export function isColumnCaseField(field: CaseFieldDefinition) {
  return field.storage_type === "COLUMN" ||
    (field.storage_type == null && field.is_standard === true);
}

export type CaseLayoutTab = {
  id: string;
  tab_key: string;
  label: string;
  sort_order: number | null;
  is_active: boolean | null;
  is_system?: boolean | null;
  created_at?: string | null;
};

export const standardCaseFieldKeys = [
  "subject",
  "priority",
  "area",
  "category",
  "status",
  "lifecycle_status",
  "routing_status",
  "contact_name",
  "contact_email",
  "contact_phone",
  "channel",
  "contact_type",
  "assigned_to",
  "assigned_agent_id",
  "case_number",
] as const;

export function isStandardCaseFieldKey(value: string) {
  return standardCaseFieldKeys.includes(value as (typeof standardCaseFieldKeys)[number]);
}

export function getStandardCaseValue(
  caseItem: Record<string, unknown>,
  field: CaseFieldDefinition,
) {
  const value = caseItem[field.field_key];

  if (value === null || value === undefined) {
    return field.default_value ?? "";
  }

  if (field.field_type === "datetime" && typeof value === "string") {
    return value.slice(0, 16);
  }

  if (field.field_type === "boolean") {
    return Boolean(value);
  }

  return String(value);
}

export type CaseLayoutSection = {
  id: string;
  tab_id: string;
  label: string;
  sort_order: number | null;
  is_active: boolean | null;
};

export type CaseLayoutField = {
  id: string;
  section_id: string;
  field_definition_id: string;
  sort_order: number | null;
  column_span: number | null;
  is_readonly: boolean | null;
};

export type CaseCustomValue = {
  id: string;
  case_id: string;
  field_definition_id: string;
  value_text: string | null;
  value_number: number | string | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_datetime: string | null;
  value_json: unknown;
  updated_at: string | null;
};

export type CaseLayoutFieldWithDefinition = CaseLayoutField & {
  field_definition: CaseFieldDefinition | null;
};

export type CaseLayoutSectionWithFields = CaseLayoutSection & {
  fields: CaseLayoutFieldWithDefinition[];
};

export type CaseLayoutTabWithSections = CaseLayoutTab & {
  sections: CaseLayoutSectionWithFields[];
};

export type CaseAreaLayoutField = {
  fieldKey: string;
  label: string;
  order: number;
  required: boolean;
  editable: boolean;
};

export type CaseAreaLayout = {
  id: string;
  area: string;
  name: string;
  description: string | null;
  is_active: boolean;
  fields: CaseAreaLayoutField[];
  layout_schema?: unknown;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type ResolvedCaseAreaLayout = CaseAreaLayout & {
  formSchema: import("@/lib/case-form-layout").CaseFormLayoutSchema;
  fieldDefinitions: CaseFieldDefinition[];
};

export function normalizeFieldKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

export function getCustomValueForField(
  field: CaseFieldDefinition,
  value: CaseCustomValue | undefined,
) {
  if (!value) {
    return field.default_value ?? "";
  }

  if (field.field_type === "number" || field.field_type === "currency") {
    return value.value_number === null || value.value_number === undefined
      ? field.default_value ?? ""
      : String(value.value_number);
  }

  if (field.field_type === "boolean") {
    return value.value_boolean ?? field.default_value === "true";
  }

  if (field.field_type === "date") {
    return value.value_date ?? field.default_value ?? "";
  }

  if (field.field_type === "datetime") {
    return value.value_datetime
      ? value.value_datetime.slice(0, 16)
      : field.default_value ?? "";
  }

  return value.value_text ?? field.default_value ?? "";
}

export function buildCustomValuePayload({
  caseId,
  field,
  rawValue,
}: {
  caseId: string;
  field: CaseFieldDefinition;
  rawValue: FormDataEntryValue | null;
}) {
  const stringValue = typeof rawValue === "string" ? rawValue.trim() : "";
  const basePayload = {
    case_id: caseId,
    field_definition_id: field.id,
    value_text: null as string | null,
    value_number: null as number | null,
    value_boolean: null as boolean | null,
    value_date: null as string | null,
    value_datetime: null as string | null,
    value_json: null as unknown,
    updated_at: new Date().toISOString(),
  };

  if (field.field_type === "number" || field.field_type === "currency") {
    basePayload.value_number = stringValue ? Number(stringValue) : null;
    return basePayload;
  }

  if (field.field_type === "boolean") {
    basePayload.value_boolean = rawValue === "on" || rawValue === "true";
    return basePayload;
  }

  if (field.field_type === "date") {
    basePayload.value_date = stringValue || null;
    return basePayload;
  }

  if (field.field_type === "datetime") {
    basePayload.value_datetime = stringValue
      ? new Date(stringValue).toISOString()
      : null;
    return basePayload;
  }

  basePayload.value_text = stringValue || null;
  return basePayload;
}

export function validateCustomFieldValue({
  field,
  rawValue,
}: {
  field: CaseFieldDefinition;
  rawValue: FormDataEntryValue | null;
}) {
  const stringValue = typeof rawValue === "string" ? rawValue.trim() : "";

  if (field.is_required && field.field_type !== "boolean" && !stringValue) {
    return `${field.label} es obligatorio.`;
  }

  if (
    (field.field_type === "number" || field.field_type === "currency") &&
    stringValue &&
    !Number.isFinite(Number(stringValue))
  ) {
    return `${field.label} debe ser numérico.`;
  }

  if (
    field.field_type === "picklist" &&
    stringValue &&
    Array.isArray(field.picklist_values) &&
    field.picklist_values.length > 0 &&
    !field.picklist_values.includes(stringValue)
  ) {
    return `${field.label} no tiene una opción válida.`;
  }

  return null;
}
