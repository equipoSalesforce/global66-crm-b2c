import type { SupabaseClient } from "@supabase/supabase-js";

export type CaseAuditActor = {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export type CaseAuditEvent = {
  id: string;
  case_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  event_type: string;
  field_key: string | null;
  field_label: string | null;
  old_value: string | null;
  new_value: string | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

export type CaseAuditEventInput = {
  caseId: string;
  actor?: CaseAuditActor;
  eventType: string;
  fieldKey?: string | null;
  fieldLabel?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CaseFieldAuditInput = {
  caseId: string;
  actor?: CaseAuditActor;
  fieldKey: string;
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
  eventType?: string;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function normalizeAuditComparableValue(value: unknown) {
  return formatAuditValue(value) ?? "";
}

export function getCaseFieldAuditEventType(fieldKey: string) {
  if (fieldKey === "priority") return "case_priority_updated";
  if (
    fieldKey === "status" ||
    fieldKey === "lifecycle_status" ||
    fieldKey === "routing_status"
  ) {
    return "case_status_updated";
  }
  if (fieldKey === "assigned_agent_id" || fieldKey === "assigned_to") {
    return "case_assignment_updated";
  }
  if (fieldKey === "closed_at") return "case_closed";

  return "case_field_updated";
}

export function buildCaseFieldAuditEvents(fields: CaseFieldAuditInput[]) {
  return fields
    .filter(
      (field) =>
        normalizeAuditComparableValue(field.oldValue) !==
        normalizeAuditComparableValue(field.newValue),
    )
    .map((field) => ({
      caseId: field.caseId,
      actor: field.actor,
      eventType: field.eventType ?? getCaseFieldAuditEventType(field.fieldKey),
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel,
      oldValue: field.oldValue,
      newValue: field.newValue,
      source: field.source,
      metadata: field.metadata,
    }));
}

function toAuditRow(input: CaseAuditEventInput) {
  return {
    case_id: input.caseId,
    actor_user_id: input.actor?.userId || null,
    actor_name: input.actor?.name || null,
    actor_email: input.actor?.email || null,
    actor_role: input.actor?.role || null,
    event_type: input.eventType,
    field_key: input.fieldKey || null,
    field_label: input.fieldLabel || null,
    old_value: formatAuditValue(input.oldValue),
    new_value: formatAuditValue(input.newValue),
    source: input.source || null,
    metadata: input.metadata ?? null,
  };
}

export async function createCaseAuditEvent(
  supabase: SupabaseClient,
  input: CaseAuditEventInput,
) {
  const { error } = await supabase.from("case_audit_events").insert(toAuditRow(input));

  if (error) {
    throw error;
  }
}

export async function createCaseAuditEvents(
  supabase: SupabaseClient,
  inputs: CaseAuditEventInput[],
) {
  if (inputs.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("case_audit_events")
    .insert(inputs.map(toAuditRow));

  if (error) {
    throw error;
  }
}
