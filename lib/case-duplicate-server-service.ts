import "server-only";

import { authorizeCaseAction } from "@/lib/case-action-authorization";
import { createCaseAuditEvents } from "@/lib/case-audit";
import { generateNextCaseNumber } from "@/lib/case-number";
import {
  buildCustomValuePayload,
  validateCustomFieldValue,
  type CaseFieldDefinition,
} from "@/lib/case-metadata";
import type {
  DuplicateCaseInput,
  DuplicateCaseResult,
  ResolvedCaseOwner,
} from "@/lib/case-ownership-types";
import { supabase } from "@/lib/supabase";

type DuplicateSourceCase = {
  id: string;
  case_number: string | null;
  customer_id: string | null;
  subject: string | null;
  channel: string | null;
  contact_type: string | null;
  priority: string | null;
  area: string | null;
  category: string | null;
  product: string | null;
  subproduct: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  owner_type: string | null;
  assigned_agent_id: string | null;
  assigned_queue_id: string | null;
  assigned_to: string | null;
};

type CustomValueRow = {
  field_definition_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_datetime: string | null;
  value_json: unknown;
};

function editableText(value: unknown, fallback: string | null, maxLength = 500) {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Los campos editables deben ser texto.");
  return value.trim().slice(0, maxLength) || null;
}

async function resolveAssignment(
  assignment: DuplicateCaseInput["assignment"],
  source: DuplicateSourceCase,
): Promise<{ owner: ResolvedCaseOwner | null; ownerType: "USER" | "QUEUE"; agentId: string | null; queueId: string | null }> {
  if (assignment === null) {
    return { owner: null, ownerType: "USER", agentId: null, queueId: null };
  }

  const ownerType = assignment?.ownerType ?? (source.owner_type === "QUEUE" ? "QUEUE" : "USER");
  const agentId = assignment ? assignment.assignedAgentId ?? null : source.assigned_agent_id;
  const queueId = assignment ? assignment.assignedQueueId ?? null : source.assigned_queue_id;
  if (ownerType === "USER") {
    if (!agentId) return { owner: null, ownerType, agentId: null, queueId: null };
    if (queueId && assignment) throw new Error("No se puede asignar usuario y cola al mismo tiempo.");
    const { data, error } = await supabase
      .from("crm_users")
      .select("id, name, email, role, team, area")
      .eq("id", agentId)
      .eq("status", "ACTIVE")
      .maybeSingle<{ id: string; name: string; email: string; role: string; team: string | null; area: string | null }>();
    if (error) throw error;
    if (!data) throw new Error("El ejecutivo seleccionado no existe o está inactivo.");
    return {
      owner: { type: "USER", id: data.id, name: data.name, email: data.email, role: data.role, team: data.team, area: data.area },
      ownerType,
      agentId: data.id,
      queueId: null,
    };
  }
  if (!queueId) throw new Error("Selecciona una cola activa para el caso duplicado.");
  if (agentId && assignment) throw new Error("No se puede asignar usuario y cola al mismo tiempo.");
  const { data, error } = await supabase
    .from("crm_queues")
    .select("id, name, key, area")
    .eq("id", queueId)
    .eq("is_active", true)
    .maybeSingle<{ id: string; name: string; key: string; area: string | null }>();
  if (error) throw error;
  if (!data) throw new Error("La cola seleccionada no existe o está inactiva.");
  return {
    owner: { type: "QUEUE", id: data.id, name: data.name, key: data.key, area: data.area },
    ownerType,
    agentId: null,
    queueId: data.id,
  };
}

