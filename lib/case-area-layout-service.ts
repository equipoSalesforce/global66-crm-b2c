import "server-only";

import type {
  CaseAreaLayout,
  CaseAreaLayoutField,
  CaseFieldDefinition,
  ResolvedCaseAreaLayout,
} from "@/lib/case-metadata";
import { supabase } from "@/lib/supabase";
import {
  legacyFieldsToCaseFormSchema,
  normalizeCaseFormLayoutSchema,
  projectLegacyCaseFields,
  schemaForCaseAreaLayout,
  type CaseFormLayoutSchema,
} from "@/lib/case-form-layout";

export type CaseAreaLayoutInput = {
  area: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
  fields?: CaseAreaLayoutField[];
  layoutSchema?: CaseFormLayoutSchema;
  updated_by?: string | null;
};

export class CaseAreaLayoutServiceError extends Error {}

function normalizeInput(input: CaseAreaLayoutInput) {
  const area = input.area.trim().toUpperCase();
  const name = input.name.trim();
  const legacyFields = (input.fields ?? [])
    .filter((field) => field.fieldKey.trim())
    .map((field, index) => ({
      fieldKey: field.fieldKey.trim(),
      label: field.label.trim() || field.fieldKey.trim(),
      order: Number.isFinite(field.order) ? field.order : (index + 1) * 10,
      required: Boolean(field.required),
      editable: field.editable !== false,
    }))
    .sort((left, right) => left.order - right.order);
  const layoutSchema = normalizeCaseFormLayoutSchema(input.layoutSchema) ??
    legacyFieldsToCaseFormSchema(legacyFields, name || "Formulario", input.description?.trim() || null);
  const fields = projectLegacyCaseFields(layoutSchema);

  if (!area || !name) {
    throw new CaseAreaLayoutServiceError("Área y nombre son obligatorios.");
  }

  return {
    area,
    name,
    description: input.description?.trim() || null,
    is_active: input.is_active !== false,
    fields,
    layout_schema: layoutSchema,
    updated_by: input.updated_by?.trim() || null,
  };
}

export async function listCaseAreaLayouts() {
  const [layoutsResult, fieldsResult] = await Promise.all([
    supabase
      .from("case_area_layouts")
      .select("*")
      .order("area", { ascending: true })
      .returns<CaseAreaLayout[]>(),
    supabase
      .from("case_field_definitions")
      .select("*")
      .eq("is_active", true)
      .order("label", { ascending: true })
      .returns<CaseFieldDefinition[]>(),
  ]);

  if (layoutsResult.error || fieldsResult.error) {
    throw new CaseAreaLayoutServiceError("No se pudieron cargar los layouts.");
  }

  return {
    layouts: layoutsResult.data ?? [],
    availableFields: fieldsResult.data ?? [],
  };
}

export async function getCaseAreaLayout(area: string): Promise<ResolvedCaseAreaLayout | null> {
  const normalizedArea = area.trim().toUpperCase();
  const loadArea = (areaKey: string) => supabase
    .from("case_area_layouts")
    .select("*")
    .eq("area", areaKey)
    .eq("is_active", true)
    .maybeSingle<CaseAreaLayout>();
  const initialResult = await loadArea(normalizedArea);
  const fallbackResult = !initialResult.error && !initialResult.data && normalizedArea !== "GENERAL"
    ? await loadArea("GENERAL")
    : initialResult;
  const { data: layout, error } = fallbackResult;

  if (error) throw new CaseAreaLayoutServiceError("No se pudo cargar el layout.");
  if (!layout) return null;

  const fieldKeys = layout.fields.map((field) => field.fieldKey);
  const { data: definitions, error: definitionsError } = fieldKeys.length
    ? await supabase
        .from("case_field_definitions")
        .select("*")
        .in("field_key", fieldKeys)
        .eq("is_active", true)
        .returns<CaseFieldDefinition[]>()
    : { data: [] as CaseFieldDefinition[], error: null };

  if (definitionsError) {
    throw new CaseAreaLayoutServiceError("No se pudieron resolver los campos del layout.");
  }

  return {
    ...layout,
    formSchema: schemaForCaseAreaLayout(layout),
    fieldDefinitions: definitions ?? [],
  };
}

export async function createCaseAreaLayout(input: CaseAreaLayoutInput) {
  const payload = normalizeInput(input);
  const { data, error } = await supabase
    .from("case_area_layouts")
    .insert({ ...payload, created_by: payload.updated_by })
    .select("*")
    .single<CaseAreaLayout>();

  if (error) throw new CaseAreaLayoutServiceError(error.message);
  return data;
}

export async function updateCaseAreaLayout(id: string, input: CaseAreaLayoutInput) {
  const payload = normalizeInput(input);
  const { data, error } = await supabase
    .from("case_area_layouts")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single<CaseAreaLayout>();

  if (error) throw new CaseAreaLayoutServiceError(error.message);
  return data;
}

export async function deactivateCaseAreaLayout(id: string) {
  const { error } = await supabase
    .from("case_area_layouts")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new CaseAreaLayoutServiceError(error.message);
}
