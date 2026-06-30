export type CaseNotificationStatus = "RED" | "BLUE" | "GREEN" | "NEUTRAL";

export type CaseSlaCase = {
  id: string;
  case_number?: string | null;
  subject?: string | null;
  channel?: string | null;
  priority?: string | null;
  assigned_to?: string | null;
  assigned_agent_id?: string | null;
  assigned_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  lifecycle_status?: string | null;
  routing_status?: string | null;
  status?: string | null;
};

export type CaseSlaMessage = {
  case_id: string | number | null;
  direction: string | null;
  sender_type: string | null;
  channel?: string | null;
  message_type?: string | null;
  created_at: string | null;
};

export type ComputedCaseSla = {
  notificationStatus: CaseNotificationStatus;
  notificationLabel: string;
  lastCustomerMessageAt: string | null;
  lastAgentMessageAt: string | null;
  firstAgentResponseAt: string | null;
  responseStatusReason: string;
  assignedAt: string | null;
  minutesWaiting: number;
  frtSeconds: number;
  ahtTotalSeconds: number;
  ahtAgentSeconds: number;
  ttcSeconds: number | null;
  ttcRunningSeconds: number | null;
};

export const FRT_TARGET_SECONDS = 15 * 60;
export const FRT_WARNING_SECONDS = 10 * 60;
export const TTC_TARGET_SECONDS = 24 * 60 * 60;

function parseTime(value: string | null | undefined) {
  if (!value) return null;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
}

function toIso(value: number | null) {
  return value ? new Date(value).toISOString() : null;
}

function diffSeconds(start: number | null, end: number | null) {
  if (!start || !end) return 0;

  return Math.max(0, Math.floor((end - start) / 1000));
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "-";

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (safeSeconds < 60) return `${safeSeconds}s`;
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours} h ${minutes % 60} min`;

  return `${days} d ${hours % 24} h`;
}

export function isAgentOutboundMessage(message: CaseSlaMessage) {
  const direction = message.direction?.toUpperCase();
  const senderType = message.sender_type?.toUpperCase();
  const channel = message.channel?.toUpperCase();
  const messageType = message.message_type?.toUpperCase();

  return (
    direction === "OUTBOUND" &&
    senderType === "AGENT" &&
    channel === "WHATSAPP" &&
    messageType !== "NOTE" &&
    messageType !== "INTERNAL"
  );
}

export function isCustomerInboundMessage(message: CaseSlaMessage) {
  const channel = message.channel?.toUpperCase();
  const messageType = message.message_type?.toUpperCase();

  return (
    message.direction?.toUpperCase() === "INBOUND" &&
    message.sender_type?.toUpperCase() === "CUSTOMER" &&
    channel === "WHATSAPP" &&
    messageType !== "NOTE" &&
    messageType !== "INTERNAL"
  );
}

export function computeCaseNotificationStatus(
  caseItem: CaseSlaCase,
  messages: CaseSlaMessage[],
) {
  return computeCaseSla(caseItem, messages).notificationStatus;
}

export function computeCaseSla(
  caseItem: CaseSlaCase,
  messages: CaseSlaMessage[],
  nowDate = new Date(),
): ComputedCaseSla {
  const now = nowDate.getTime();
  const createdAt = parseTime(caseItem.created_at) ?? now;
  const assignedAt =
    parseTime(caseItem.assigned_at) ?? parseTime(caseItem.created_at) ?? createdAt;
  const closedAt = parseTime(caseItem.closed_at);
  const agentMessages = messages
    .filter(isAgentOutboundMessage)
    .map((message) => parseTime(message.created_at))
    .filter((time): time is number => Boolean(time))
    .sort((a, b) => a - b);
  const customerMessages = messages
    .filter(isCustomerInboundMessage)
    .map((message) => parseTime(message.created_at))
    .filter((time): time is number => Boolean(time))
    .sort((a, b) => a - b);
  const lastAgentMessageAt = agentMessages.at(-1) ?? null;
  const firstCustomerMessageAt = customerMessages[0] ?? null;
  const lastCustomerMessageAt = customerMessages.at(-1) ?? null;
  const firstAgentAfterFirstCustomerAt =
    firstCustomerMessageAt === null
      ? null
      : agentMessages.find((messageTime) => messageTime >= firstCustomerMessageAt) ??
        null;
  const firstAgentResponseAt =
    agentMessages.find((messageTime) => messageTime >= assignedAt) ?? null;
  let notificationStatus: CaseNotificationStatus = "NEUTRAL";
  let notificationLabel = "Sin mensajes cliente";
  let responseStatusReason = "No hay mensajes CUSTOMER INBOUND WhatsApp.";

  if (!firstCustomerMessageAt) {
    notificationStatus = "NEUTRAL";
    notificationLabel = "Sin mensajes cliente";
  } else if (!firstAgentAfterFirstCustomerAt) {
    notificationStatus = "RED";
    notificationLabel = "Sin primera respuesta";
    responseStatusReason =
      "Existe CUSTOMER INBOUND WhatsApp, pero no existe AGENT OUTBOUND WhatsApp posterior al primer CUSTOMER.";
  } else if (
    lastCustomerMessageAt &&
    (!lastAgentMessageAt || lastCustomerMessageAt > lastAgentMessageAt)
  ) {
    notificationStatus = "BLUE";
    notificationLabel = "Cliente respondió";
    responseStatusReason =
      "El último CUSTOMER INBOUND WhatsApp es posterior al último AGENT OUTBOUND WhatsApp.";
  } else {
    notificationStatus = "GREEN";
    notificationLabel = "Al día";
    responseStatusReason =
      "El último AGENT OUTBOUND WhatsApp es posterior o igual al último CUSTOMER INBOUND WhatsApp.";
  }

  console.info("[case-response-status]", {
    caseId: caseItem.id,
    caseNumber: caseItem.case_number ?? null,
    firstCustomerAt: toIso(firstCustomerMessageAt),
    lastCustomerAt: toIso(lastCustomerMessageAt),
    lastAgentAt: toIso(lastAgentMessageAt),
    computedStatus: notificationStatus,
    reason: responseStatusReason,
  });

  const waitingSince =
    notificationStatus === "BLUE"
      ? lastCustomerMessageAt
      : notificationStatus === "RED"
        ? firstCustomerMessageAt
        : lastCustomerMessageAt ?? lastAgentMessageAt ?? createdAt;

  return {
    notificationStatus,
    notificationLabel,
    lastCustomerMessageAt: toIso(lastCustomerMessageAt),
    lastAgentMessageAt: toIso(lastAgentMessageAt),
    firstAgentResponseAt: toIso(firstAgentResponseAt),
    responseStatusReason,
    assignedAt: toIso(assignedAt),
    minutesWaiting: Math.floor(diffSeconds(waitingSince, now) / 60),
    frtSeconds: diffSeconds(assignedAt, firstAgentResponseAt ?? now),
    ahtTotalSeconds: diffSeconds(createdAt, closedAt ?? now),
    ahtAgentSeconds: diffSeconds(assignedAt, closedAt ?? now),
    ttcSeconds: closedAt ? diffSeconds(createdAt, closedAt) : null,
    ttcRunningSeconds: closedAt ? null : diffSeconds(createdAt, now),
  };
}

export function getFrtSlaState(frtSeconds: number, hasFirstResponse: boolean) {
  if (!hasFirstResponse && frtSeconds > FRT_TARGET_SECONDS) return "Breached";
  if (frtSeconds > FRT_TARGET_SECONDS) return "Breached";
  if (frtSeconds >= FRT_WARNING_SECONDS) return "Warning";

  return "OK";
}
