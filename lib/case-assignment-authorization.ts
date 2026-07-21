import {
  hasPermission,
  type CrmRolePermissionRecord,
} from "@/lib/permissions";

export const CASE_ASSIGNMENT_DENIED_MESSAGE =
  "No tienes permiso para reasignar este caso porque pertenece a otro agente.";

const privilegedAssignmentRoles = new Set([
  "ADMIN",
  "SUPERVISOR",
  "LEAD",
  "LEADER",
  "LIDER",
  "LÍDER",
  "TEAMLEAD",
  "TEAM_LEAD",
  "MANAGER",
]);

export type CaseAssignmentAuthorizationInput = {
  ownerType?: string | null;
  assignedAgentId?: string | null;
  assignedQueueId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  configuredPermissions?: CrmRolePermissionRecord[] | null;
};

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

export function canReassignCasesOwnedByOthers({
  actorRole,
  configuredPermissions,
}: Pick<
  CaseAssignmentAuthorizationInput,
  "actorRole" | "configuredPermissions"
>) {
  const normalizedRole = actorRole?.trim().toUpperCase() ?? "";

  return (
    privilegedAssignmentRoles.has(normalizedRole) ||
    hasPermission(actorRole, "reassignCases", configuredPermissions)
  );
}

export function getCaseAssignmentAuthorization({
  ownerType,
  assignedAgentId,
  assignedQueueId,
  actorUserId,
  actorRole,
  configuredPermissions,
}: CaseAssignmentAuthorizationInput) {
  const hasEffectiveAgent = Boolean(assignedAgentId?.trim());
  const belongsToQueue =
    !hasEffectiveAgent &&
    (ownerType?.trim().toUpperCase() === "QUEUE" || Boolean(assignedQueueId?.trim()));
  const isUnassigned = !hasEffectiveAgent && !assignedQueueId?.trim();
  const isCurrentOwner =
    hasEffectiveAgent &&
    Boolean(actorUserId) &&
    normalized(assignedAgentId) === normalized(actorUserId);
  const canReassignOthers = canReassignCasesOwnedByOthers({
    actorRole,
    configuredPermissions,
  });
  const allowed = belongsToQueue || isUnassigned || isCurrentOwner || canReassignOthers;

  return {
    allowed,
    reason: allowed ? null : CASE_ASSIGNMENT_DENIED_MESSAGE,
    basis: belongsToQueue
      ? "QUEUE"
      : isUnassigned
        ? "UNASSIGNED"
        : isCurrentOwner
          ? "CURRENT_OWNER"
          : canReassignOthers
            ? "PRIVILEGED"
            : "OTHER_AGENT",
  } as const;
}
