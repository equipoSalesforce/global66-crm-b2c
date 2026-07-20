import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCaseFieldAuditEvents,
  createCaseAuditEvents,
  type CaseAuditActor,
  type CaseAuditEventInput,
} from "./case-audit";
import {
  caseFieldDefinitions,
  normalizeCaseStatusForStorage,
  type CaseEditableFieldKey,
} from "./case-field-definitions";
import type { AssignableUser } from "./users-service";

export type PersistedCaseOperationChanges = Partial<
  Record<CaseEditableFieldKey, string | boolean | null>
>;

type CaseOperationRecord = {
  id: string;
  case_number: string | null;
  channel: string | null;
  contact_type: string | null;
  lifecycle_status: string | null;
  status: string | null;
  priority: string | null;
  area: string | null;
  category: string | null;
  ai_category?: string | null;
  resolution_type: string | null;
  assigned_agent_id: string | null;
  assigned_to: string | null;
  product?: string | null;
  subproduct?: string | null;
  is_edge_case?: boolean | null;
  is_merged?: boolean | null;
  merged_into_case_id?: string | null;
  response_status?: string | null;
};

const selectColumns =
  "id, case_number, channel, contact_type, lifecycle_status, status, priority, area, category, ai_category, resolution_type, assigned_agent_id, assigned_to, product, subproduct, is_edge_case, is_merged, merged_into_case_id, response_status";

function valueForField(caseItem: CaseOperationRecord, key: CaseEditableFieldKey) {
  if (key === "responseStatus") return caseItem.response_status ?? null;
  if (key === "channel") return caseItem.channel;
  if (key === "contactType") return caseItem.contact_type;
  if (key === "product") return caseItem.product ?? null;
  if (key === "subproduct") return caseItem.subproduct ?? null;
  if (key === "catPrincipal") return caseItem.area;
  if (key === "catSecondary") return caseItem.category;
  if (key === "catExtra") return caseItem.ai_category ?? null;
  if (key === "status") return caseItem.lifecycle_status ?? caseItem.status;
  if (key === "containmentContext") return caseItem.resolution_type;
  if (key === "ownerId") return caseItem.assigned_agent_id;
  if (key === "priority") return caseItem.priority;
  if (key === "isEdgeCase") return Boolean(caseItem.is_edge_case);

  return null;
}

function normalizeChangeValue(key: CaseEditableFieldKey, value: unknown) {
  const definition = caseFieldDefinitions[key];

  if (definition.type === "boolean") {
    return Boolean(value);
  }

  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value).trim();

  if (!stringValue) return null;

  if (key === "status") {
    return normalizeCaseStatusForStorage(stringValue);
  }

  return stringValue;
}

function validatePicklistValue(key: CaseEditableFieldKey, value: unknown) {
  const definition = caseFieldDefinitions[key];

  if (definition.type !== "picklist" || value === null || value === undefined) {
    return;
  }

  const valueAsString = String(value);

  if (definition.options?.includes(valueAsString)) {
    return;
  }

  if (
    key === "status" &&
    definition.options?.includes(valueAsString.replaceAll("_", " "))
  ) {
    return;
  }

  throw new Error(`${definition.label} no tiene una opción válida.`);
}

export function buildCaseUpdatePayload(changes: PersistedCaseOperationChanges) {
  const payload: Record<string, string | boolean | null> = {};

  Object.entries(changes).forEach(([rawKey, rawValue]) => {
    const key = rawKey as CaseEditableFieldKey;
    const definition = caseFieldDefinitions[key];

    if (!definition?.editable) {
      throw new Error(`El campo ${rawKey} no es editable.`);
    }

    const value = normalizeChangeValue(key, rawValue);
    validatePicklistValue(key, value);

    if (key === "status") {
      payload.lifecycle_status = value as string | null;
      payload.status = value === "MERGED" ? "CLOSED" : (value as string | null);
      return;
    }

    if (key === "ownerId") {
      payload.assigned_agent_id = value as string | null;
      return;
    }

    payload[definition.persistFieldName] = value;
  });

  payload.updated_at = new Date().toISOString();

  return payload;
}