async function buildDuplicateCustomValues(
  sourceCaseId: string,
  newCaseId: string,
  inputs: NonNullable<NonNullable<DuplicateCaseInput["fields"]>["customValues"]> | undefined,
) {
  if (!inputs?.length) {
    const { data, error } = await supabase
      .from("case_custom_values")
      .select("field_definition_id, value_text, value_number, value_boolean, value_date, value_datetime, value_json")
      .eq("case_id", sourceCaseId)
      .returns<CustomValueRow[]>();
    if (error) throw error;
    return (data ?? []).map((value) => ({ ...value, case_id: newCaseId, updated_at: new Date().toISOString() }));
  }

  const uniqueInputs = [...new Map(inputs.map((input) => [input.fieldDefinitionId, input])).values()];
  const { data: fields, error } = await supabase
    .from("case_field_definitions")
    .select("id, field_key, label, field_type, description, is_required, is_active, is_standard, picklist_values, default_value")
    .in("id", uniqueInputs.map((input) => input.fieldDefinitionId))
    .eq("is_active", true)
    .returns<CaseFieldDefinition[]>();
  if (error) throw error;
  if ((fields ?? []).length !== uniqueInputs.length) throw new Error("Uno o más campos dinámicos no son válidos.");

  const fieldsById = new Map((fields ?? []).map((field) => [field.id, field]));
  return uniqueInputs.map((input) => {
    const field = fieldsById.get(input.fieldDefinitionId)!;
    const rawValue = input.value === true ? "on" : input.value === false ? null : input.value;
    const validationError = validateCustomFieldValue({ field, rawValue });
    if (validationError) throw new Error(validationError);
    return buildCustomValuePayload({ caseId: newCaseId, field, rawValue });
  });
}

export async function duplicateCase(sourceCaseId: string, input: DuplicateCaseInput): Promise<DuplicateCaseResult> {
  const { actor } = await authorizeCaseAction("manage_cases");
  const { data: source, error } = await supabase
    .from("cases")
    .select("id, case_number, customer_id, subject, channel, contact_type, priority, area, category, product, subproduct, contact_name, contact_email, contact_phone, owner_type, assigned_agent_id, assigned_queue_id, assigned_to")
    .eq("id", sourceCaseId)
    .maybeSingle<DuplicateSourceCase>();
  if (error) throw error;
  if (!source) throw new Error("Caso original no encontrado.");

  const assignment = await resolveAssignment(input.assignment, source);
  const now = new Date().toISOString();
  const caseNumber = await generateNextCaseNumber();
  const fields = input.fields ?? {};
  const { data: created, error: insertError } = await supabase
    .from("cases")
    .insert({
      case_number: caseNumber,
      customer_id: source.customer_id,
      contact_name: source.contact_name,
      contact_email: source.contact_email,
      contact_phone: source.contact_phone,
      subject: editableText(fields.description, source.subject, 1000),
      channel: editableText(fields.channel, source.channel, 80),
      contact_type: editableText(
        fields.contactType ?? fields.contact_type,
        source.contact_type,
        80,
      ),
      priority: editableText(fields.priority, source.priority, 40),
      area: editableText(fields.area, source.area, 120),
      category: editableText(fields.category, source.category, 120),
      product: editableText(fields.product, source.product, 120),
      subproduct: source.subproduct,
      owner_type: assignment.ownerType,
      assigned_agent_id: assignment.agentId,
      assigned_queue_id: assignment.queueId,
      assigned_to: assignment.owner?.name ?? null,
      assigned_at: assignment.owner ? now : null,
      status: assignment.owner ? "ASSIGNED" : "HUMAN_REQUIRED",
      lifecycle_status: "NEW",
      routing_status: assignment.owner ? "ASSIGNED" : "UNASSIGNED",
      duplicated_from_case_id: source.id,
      closed_at: null,
      resolution_type: null,
      created_at: now,
      updated_at: now,
    })
    .select("id, case_number")
    .single<{ id: string; case_number: string }>();
  if (insertError || !created) throw insertError ?? new Error("No se pudo crear el caso duplicado.");

  const customValues = await buildDuplicateCustomValues(source.id, created.id, fields.customValues);
  if (customValues.length) {
    const { error: customError } = await supabase.from("case_custom_values").insert(customValues);
    if (customError) console.error("[case-duplicate] Case created but custom values failed", customError);
  }

  try {
    await createCaseAuditEvents(supabase, [
      {
        caseId: source.id,
        actor,
        eventType: "CASE_DUPLICATED",
        source: "case_detail_header",
        metadata: { newCaseId: created.id, newCaseNumber: created.case_number },
      },
      {
        caseId: created.id,
        actor,
        eventType: "CASE_CREATED_FROM_DUPLICATE",
        source: "case_detail_header",
        metadata: { sourceCaseId: source.id, sourceCaseNumber: source.case_number },
      },
    ]);
  } catch (auditError) {
    console.error("[case-duplicate] Case created but audit creation failed", auditError);
  }

  return { caseId: created.id, caseNumber: created.case_number, url: `/casos/${created.id}` };
}
