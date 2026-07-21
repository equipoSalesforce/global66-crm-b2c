import "server-only";

import { authorizeCaseAction } from "@/lib/case-action-authorization";
import { getCaseAssignmentAuthorization } from "@/lib/case-assignment-authorization";
import { createCaseAuditEvent } from "@/lib/case-audit";
import { getCurrentCrmUser } from "@/lib/current-crm-user";
import type { CrmRolePermissionRecord } from "@/lib/permissions";
import type {
  CaseAssignmentOptionsResponse,
  CaseAssignmentResult,
  CaseOwnerQueueOption,
  CaseOwnerType,
  CaseOwnerUserOption,
  ResolvedCaseOwner,
} from "@/lib/case-ownership-types";
import { supabase } from "@/lib/supabase";

type AssignmentCaseRow = {
  id: string;
  case_number: string | null;
  owner_type: string | null;
  assigned_agent_id: string | null;
  assigned_queue_id: string | null;
  assigned_to: string | null;
};

type QueueRow = Omit<CaseOwnerQueueOption, "memberCount"> & { is_active: boolean };
type QueueMemberRow = { queue_id: string };

async function getCase(caseId: string) {
  const { data, error } = await supabase
    .from("cases")
    .select("id, case_number, owner_type, assigned_agent_id, assigned_queue_id, assigned_to")
    .eq("id", caseId)
    .maybeSingle<AssignmentCaseRow>();
  if (error) throw error;
  if (!data) throw new Error("Caso no encontrado.");
  return data;
}

async function loadUsers() {
  const { data, error } = await supabase
    .from("crm_users")
    .select("id, name, email, role, team, area")
    .eq("status", "ACTIVE")
    .order("name")
    .returns<CaseOwnerUserOption[]>();
  if (error) throw error;
  return data ?? [];
}

async function loadQueues() {
  const [queuesResult, membersResult] = await Promise.all([
    supabase
      .from("crm_queues")
      .select("id, name, key, description, area, is_active")
      .eq("is_active", true)
      .order("name")
      .returns<QueueRow[]>(),
    supabase
      .from("crm_queue_members")
      .select("queue_id")
      .eq("is_active", true)
      .returns<QueueMemberRow[]>(),
  ]);
  if (queuesResult.error) throw queuesResult.error;
  if (membersResult.error) throw membersResult.error;
  const counts = new Map<string, number>();
  (membersResult.data ?? []).forEach((member) => {
    counts.set(member.queue_id, (counts.get(member.queue_id) ?? 0) + 1);
  });
  return (queuesResult.data ?? []).map((queue) => ({
    id: queue.id,
    name: queue.name,
    key: queue.key,
    description: queue.description,
    area: queue.area,
    memberCount: counts.get(queue.id) ?? 0,
  }));
}

function resolveOwner(
  caseItem: AssignmentCaseRow,
  users: CaseOwnerUserOption[],
  queues: CaseOwnerQueueOption[],
): ResolvedCaseOwner {
  const ownerType: CaseOwnerType =
    caseItem.owner_type === "QUEUE" || caseItem.assigned_queue_id ? "QUEUE" : "USER";
  if (ownerType === "QUEUE") {
    const queue = queues.find((item) => item.id === caseItem.assigned_queue_id);
    return {
      type: "QUEUE",
      id: caseItem.assigned_queue_id,
      name: queue?.name || caseItem.assigned_to || "Sin owner",
      key: queue?.key ?? null,
      area: queue?.area ?? null,
    };
  }
  const user = users.find((item) => item.id === caseItem.assigned_agent_id);
  return {
    type: "USER",
    id: caseItem.assigned_agent_id,
    name: user?.name || caseItem.assigned_to || "Sin owner",
    email: user?.email ?? null,
    role: user?.role ?? null,
    team: user?.team ?? null,
    area: user?.area ?? null,
  };
}

export async function getCaseAssignmentOptions(caseId: string): Promise<CaseAssignmentOptionsResponse> {
  await authorizeCaseAction("viewCases");
  const [caseItem, users, queues] = await Promise.all([getCase(caseId), loadUsers(), loadQueues()]);
  return { users, queues, currentOwner: resolveOwner(caseItem, users, queues) };
}

