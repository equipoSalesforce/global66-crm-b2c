import "server-only";

import type { CaseFieldDefinition, CaseFieldType } from "@/lib/case-metadata";
import {
  caseDetailSectionKeys,
  caseDetailSourceTypes,
  type CaseDetailAvailableField,
  type CaseDetailConfiguredSection,
  type CaseDetailFieldType,
  type CaseDetailSectionConfigRecord,
  type CaseDetailSectionConfiguration,
  type CaseDetailSectionFieldInput,
  type CaseDetailSectionFieldRecord,
  type CaseDetailSectionKey,
  type CaseDetailSourceType,
} from "@/lib/case-detail-sidebar-types";
import { caseDetailSystemFields } from "@/lib/case-detail-system-fields";
import { normalizeCaseFormLayoutSchema } from "@/lib/case-form-layout";
import { supabase } from "@/lib/supabase";

export class CaseDetailSectionConfigError extends Error {}

const defaultAreas = [
  "GENERAL",
  "SOPORTE",
  "OPERACIONES",
  "COMPLIANCE",
  "FRAUDE",
  "CX",
];
const readOnlyCaseFields = new Set([
  "case_number",
  "assigned_agent_id",
  "assigned_to",
  "attachment_link",
]);

type FormLayoutCatalogRow = {
  layout_schema: unknown;
  fields: Array<{
    fieldKey?: string;
    label?: string;
    required?: boolean;
  }> | null;
};

export function isCaseDetailSectionKey(value: string): value is CaseDetailSectionKey {
  return caseDetailSectionKeys.includes(value as CaseDetailSectionKey);
}

function normalizeArea(value: string | null | undefined) {
  return value?.trim().toUpperCase() || "GENERAL";
}

function toDetailFieldType(fieldType: CaseFieldType): CaseDetailFieldType {
  if (fieldType === "email") return "EMAIL";
  if (fieldType === "phone") return "PHONE";
  if (fieldType === "url") return "LINK";
  if (fieldType === "boolean") return "CHECK";
  if (fieldType === "number" || fieldType === "currency") return "NUMBER";
  if (fieldType === "picklist") return "BADGE";
  return "TEXT";
}

function caseRegistryField(definition: CaseFieldDefinition): CaseDetailAvailableField {
  const isEditable = definition.is_editable ?? !readOnlyCaseFields.has(definition.field_key);
  return {
    registryId: `CASE:${definition.field_key}`,
    fieldKey: definition.field_key,
    label: definition.label,
    sourceType: "CASE",
    sourcePath: definition.field_key,
    fieldType: toDetailFieldType(definition.field_type),
    formulaKey: null,
    isCopyable: definition.field_type !== "boolean",
    isEditable,
    isRequired: Boolean(definition.is_required),
    isActive: definition.is_active !== false,
    caseDefinition: definition,
    supportedViews: [
      ...(definition.is_detail_eligible === false ? [] : ["SIDEBAR" as const]),
      ...(definition.is_form_eligible === false ? [] : ["FORM" as const]),
    ],
  };
}

function registryKey(sourceType: CaseDetailSourceType, fieldKey: string) {
  return `${sourceType}:${fieldKey}`;
}

