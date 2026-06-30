export const lifecycleStatuses = [
  "NEW",
  "IN_PROGRESS",
  "STAND_BY",
  "RESOLVED",
  "CLOSED",
] as const;

export const routingStatuses = [
  "AI_HANDLING",
  "HUMAN_REQUIRED",
  "ASSIGNED",
  "UNASSIGNED",
] as const;

export type LifecycleStatus = (typeof lifecycleStatuses)[number];
export type RoutingStatus = (typeof routingStatuses)[number];

export function normalizeLifecycleStatus(
  lifecycleStatus: string | null | undefined,
  status: string | null | undefined,
): LifecycleStatus {
  if (lifecycleStatuses.includes(lifecycleStatus as LifecycleStatus)) {
    return lifecycleStatus as LifecycleStatus;
  }

  return status === "CLOSED" ? "CLOSED" : "NEW";
}

export function normalizeRoutingStatus({
  routingStatus,
  status,
  assignedAgentId,
}: {
  routingStatus: string | null | undefined;
  status: string | null | undefined;
  assignedAgentId?: string | null;
}): RoutingStatus {
  if (routingStatuses.includes(routingStatus as RoutingStatus)) {
    return routingStatus as RoutingStatus;
  }

  if (status === "AI_HANDLING") return "AI_HANDLING";
  if (status === "HUMAN_REQUIRED") return "HUMAN_REQUIRED";
  if (status === "ASSIGNED") return "ASSIGNED";
  if (assignedAgentId) return "ASSIGNED";

  return "UNASSIGNED";
}

export function getLegacyStatusFromRoutingStatus(routingStatus: RoutingStatus) {
  return routingStatus === "UNASSIGNED" ? "HUMAN_REQUIRED" : routingStatus;
}

export function formatCaseNumber(
  caseNumber: string | number | null | undefined,
  caseId?: string | number | null,
) {
  if (!caseNumber) {
    const fallbackId = caseId ? String(caseId).slice(-6).toUpperCase() : "000000";

    return `Caso #TEMP-${fallbackId}`;
  }

  return `Caso #${String(caseNumber).padStart(6, "0")}`;
}