async function attachOwnerNameIfNeeded(
  supabase: SupabaseClient,
  payload: Record<string, string | boolean | null>,
) {
  if (!payload.assigned_agent_id || typeof payload.assigned_agent_id !== "string") {
    if (payload.assigned_agent_id === null) {
      payload.assigned_to = null;
    }

    return payload;
  }

  const { data, error } = await supabase
    .from("crm_users")
    .select("name, email")
    .eq("id", payload.assigned_agent_id)
    .maybeSingle<{ name: string | null; email: string | null }>();

  if (error) {
    throw error;
  }

  payload.assigned_to = data?.name ?? data?.email ?? payload.assigned_agent_id;

  return payload;
}

export async function getCasesForOperations(
  supabase: SupabaseClient,
  caseIds: string[],
) {
  if (caseIds.length === 0) return [];

  const { data, error } = await supabase
    .from("cases")
    .select(selectColumns)
    .in("id", caseIds)
    .returns<CaseOperationRecord[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function updateCasesBulkInSupabase({
  supabase,
  updates,
  actorUser,
}: {
  supabase: SupabaseClient;
  updates: Array<{ caseId: string; changes: PersistedCaseOperationChanges }>;
  actorUser?: CaseAuditActor;
}) {
  const caseIds = updates.map((update) => update.caseId);
  const existingCases = await getCasesForOperations(supabase, caseIds);
  const existingById = new Map(existingCases.map((caseItem) => [caseItem.id, caseItem]));
  const auditEvents: CaseAuditEventInput[] = [];

  for (const update of updates) {
    const existingCase = existingById.get(update.caseId);

    if (!existingCase) {
      throw new Error(`Caso ${update.caseId} no encontrado.`);
    }

    if (existingCase.is_merged) {
      throw new Error(`El caso ${existingCase.case_number ?? update.caseId} ya está fusionado.`);
    }

    const payload = await attachOwnerNameIfNeeded(
      supabase,
      buildCaseUpdatePayload(update.changes),
    );

    const { error } = await supabase
      .from("cases")
      .update(payload)
      .eq("id", update.caseId);

    if (error) {
      throw error;
    }

    const changedFields = Object.keys(update.changes) as CaseEditableFieldKey[];
    auditEvents.push(
      ...buildCaseFieldAuditEvents(
        changedFields.map((fieldKey) => {
          const definition = caseFieldDefinitions[fieldKey];

          return {
            caseId: update.caseId,
            actor: actorUser,
            fieldKey: definition.persistFieldName,
            fieldLabel: definition.label,
            oldValue: valueForField(existingCase, fieldKey),
            newValue: normalizeChangeValue(fieldKey, update.changes[fieldKey]),
            eventType: "CASE_BULK_UPDATE",
            source: "cases-list-view",
            metadata: {
              title: "Caso actualizado desde Vista de Casos",
              caseNumber: existingCase.case_number,
            },
          };
        }),
      ),
    );
  }

  await createCaseAuditEvents(supabase, auditEvents);

  return { updated: updates.length, caseIds };
}

export async function changeCasesOwnerInSupabase({
  supabase,
  caseIds,
  owner,
  actorUser,
  notifyOwner = false,
}: {
  supabase: SupabaseClient;
  caseIds: string[];
  owner: AssignableUser;
  actorUser?: CaseAuditActor;
  notifyOwner?: boolean;
}) {
  const uniqueCaseIds = Array.from(new Set(caseIds));
  const existingCases = await getCasesForOperations(supabase, uniqueCaseIds);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("cases")
    .update({
      owner_type: "USER",
      assigned_agent_id: owner.id,
      assigned_queue_id: null,
      assigned_to: owner.name,
      assigned_at: now,
      updated_at: now,
    })
    .in("id", uniqueCaseIds);

  if (error) {
    throw error;
  }

  let notificationStatus: "not_requested" | "sent" | "failed" =
    "not_requested";
  let notificationsCreated = 0;

  if (notifyOwner && existingCases.length > 0) {
    const { error: notificationError } = await supabase
      .from("case_assignment_notifications")
      .insert(
        existingCases.map((caseItem) => ({
          case_id: caseItem.id,
          case_number: caseItem.case_number,
          previous_owner_user_id: caseItem.assigned_agent_id,
          previous_owner_name: caseItem.assigned_to,
          assigned_to_user_id: owner.id,
          assigned_to_name: owner.name,
          assigned_by_user_id: actorUser?.userId ?? null,
          assigned_by_name: actorUser?.name ?? "Usuario demo",
          title: "Nuevo caso asignado",
          message: `Se te asignó el caso #${caseItem.case_number ?? caseItem.id}.`,
        })),
      );

    if (notificationError) {
      notificationStatus = "failed";
      console.error(
        "[case-owner] Owner changed but notification creation failed",
        notificationError,
      );
    } else {
      notificationStatus = "sent";
      notificationsCreated = existingCases.length;
    }
  }

  await createCaseAuditEvents(
    supabase,
    existingCases.map((caseItem) => ({
      caseId: caseItem.id,
      actor: actorUser,
      eventType: "OWNER_CHANGED",
      fieldKey: "assigned_agent_id",
      fieldLabel: "Owner",
      oldValue: caseItem.assigned_to ?? caseItem.assigned_agent_id,
      newValue: owner.name,
      source: "cases-list-view",
      metadata: {
        title: "Owner cambiado desde Vista de Casos",
        description: `Owner cambiado de ${caseItem.assigned_to ?? "Sin owner"} a ${owner.name}`,
        ownerId: owner.id,
        notificationRequested: notifyOwner,
        notificationCreated: notificationStatus === "sent",
      },
    })),
  );

  return {
    updated: existingCases.length,
    owner,
    caseIds: uniqueCaseIds,
    notificationStatus,
    notificationsCreated,
  };
}

export async function mergeCasesInSupabase({
  supabase,
  masterCaseId,
  mergedCaseIds,
  fieldResolution,
  actorUser,
}: {
  supabase: SupabaseClient;
  masterCaseId: string;
  mergedCaseIds: string[];
  fieldResolution: PersistedCaseOperationChanges;
  actorUser?: CaseAuditActor;
}) {
  const selectedCaseIds = Array.from(new Set(mergedCaseIds));

  if (selectedCaseIds.length < 2) {
    throw new Error("Selecciona al menos 2 casos para fusionar.");
  }

  if (!selectedCaseIds.includes(masterCaseId)) {
    throw new Error("El caso principal debe estar dentro de los casos seleccionados.");
  }

  const secondaryIds = selectedCaseIds.filter((caseId) => caseId !== masterCaseId);
  const selectedCases = await getCasesForOperations(supabase, selectedCaseIds);
  const selectedById = new Map(selectedCases.map((caseItem) => [caseItem.id, caseItem]));
  const masterCase = selectedById.get(masterCaseId);

  if (!masterCase) {
    throw new Error("Caso principal no encontrado.");
  }

  if (selectedCases.some((caseItem) => caseItem.is_merged)) {
    throw new Error("No se pueden fusionar casos ya fusionados.");
  }

  const now = new Date().toISOString();
  const masterPayload = await attachOwnerNameIfNeeded(
    supabase,
    buildCaseUpdatePayload(fieldResolution),
  );

  const masterUpdate = await supabase
    .from("cases")
    .update(masterPayload)
    .eq("id", masterCaseId);

  if (masterUpdate.error) {
    throw masterUpdate.error;
  }

  const childUpdate = await supabase
    .from("cases")
    .update({
      lifecycle_status: "MERGED",
      status: "CLOSED",
      is_merged: true,
      merged_into_case_id: masterCaseId,
      merged_at: now,
      merged_by: actorUser?.userId ?? actorUser?.name ?? null,
      updated_at: now,
    })
    .in("id", secondaryIds);

  if (childUpdate.error) {
    throw childUpdate.error;
  }

  const secondaryNumbers = selectedCases
    .filter((caseItem) => secondaryIds.includes(caseItem.id))
    .map((caseItem) => caseItem.case_number ?? caseItem.id);

  await createCaseAuditEvents(supabase, [
    {
      caseId: masterCaseId,
      actor: actorUser,
      eventType: "CASE_MERGED_MASTER",
      source: "cases-list-view",
      metadata: {
        title: "Casos fusionados",
        description: `Se fusionaron los casos ${secondaryNumbers.join(", ")} en este caso principal.`,
        mergedCaseIds: secondaryIds,
      },
    },
    ...secondaryIds.map((caseId) => ({
      caseId,
      actor: actorUser,
      eventType: "CASE_MERGED_CHILD",
      source: "cases-list-view",
      metadata: {
        title: "Caso fusionado",
        description: `Este caso fue fusionado en el caso ${masterCase.case_number ?? masterCaseId}.`,
        masterCaseId,
      },
    })),
  ]);

  return { masterCaseId, mergedCaseIds: secondaryIds };
}