export async function listCaseDetailSectionConfiguration(
  requestedArea = "GENERAL",
): Promise<CaseDetailSectionConfiguration> {
  const area = normalizeArea(requestedArea);
  const [sectionsResult, caseFieldsResult, layoutFieldsResult, formLayoutsResult] = await Promise.all([
    supabase
      .from("case_detail_section_configs")
      .select("*")
      .order("created_at", { ascending: true })
      .returns<CaseDetailSectionConfigRecord[]>(),
    supabase
      .from("case_field_definitions")
      .select("*")
      .eq("is_active", true)
      .order("label", { ascending: true })
      .returns<CaseFieldDefinition[]>(),
    supabase
      .from("case_detail_section_fields")
      .select("*")
      .order("sort_order", { ascending: true })
      .returns<CaseDetailSectionFieldRecord[]>(),
    supabase
      .from("case_area_layouts")
      .select("layout_schema, fields")
      .eq("is_active", true)
      .returns<FormLayoutCatalogRow[]>(),
  ]);

  const error = sectionsResult.error ?? caseFieldsResult.error ?? layoutFieldsResult.error ?? formLayoutsResult.error;
  if (error) {
    throw new CaseDetailSectionConfigError(
      "No se pudo cargar la configuración del detalle del caso.",
    );
  }

  const databaseCaseDefinitions = caseFieldsResult.data ?? [];
  const knownCaseFieldKeys = new Set(databaseCaseDefinitions.map((field) => field.field_key));
  // Reparación temporal: permite resolver referencias antiguas mientras la migración
  // 202607220004 registra todas las columnas CASE en case_field_definitions.
  const formReferencedCaseFields = (formLayoutsResult.data ?? []).flatMap((layout) => {
    const schema = normalizeCaseFormLayoutSchema(layout.layout_schema);
    if (schema) {
      return schema.sections.flatMap((section) => section.items).flatMap((item) =>
        item.type === "FIELD" && item.sourceType === "CASE"
          ? [{ fieldKey: item.fieldKey, label: item.label, required: item.required }]
          : [],
      );
    }
    return (layout.fields ?? []).flatMap((field) =>
      field.fieldKey?.trim()
        ? [{
            fieldKey: field.fieldKey.trim(),
            label: field.label?.trim() || field.fieldKey.trim(),
            required: Boolean(field.required),
          }]
        : [],
    );
  });
  const fallbackDefinitions = [...new Map(
    formReferencedCaseFields
      .filter((field) => !knownCaseFieldKeys.has(field.fieldKey))
      .map((field) => [field.fieldKey, field]),
  ).values()].map((field): CaseFieldDefinition => ({
    id: `layout:${field.fieldKey}`,
    field_key: field.fieldKey,
    label: field.label,
    field_type: "text",
    description: "Campo estándar referenciado por el layout del caso.",
    is_required: field.required,
    is_active: true,
    is_standard: true,
    picklist_values: [],
    default_value: null,
  }));
  const caseDefinitions = [...databaseCaseDefinitions, ...fallbackDefinitions];
  const availableFields = [
    ...caseDefinitions.map(caseRegistryField),
    ...caseDetailSystemFields,
  ];
  const availableByRegistry = new Map(
    availableFields.map((field) => [field.registryId, field]),
  );
  const layoutRows = layoutFieldsResult.data ?? [];
  const hasOwnConfiguration = area === "GENERAL" || layoutRows.some(
    (field) => field.area === area,
  );

  const sections: CaseDetailConfiguredSection[] = (sectionsResult.data ?? [])
    .filter((section) => section.is_active)
    .map((section) => {
      const areaRows = layoutRows.filter(
        (field) =>
          field.section_key === section.section_key && field.area === area,
      );
      const generalRows = layoutRows.filter(
        (field) =>
          field.section_key === section.section_key && field.area === "GENERAL",
      );
      const resolvedRows = area !== "GENERAL" && areaRows.length > 0
        ? areaRows
        : generalRows;
      const inheritedFromGeneral = area !== "GENERAL" && areaRows.length === 0;

      return {
        id: section.id,
        sectionKey: section.section_key,
        name: section.name,
        description: section.description,
        isActive: section.is_active,
        fields: resolvedRows
          .flatMap((field) => {
            const definition = availableByRegistry.get(
              registryKey(field.source_type, field.field_key),
            );
            return definition
              ? [{
                  fieldKey: field.field_key,
                  sourceType: field.source_type,
                  sortOrder: field.sort_order,
                  isVisible: field.is_visible,
                  isEditable: field.is_editable && definition.isEditable,
                  isCopyable: field.is_copyable && definition.isCopyable,
                  inheritedFromGeneral,
                  definition,
                }]
              : [];
          })
          .sort((left, right) => left.sortOrder - right.sortOrder),
      };
    })
    .sort(
      (left, right) =>
        caseDetailSectionKeys.indexOf(left.sectionKey) -
        caseDetailSectionKeys.indexOf(right.sectionKey),
    );

  const areaField = caseDefinitions.find((field) => field.field_key === "area");
  const configuredAreas = layoutRows.map((field) => field.area);
  const areas = [...new Set([
    ...defaultAreas,
    ...(areaField?.picklist_values ?? []),
    ...configuredAreas,
    area,
  ].map(normalizeArea))];

  return { area, areas, hasOwnConfiguration, sections, availableFields };
}

