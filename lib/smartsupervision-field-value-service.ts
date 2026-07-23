import "server-only";

import {
  readSmartSupervisionValue,
  smartSupervisionBoolean,
  smartSupervisionString,
} from "@/lib/smartsupervision-payload";
import { serializeSmartSupervisionError } from "@/lib/smartsupervision-errors";
import type {
  SmartSupervisionComplaintPayload,
  SmartSupervisionCustomFieldValue,
} from "@/lib/smartsupervision-types";
import type { CaseFieldDefinition } from "@/lib/case-metadata";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CaseCustomValueRow = {
  field_definition_id: string;
  value_text: string | null;
  value_number: number | string | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_datetime: string | null;
  value_json: unknown;
  field_definition: CaseFieldDefinition | null;
};

export class SmartSupervisionFieldValueError extends Error {}

function customValue(row: CaseCustomValueRow) {
  if (row.value_text !== null) return row.value_text;
  if (row.value_number !== null) return Number(row.value_number);
  if (row.value_boolean !== null) return row.value_boolean;
  if (row.value_date !== null) return row.value_date;
  if (row.value_datetime !== null) return row.value_datetime;
  return row.value_json;
}

export async function getCaseCustomFieldValues(caseId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("case_custom_values")
    .select("field_definition_id, value_text, value_number, value_boolean, value_date, value_datetime, value_json, field_definition:case_field_definitions(*)")
    .eq("case_id", caseId)
    .returns<CaseCustomValueRow[]>();
  if (error) throw error;

  return (data ?? []).flatMap((row): SmartSupervisionCustomFieldValue[] => {
    const field = row.field_definition;
    if (!field) return [];
    return [{
      fieldDefinitionId: field.id,
      fieldKey: field.field_key,
      label: field.label,
      fieldType: field.field_type,
      picklistValues: field.picklist_values ?? [],
      value: customValue(row),
    }];
  });
}

async function getFieldDefinition(fieldKey: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("case_field_definitions")
    .select("*")
    .eq("field_key", fieldKey)
    .eq("is_active", true)
    .maybeSingle<CaseFieldDefinition>();
  if (error) throw error;
  if (!data || data.storage_type !== "CUSTOM_VALUE") {
    throw new SmartSupervisionFieldValueError(`Campo custom CASE no encontrado: ${fieldKey}.`);
  }
  return data;
}

export async function upsertCaseCustomFieldValue(
  caseId: string,
  fieldKey: string,
  value: unknown,
) {
  const field = await getFieldDefinition(fieldKey);
  const picklistValue = smartSupervisionString(value);
  if (
    field.field_type === "picklist" &&
    (!picklistValue || !(field.picklist_values ?? []).includes(picklistValue))
  ) {
    throw new SmartSupervisionFieldValueError(
      `Valor fuera de picklist para ${fieldKey}: ${picklistValue ?? "vacío"}.`,
    );
  }

  const raw = smartSupervisionString(value);
  const payload = {
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
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      throw new SmartSupervisionFieldValueError(`Valor numérico inválido para ${fieldKey}.`);
    }
    payload.value_number = numberValue;
  } else if (field.field_type === "boolean") {
    const booleanValue = smartSupervisionBoolean(value);
    if (booleanValue === null) {
      throw new SmartSupervisionFieldValueError(`Valor booleano inválido para ${fieldKey}.`);
    }
    payload.value_boolean = booleanValue;
  } else if (field.field_type === "date") {
    payload.value_date = raw;
  } else if (field.field_type === "datetime") {
    payload.value_datetime = raw;
  } else if (typeof value === "object" && value !== null) {
    payload.value_json = value;
  } else {
    payload.value_text = raw;
  }

  const { error } = await getSupabaseAdmin()
    .from("case_custom_values")
    .upsert(payload, { onConflict: "case_id,field_definition_id" });
  if (error) throw error;
  return field;
}

export async function populateSmartSupervisionCaseFields(
  caseId: string,
  payload: SmartSupervisionComplaintPayload,
) {
  const { data: definitions, error } = await getSupabaseAdmin()
    .from("case_field_definitions")
    .select("*")
    .eq("storage_type", "CUSTOM_VALUE")
    .like("description", "[SmartSupervisión/SFC]%")
    .eq("is_active", true)
    .returns<CaseFieldDefinition[]>();
  if (error) throw error;

  const warnings: string[] = [];
  for (const field of definitions ?? []) {
    const value = field.field_key === "Country__c"
      ? readSmartSupervisionValue(payload, "Country__c", "codigo_pais__c")
      : readSmartSupervisionValue(payload, field.field_key);
    if (value === null) continue;
    const normalizedValue = field.field_key === "Country__c" && value === "COL"
      ? "Colombia"
      : value;
    try {
      await upsertCaseCustomFieldValue(caseId, field.field_key, normalizedValue);
    } catch (fieldError) {
      warnings.push(serializeSmartSupervisionError(fieldError));
    }
  }
  return warnings;
}
