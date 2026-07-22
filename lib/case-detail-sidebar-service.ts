import "server-only";

import { getCaseAreaLayout } from "@/lib/case-area-layout-service";
import { listCaseDetailSectionConfiguration } from "@/lib/case-detail-section-config-service";
import { whatsappMatchesCustomerPhone } from "@/lib/case-detail-formulas";
import type {
  CaseDetailConfiguredField,
  CaseDetailFormItem,
  CaseDetailFormSection,
  CaseDetailFieldType,
  CaseDetailSidebarField,
  CaseDetailSidebarViewModel,
} from "@/lib/case-detail-sidebar-types";
import {
  getCustomerProfileForCase,
  type CaseCustomerIdentity,
  type CustomerOperationalProfile,
} from "@/lib/customer-profile-service";
import { formatCaseNumber } from "@/lib/case-status";
import type { CaseFieldDefinition } from "@/lib/case-metadata";
import { supabase } from "@/lib/supabase";

type CaseSidebarRecord = {
  [key: string]: unknown;
  id: string;
  case_number: string | null;
  area: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  assigned_to: string | null;
  assigned_agent_id: string | null;
  owner_type: string | null;
  assigned_queue_id: string | null;
  customer: CaseCustomerIdentity | null;
};

type CaseCsatRecord = {
  resolution_score: number | null;
  service_score: number | null;
  feedback: string | null;
  received_at: string | null;
  created_at: string;
};

type CustomValue = {
  field_definition_id: string;
  value_text: string | null;
  value_number: number | string | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_datetime: string | null;
  value_json: unknown;
};

type AttachmentRecord = {
  id: string;
  filename: string | null;
  created_at: string | null;
};

export class CaseDetailSidebarServiceError extends Error {}