export async function updateCaseDetailSectionFields(
  sectionKey: string,
  areaInput: string,
  fields: CaseDetailSectionFieldInput[],
) {
  if (!isCaseDetailSectionKey(sectionKey)) {
    throw new CaseDetailSectionConfigError("Sección de detalle inválida.");
  }

  const area = normalizeArea(areaInput);
  const configuration = await listCaseDetailSectionConfiguration(area);
  const availableKeys = new Set(
    configuration.availableFields.map((field) => field.registryId),
  );
  const normalizedFields = fields.map((field, index) => ({
    area,
    section_key: sectionKey,
    source_type: field.sourceType,
    field_key: field.fieldKey.trim(),
    sort_order: Number.isFinite(field.sortOrder)
      ? Math.max(0, Math.round(field.sortOrder))
      : (index + 1) * 10,
    is_visible: Boolean(field.isVisible),
    is_editable: field.sourceType === "CASE" && Boolean(field.isEditable),
    is_copyable: Boolean(field.isCopyable),
  }));
  const uniqueKeys = new Set(
    normalizedFields.map((field) => registryKey(field.source_type, field.field_key)),
  );

  if (
    normalizedFields.some(
      (field) =>
        !field.field_key ||
        !caseDetailSourceTypes.includes(field.source_type) ||
        !availableKeys.has(registryKey(field.source_type, field.field_key)),
    )
  ) {
    throw new CaseDetailSectionConfigError(
      "La configuración contiene campos inexistentes o inactivos.",
    );
  }
  if (uniqueKeys.size !== normalizedFields.length) {
    throw new CaseDetailSectionConfigError("La sección contiene campos duplicados.");
  }

  const { error: hideError } = await supabase
    .from("case_detail_section_fields")
    .update({ is_visible: false, updated_at: new Date().toISOString() })
    .eq("area", area)
    .eq("section_key", sectionKey);
  if (hideError) throw new CaseDetailSectionConfigError(hideError.message);

  const { error } = normalizedFields.length
    ? await supabase
        .from("case_detail_section_fields")
        .upsert(normalizedFields, {
          onConflict: "area,section_key,source_type,field_key",
        })
    : { error: null };

  if (error) throw new CaseDetailSectionConfigError(error.message);
  return listCaseDetailSectionConfiguration(area);
}

export async function createCaseDetailAreaConfiguration(areaInput: string) {
  const area = normalizeArea(areaInput);
  if (area === "GENERAL") return listCaseDetailSectionConfiguration(area);

  const { data: generalRows, error: readError } = await supabase
    .from("case_detail_section_fields")
    .select("section_key, source_type, field_key, sort_order, is_visible, is_editable, is_copyable")
    .eq("area", "GENERAL")
    .returns<Array<Omit<CaseDetailSectionFieldRecord, "id" | "area" | "created_at" | "updated_at">>>();
  if (readError) throw new CaseDetailSectionConfigError(readError.message);

  const rows = (generalRows ?? []).map((row) => ({ ...row, area }));
  if (rows.length > 0) {
    const { error } = await supabase.from("case_detail_section_fields").upsert(rows, {
      onConflict: "area,section_key,source_type,field_key",
    });
    if (error) throw new CaseDetailSectionConfigError(error.message);
  }
  return listCaseDetailSectionConfiguration(area);
}

export async function restoreCaseDetailAreaInheritance(areaInput: string) {
  const area = normalizeArea(areaInput);
  if (area === "GENERAL") {
    throw new CaseDetailSectionConfigError("GENERAL es la configuración base y no puede heredar.");
  }
  const { error } = await supabase
    .from("case_detail_section_fields")
    .delete()
    .eq("area", area);
  if (error) throw new CaseDetailSectionConfigError(error.message);
  return listCaseDetailSectionConfiguration(area);
}
