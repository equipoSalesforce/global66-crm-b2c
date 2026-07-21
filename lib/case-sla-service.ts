import type { CaseAuditEvent } from "@/lib/case-audit";
import type { CaseInfoSlaSummary } from "@/lib/case-info-links-types";
import type { CaseSlaCase, CaseSlaMessage } from "@/lib/case-sla";
import {
  getCaseResponseActivity,
  isAgentOutboundMessage,
  isCustomerInboundMessage,
  type CaseResponseLabel,
  type CaseResponseMessage,
  type CaseResponseStatus,
} from "./case-response-status-service";

export type CaseSlaInput = {
  channel: string | null;
  priority?: string | null;
  segment?: string | null;
  created_at: string | null;
};

export type CaseSlaResult = {
  first_response_sla_breached: boolean;
  between_responses_sla_breached: boolean;
  response_status: CaseResponseStatus;
  response_label: CaseResponseLabel;
  first_customer_message_at: string | null;
  last_customer_message_at: string | null;
  first_agent_message_at: string | null;
  last_agent_message_at: string | null;
  is_waiting_for_agent: boolean;
  has_agent_interaction: boolean;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function parseTime(value: string | null | undefined) {
  if (!value) return null;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
}

function isWhatsapp(channel: string | null | undefined) {
  return channel?.trim().toUpperCase() === "WHATSAPP";
}

function isHighSegment(input: CaseSlaInput) {
  const segment = input.segment?.trim().toUpperCase();
  const priority = input.priority?.trim().toUpperCase();

  return (
    segment === "HIGH" ||
    segment === "ULTRA HIGH" ||
    priority === "HIGH" ||
    priority === "URGENT"
  );
}

function firstResponseLimit(input: CaseSlaInput) {
  if (isWhatsapp(input.channel)) return MINUTE;
  if (isHighSegment(input)) return HOUR;

  return 24 * HOUR;
}

function betweenResponsesLimit(input: CaseSlaInput) {
  return isWhatsapp(input.channel) ? 10 * MINUTE : 8 * HOUR;
}

export function computeCaseSlaStatus(
  input: CaseSlaInput,
  messages: CaseResponseMessage[],
  nowDate = new Date(),
): CaseSlaResult {
  const activity = getCaseResponseActivity(messages);
  const now = nowDate.getTime();
  const createdAt = parseTime(input.created_at) ?? now;
  const firstCustomerAt = parseTime(activity.first_customer_message_at);
  const firstAgentAt = parseTime(activity.first_agent_message_at);
  const lastCustomerAt = parseTime(activity.last_customer_message_at);
  const firstResponseStartedAt = firstCustomerAt ?? createdAt;
  const firstResponseEndedAt = firstAgentAt ?? now;
  const first_response_sla_breached =
    firstResponseEndedAt - firstResponseStartedAt > firstResponseLimit(input);
  const between_responses_sla_breached =
    activity.is_waiting_for_agent &&
    lastCustomerAt !== null &&
    now - lastCustomerAt > betweenResponsesLimit(input);
  return {
    ...activity,
    first_response_sla_breached,
    between_responses_sla_breached,
  };
}

type CaseInfoSlaCase = CaseSlaCase & {
  assigned_agent_id?: string | null;
  assigned_to?: string | null;
};

function secondsBetween(start: number, end: number) {
  return Math.max(0, Math.floor((end - start) / 1000));
}

function assignmentTarget(event: CaseAuditEvent) {
  const metadataOwnerId = event.metadata?.ownerId;
  if (typeof metadataOwnerId === "string" && metadataOwnerId.trim()) {
    return metadataOwnerId.trim().toLocaleLowerCase();
  }

  return event.new_value?.trim().toLocaleLowerCase() || null;
}

function calculateAht(
  caseItem: CaseInfoSlaCase,
  auditEvents: CaseAuditEvent[],
  closedAt: number | null,
) {
  if (!closedAt || (!caseItem.assigned_agent_id && !caseItem.assigned_to)) return null;

  const closingOwnerKeys = new Set(
    [caseItem.assigned_agent_id, caseItem.assigned_to]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => value.trim().toLocaleLowerCase()),
  );
  const assignments = auditEvents
    .filter((event) => {
      const isAssignmentField =
        event.field_key === "assigned_agent_id" || event.event_type === "OWNER_CHANGED";
      return isAssignmentField && assignmentTarget(event) && parseTime(event.created_at);
    })
    .map((event) => ({
      owner: assignmentTarget(event)!,
      at: parseTime(event.created_at)!,
    }))
    .filter((event) => event.at <= closedAt)
    .sort((left, right) => left.at - right.at);

  if (assignments.length === 0) return null;

  let activeOwner: string | null = null;
  let activeSince: number | null = null;
  let finalOwnerSeconds = 0;

  for (const assignment of assignments) {
    if (activeOwner && activeSince !== null && closingOwnerKeys.has(activeOwner)) {
      finalOwnerSeconds += secondsBetween(activeSince, assignment.at);
    }
    activeOwner = assignment.owner;
    activeSince = assignment.at;
  }

  if (activeOwner && activeSince !== null && closingOwnerKeys.has(activeOwner)) {
    finalOwnerSeconds += secondsBetween(activeSince, closedAt);
  }

  return closingOwnerKeys.has(activeOwner ?? "") ? finalOwnerSeconds : null;
}

export function computeCaseInfoSla(
  caseItem: CaseInfoSlaCase,
  messages: CaseSlaMessage[],
  auditEvents: CaseAuditEvent[],
): CaseInfoSlaSummary {
  const createdAt = parseTime(caseItem.created_at);
  const closedAt = parseTime(caseItem.closed_at);
  const chronologicalMessages = messages
    .map((message) => ({ message, at: parseTime(message.created_at) }))
    .filter((item): item is { message: CaseSlaMessage; at: number } => item.at !== null)
    .sort((left, right) => left.at - right.at);
  const firstHumanResponse = chronologicalMessages.find(
    ({ message, at }) =>
      isAgentOutboundMessage(message) && (createdAt === null || at >= createdAt),
  );
  const responseTimes: number[] = [];
  let pendingCustomerAt: number | null = null;

  for (const { message, at } of chronologicalMessages) {
    if (isCustomerInboundMessage(message)) {
      pendingCustomerAt ??= at;
      continue;
    }
    if (
      isAgentOutboundMessage(message) &&
      pendingCustomerAt !== null &&
      at >= pendingCustomerAt
    ) {
      responseTimes.push(secondsBetween(pendingCustomerAt, at));
      pendingCustomerAt = null;
    }
  }

  if (pendingCustomerAt !== null && closedAt !== null && closedAt >= pendingCustomerAt) {
    responseTimes.push(secondsBetween(pendingCustomerAt, closedAt));
  }

  const isResolved = [caseItem.lifecycle_status, caseItem.status].some((value) =>
    ["RESOLVED", "CLOSED"].includes(value?.toUpperCase() ?? ""),
  );

  return {
    ftrSeconds:
      createdAt !== null && firstHumanResponse
        ? secondsBetween(createdAt, firstHumanResponse.at)
        : null,
    artSeconds:
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((total, value) => total + value, 0) /
              responseTimes.length,
          )
        : null,
    ahtSeconds: calculateAht(caseItem, auditEvents, closedAt),
    ttrSeconds:
      createdAt !== null && closedAt !== null && isResolved
        ? secondsBetween(createdAt, closedAt)
        : null,
    responsePairs: responseTimes.length,
  };
}