function customValueForDefinition(
  definition: CaseFieldDefinition,
  value: CustomValue | undefined,
) {
  if (!value) return definition.default_value ?? null;
  if (definition.field_type === "boolean") return value.value_boolean;
  if (definition.field_type === "number" || definition.field_type === "currency") {
    return value.value_number;
  }
  if (definition.field_type === "date") return value.value_date;
  if (definition.field_type === "datetime") return value.value_datetime;
  return value.value_text ?? value.value_json;
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function resolveStatus(fieldType: CaseDetailFieldType, value: unknown) {
  if (fieldType !== "CHECK" && fieldType !== "BOOLEAN") return null;
  if (value === null || value === undefined || value === "") return "neutral" as const;
  return Boolean(value) ? "positive" as const : "negative" as const;
}

function resolveCaseValue(
  configuredField: CaseDetailConfiguredField,
  caseItem: CaseSidebarRecord,
  customValues: Map<string, unknown>,
  ownerLabel: string,
  attachment: AttachmentRecord | null,
) {
  const fieldKey = configuredField.fieldKey;
  if (fieldKey === "assigned_to") return ownerLabel;
  if (fieldKey === "attachment_link") return attachment?.filename ?? null;
  if (configuredField.definition.caseDefinition?.is_standard === false) {
    return customValues.get(fieldKey) ?? null;
  }
  return caseItem[fieldKey] ?? null;
}

function buildField({
  configuredField,
  caseItem,
  profile,
  csat,
  customValues,
  ownerLabel,
  attachment,
}: {
  configuredField: CaseDetailConfiguredField;
  caseItem: CaseSidebarRecord;
  profile: CustomerOperationalProfile | null;
  csat: CaseCsatRecord | null;
  customValues: Map<string, unknown>;
  ownerLabel: string;
  attachment: AttachmentRecord | null;
}): CaseDetailSidebarField {
  const definition = configuredField.definition;
  let value: unknown = null;
  let href: string | null = null;

  if (definition.sourceType === "CUSTOMER_PROFILE") {
    value = definition.sourcePath
      ? profile?.[definition.sourcePath as keyof CustomerOperationalProfile] ?? null
      : null;
  } else if (definition.sourceType === "CASE") {
    value = resolveCaseValue(configuredField, caseItem, customValues, ownerLabel, attachment);
    if (definition.fieldKey === "attachment_link" && attachment) {
      href = `/api/attachments/${attachment.id}/download`;
    }
    if (definition.fieldKey === "case_number") {
      value = formatCaseNumber(caseItem.case_number, caseItem.id).replace(/^Caso\s*/i, "");
    }
  } else if (definition.sourceType === "CSAT") {
    value = definition.sourcePath
      ? csat?.[definition.sourcePath as keyof CaseCsatRecord] ?? null
      : null;
  } else if (
    definition.sourceType === "FORMULA" &&
    definition.formulaKey === "WHATSAPP_MATCHES_CUSTOMER_PHONE"
  ) {
    value = whatsappMatchesCustomerPhone(caseItem.contact_phone, profile?.phone);
  }

  const renderedValue = displayValue(value);
  return {
    fieldKey: definition.fieldKey,
    label: definition.label,
    value: value as string | number | boolean | null,
    displayValue: renderedValue,
    fieldType: definition.fieldType,
    sourceType: definition.sourceType,
    isEditable: configuredField.isEditable,
    isCopyable: configuredField.isCopyable,
    copyValue: configuredField.isCopyable && renderedValue !== "—" ? renderedValue : null,
    href,
    status: resolveStatus(definition.fieldType, value),
    caseDefinition: definition.caseDefinition,
  };
}

async function getOwnerLabel(caseItem: CaseSidebarRecord) {
  if (caseItem.owner_type === "QUEUE" && caseItem.assigned_queue_id) {
    const { data } = await supabase.from("crm_queues").select("name")
      .eq("id", caseItem.assigned_queue_id).maybeSingle<{ name: string | null }>();
    return data?.name || caseItem.assigned_to || "Sin asignar";
  }
  if (caseItem.assigned_agent_id) {
    const { data } = await supabase.from("crm_users").select("name, email")
      .eq("id", caseItem.assigned_agent_id)
      .maybeSingle<{ name: string | null; email: string | null }>();
    return data?.name || data?.email || caseItem.assigned_to || "Sin asignar";
  }
  return caseItem.assigned_to || "Sin asignar";
}

async function getLatestAttachment(caseId: string) {
  const [emailResult, whatsappResult] = await Promise.all([
    supabase.from("message_attachments").select("id, filename, created_at")
      .eq("case_id", caseId).order("created_at", { ascending: false }).limit(1)
      .maybeSingle<AttachmentRecord>(),
    supabase.from("whatsapp_media_attachments").select("id, filename, created_at")
      .eq("case_id", caseId).order("created_at", { ascending: false }).limit(1)
      .maybeSingle<AttachmentRecord>(),
  ]);
  return [emailResult.data, whatsappResult.data]
    .filter((item): item is AttachmentRecord => Boolean(item))
    .sort((left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime())[0] ?? null;
}

export async function getCaseDetailSidebarViewModel(
  caseId: string,
): Promise<CaseDetailSidebarViewModel> {
  const [caseResult, csatResult, attachment] = await Promise.all([
    supabase.from("cases").select(
      "id, case_number, subject, description, numero_caso_seguimiento, priority, area, category, cat_secundaria, status, lifecycle_status, routing_status, contact_name, contact_email, contact_phone, channel, contact_type, product, subproduct, ai_category, resolution_type, is_edge_case, assigned_to, assigned_agent_id, owner_type, assigned_queue_id, customer:customers(id, customer_id, public_id, name, email, phone)",
    ).eq("id", caseId).maybeSingle<CaseSidebarRecord>(),
    supabase.from("case_csat")
      .select("resolution_score, service_score, feedback, received_at, created_at")
      .eq("case_id", caseId).order("received_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }).limit(1).maybeSingle<CaseCsatRecord>(),
    getLatestAttachment(caseId),
  ]);

  if (caseResult.error || !caseResult.data) {
    throw new CaseDetailSidebarServiceError("No se pudo cargar el caso para el sidebar.");
  }
  if (csatResult.error) throw new CaseDetailSidebarServiceError("No se pudo cargar CSAT del caso.");

  const caseItem = caseResult.data;
  const [configuration, formLayout] = await Promise.all([
    listCaseDetailSectionConfiguration(caseItem.area ?? "GENERAL"),
    getCaseAreaLayout(caseItem.area ?? "GENERAL"),
  ]);
  const availableFieldsByRegistry = new Map(
    configuration.availableFields.map((field) => [field.registryId, field]),
  );
  const configuredSidebarFields = configuration.sections.flatMap((section) => section.fields);
  const configuredFormFields = (formLayout?.formSchema.sections ?? [])
    .flatMap((section) => section.items)
    .flatMap((item) => item.type === "FIELD"
      ? [availableFieldsByRegistry.get(`${item.sourceType}:${item.fieldKey}`)]
      : [],
    )
    .filter((field) => Boolean(field));
  const customDefinitions = [
    ...configuredSidebarFields.map((field) => field.definition),
    ...configuredFormFields,
  ]
    .map((field) => field?.caseDefinition)
    .filter((definition): definition is CaseFieldDefinition =>
      Boolean(definition && definition.is_standard === false && definition.field_key !== "attachment_link"),
    );
  const uniqueCustomDefinitions = [...new Map(customDefinitions.map((field) => [field.id, field])).values()];
  const { data: customValueRows, error: customValuesError } = uniqueCustomDefinitions.length
    ? await supabase.from("case_custom_values")
        .select("field_definition_id, value_text, value_number, value_boolean, value_date, value_datetime, value_json")
        .eq("case_id", caseId)
        .in("field_definition_id", uniqueCustomDefinitions.map((definition) => definition.id))
        .returns<CustomValue[]>()
    : { data: [] as CustomValue[], error: null };
  if (customValuesError) {
    throw new CaseDetailSidebarServiceError("No se pudieron cargar los campos personalizados del caso.");
  }
  const customRowsByDefinition = new Map(
    (customValueRows ?? []).map((value) => [value.field_definition_id, value]),
  );
  const customValues = new Map(uniqueCustomDefinitions.map((definition) => [
    definition.field_key,
    customValueForDefinition(definition, customRowsByDefinition.get(definition.id)),
  ]));
  const [profile, ownerLabel] = await Promise.all([
    getCustomerProfileForCase(caseItem.customer),
    getOwnerLabel(caseItem),
  ]);
  const fieldContext = {
    caseItem,
    profile,
    csat: csatResult.data,
    customValues,
    ownerLabel,
    attachment,
  };
  const formSections: CaseDetailFormSection[] = (formLayout?.formSchema.sections ?? []).map(
    (section) => ({
      id: section.id,
      name: section.name,
      description: section.description,
      items: section.items.flatMap((item): CaseDetailFormItem[] => {
        if (item.type === "SPACER") {
          return [{
            id: item.id,
            type: "SPACER" as const,
            columnSpan: item.columnSpan,
          }];
        }

        const definition = availableFieldsByRegistry.get(
          `${item.sourceType}:${item.fieldKey}`,
        );
        if (!definition || !definition.isActive) return [];

        const configuredField: CaseDetailConfiguredField = {
          fieldKey: item.fieldKey,
          sourceType: item.sourceType,
          sortOrder: item.order,
          isVisible: true,
          isEditable:
            item.sourceType === "CASE" && item.editable && definition.isEditable,
          isCopyable: definition.isCopyable,
          inheritedFromGeneral:
            configuration.area !== "GENERAL" && formLayout?.area === "GENERAL",
          definition,
        };

        return [{
          id: item.id,
          type: "FIELD" as const,
          required: item.required || definition.isRequired,
          editable: configuredField.isEditable,
          columnSpan: item.columnSpan,
          field: buildField({ configuredField, ...fieldContext }),
        }];
      }),
    }),
  );

  return {
    caseId,
    area: configuration.area,
    customerPublicId: profile?.publicId || caseItem.customer?.public_id || null,
    customerPhone: profile?.phone || caseItem.customer?.phone || null,
    sections: configuration.sections.map((section) => ({
      sectionKey: section.sectionKey,
      title: section.name,
      fields: section.fields.filter((field) => field.isVisible).map((configuredField) =>
        buildField({ configuredField, ...fieldContext }),
      ),
    })),
    formSections,
  };
}