export async function assignCaseOwner(input: {
  caseId: string;
  ownerType: CaseOwnerType;
  assignedAgentId?: string | null;
  assignedQueueId?: string | null;
  notify?: boolean;
}): Promise<CaseAssignmentResult> {
  const { actor } = await authorizeCaseAction("viewCases");
  if (!(["USER", "QUEUE"] as const).includes(input.ownerType)) {
    throw new Error("El tipo de owner debe ser USER o QUEUE.");
  }
  if (input.ownerType === "USER" && (!input.assignedAgentId || input.assignedQueueId)) {
    throw new Error("Selecciona un ejecutivo válido y no envíes una cola.");
  }
  if (input.ownerType === "QUEUE" && (!input.assignedQueueId || input.assignedAgentId)) {
    throw new Error("Selecciona una cola válida y no envíes un ejecutivo.");
  }

  const existing = await getCase(input.caseId);
  const [currentUser, permissionsResult] = await Promise.all([
    getCurrentCrmUser(),
    supabase
      .from("crm_role_permissions")
      .select("role, permission_key, enabled")
      .returns<CrmRolePermissionRecord[]>(),
  ]);
  if (permissionsResult.error) throw permissionsResult.error;

  const assignmentAuthorization = getCaseAssignmentAuthorization({
    ownerType: existing.owner_type,
    assignedAgentId: existing.assigned_agent_id,
    assignedQueueId: existing.assigned_queue_id,
    actorUserId: currentUser.id,
    actorRole: currentUser.role,
    configuredPermissions: permissionsResult.data ?? [],
  });
  if (!assignmentAuthorization.allowed) {
    throw new Error(assignmentAuthorization.reason ?? "No tienes permiso para asignar este caso.");
  }

  const now = new Date().toISOString();
  let owner: ResolvedCaseOwner;

  if (input.ownerType === "USER") {
    const { data: user, error } = await supabase
      .from("crm_users")
      .select("id, name, email, role, team, area")
      .eq("id", input.assignedAgentId!)
      .eq("status", "ACTIVE")
      .maybeSingle<CaseOwnerUserOption>();
    if (error) throw error;
    if (!user) throw new Error("El ejecutivo no existe o está inactivo.");
    owner = { type: "USER", id: user.id, name: user.name, email: user.email, role: user.role, team: user.team, area: user.area };
  } else {
    const { data: queue, error } = await supabase
      .from("crm_queues")
      .select("id, name, key, description, area, is_active")
      .eq("id", input.assignedQueueId!)
      .eq("is_active", true)
      .maybeSingle<QueueRow>();
    if (error) throw error;
    if (!queue) throw new Error("La cola no existe o está inactiva.");
    owner = { type: "QUEUE", id: queue.id, name: queue.name, key: queue.key, area: queue.area };
  }

  const update = input.ownerType === "USER"
    ? {
        owner_type: "USER",
        assigned_agent_id: owner.id,
        assigned_queue_id: null,
        assigned_to: owner.name,
        assigned_at: now,
        status: "ASSIGNED",
        routing_status: "ASSIGNED",
        updated_at: now,
      }
    : {
        owner_type: "QUEUE",
        assigned_agent_id: null,
        assigned_queue_id: owner.id,
        assigned_to: owner.name,
        assigned_at: now,
        status: "ASSIGNED",
        routing_status: "ASSIGNED",
        updated_at: now,
      };
  const { error: updateError } = await supabase.from("cases").update(update).eq("id", input.caseId);
  if (updateError) throw updateError;

  let notificationStatus: CaseAssignmentResult["notificationStatus"] = "not_requested";
  if (input.ownerType === "USER" && input.notify) {
    const { error: notificationError } = await supabase.from("case_assignment_notifications").insert({
      case_id: existing.id,
      case_number: existing.case_number,
      previous_owner_user_id: existing.assigned_agent_id,
      previous_owner_name: existing.assigned_to,
      assigned_to_user_id: owner.id,
      assigned_to_name: owner.name,
      assigned_by_user_id: actor.userId ?? null,
      assigned_by_name: actor.name ?? "Usuario CRM",
      title: "Nuevo caso asignado",
      message: `Se te asignó el caso #${existing.case_number ?? existing.id}.`,
    });
    notificationStatus = notificationError ? "failed" : "sent";
    if (notificationError) {
      console.error("[case-assignment] Assignment succeeded but notification failed", notificationError);
    }
  }

  await createCaseAuditEvent(supabase, {
    caseId: existing.id,
    actor,
    eventType: input.ownerType === "QUEUE" ? "QUEUE_ASSIGNED" : "OWNER_CHANGED",
    fieldKey: input.ownerType === "QUEUE" ? "assigned_queue_id" : "assigned_agent_id",
    fieldLabel: "Case Owner",
    oldValue: existing.assigned_to || existing.assigned_agent_id || existing.assigned_queue_id,
    newValue: owner.name,
    source: "case_detail_header",
    metadata: {
      previousOwnerType: existing.owner_type,
      ownerType: input.ownerType,
      ownerId: owner.id,
      notificationRequested: input.ownerType === "USER" && Boolean(input.notify),
      notificationCreated: notificationStatus === "sent",
    },
  });

  return {
    id: existing.id,
    caseNumber: existing.case_number,
    ownerType: input.ownerType,
    assignedAgentId: input.ownerType === "USER" ? owner.id : null,
    assignedQueueId: input.ownerType === "QUEUE" ? owner.id : null,
    assignedTo: owner.name,
    owner,
    notificationStatus,
  };
}
