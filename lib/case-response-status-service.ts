export const caseResponseStatuses = [
  "NO_AGENT_ACTIVITY",
  "NO_CUSTOMER_ACTIVITY_24H",
  "WAITING_AGENT_RESPONSE",
  "UP_TO_DATE",
] as const;

export type CaseResponseStatus = (typeof caseResponseStatuses)[number];

export type CaseResponseLabel =
  | "Sin actividad agente"
  | "Sin actividad cliente"
  | "Esperando respuesta"
  | "Al día";

export type CaseResponseMessage = {
  case_id: string | number | null;
  direction: string | null;
  sender_type: string | null;
  channel?: string | null;
  message_type?: string | null;
  created_at: string | null;
};

// Future server-side activity adapters can normalize their events to this
// contract without coupling the list UI to a persistence provider.
export type CaseResponseActivityEvent = CaseResponseMessage;

export type CaseResponseActivity = {
  first_customer_message_at: string | null;
  last_customer_message_at: string | null;
  first_agent_message_at: string | null;
  last_agent_message_at: string | null;
  response_status: CaseResponseStatus;
  response_label: CaseResponseLabel;
  is_waiting_for_agent: boolean;
  has_agent_interaction: boolean;
};

const HOUR = 60 * 60 * 1000;

function parseTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function toIso(value: number | null) {
  return value === null ? null : new Date(value).toISOString();
}

function isPublicMessage(message: CaseResponseMessage) {
  const messageType = message.message_type?.trim().toUpperCase();
  return messageType !== "NOTE" && messageType !== "INTERNAL";
}

export function isAgentOutboundMessage(message: CaseResponseMessage) {
  return (
    message.direction?.trim().toUpperCase() === "OUTBOUND" &&
    message.sender_type?.trim().toUpperCase() === "AGENT" &&
    isPublicMessage(message)
  );
}

export function isCustomerInboundMessage(message: CaseResponseMessage) {
  return (
    message.direction?.trim().toUpperCase() === "INBOUND" &&
    message.sender_type?.trim().toUpperCase() === "CUSTOMER" &&
    isPublicMessage(message)
  );
}

export function getCaseResponseLabel(status: CaseResponseStatus): CaseResponseLabel {
  if (status === "NO_AGENT_ACTIVITY") return "Sin actividad agente";
  if (status === "NO_CUSTOMER_ACTIVITY_24H") return "Sin actividad cliente";
  if (status === "WAITING_AGENT_RESPONSE") return "Esperando respuesta";
  return "Al día";
}

export function isCaseResponseStatus(value: unknown): value is CaseResponseStatus {
  return caseResponseStatuses.includes(value as CaseResponseStatus);
}

export function getCaseResponseActivity(
  messages: CaseResponseMessage[],
  nowDate = new Date(),
  additionalActivities: CaseResponseActivityEvent[] = [],
): CaseResponseActivity {
  const activities = [...messages, ...additionalActivities];
  const customerMessages = activities
    .filter(isCustomerInboundMessage)
    .map((message) => parseTime(message.created_at))
    .filter((time): time is number => time !== null)
    .sort((a, b) => a - b);
  const agentMessages = activities
    .filter(isAgentOutboundMessage)
    .map((message) => parseTime(message.created_at))
    .filter((time): time is number => time !== null)
    .sort((a, b) => a - b);

  const firstCustomer = customerMessages[0] ?? null;
  const lastCustomer = customerMessages.at(-1) ?? null;
  const firstAgent = agentMessages[0] ?? null;
  const lastAgent = agentMessages.at(-1) ?? null;
  let responseStatus: CaseResponseStatus;

  if (lastAgent === null) {
    responseStatus = "NO_AGENT_ACTIVITY";
  } else if (lastCustomer !== null && lastCustomer > lastAgent) {
    responseStatus = "WAITING_AGENT_RESPONSE";
  } else if (nowDate.getTime() - lastAgent > 24 * HOUR) {
    responseStatus = "NO_CUSTOMER_ACTIVITY_24H";
  } else {
    responseStatus = "UP_TO_DATE";
  }

  return {
    first_customer_message_at: toIso(firstCustomer),
    last_customer_message_at: toIso(lastCustomer),
    first_agent_message_at: toIso(firstAgent),
    last_agent_message_at: toIso(lastAgent),
    response_status: responseStatus,
    response_label: getCaseResponseLabel(responseStatus),
    is_waiting_for_agent: responseStatus === "WAITING_AGENT_RESPONSE",
    has_agent_interaction: firstAgent !== null,
  };
}
