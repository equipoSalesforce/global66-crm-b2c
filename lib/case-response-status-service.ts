export type CaseResponseStatus = "GREEN" | "YELLOW" | "RED";

export type CaseResponseLabel =
  | "Al día"
  | "Sin actividad cliente"
  | "Sin actividad agente"
  | "Esperando respuesta"
  | "En riesgo";

export type CaseResponseMessage = {
  case_id: string | number | null;
  direction: string | null;
  sender_type: string | null;
  channel?: string | null;
  message_type?: string | null;
  created_at: string | null;
};

export type CaseResponseActivity = {
  first_customer_message_at: string | null;
  last_customer_message_at: string | null;
  first_agent_message_at: string | null;
  last_agent_message_at: string | null;
  response_status: Exclude<CaseResponseStatus, "RED">;
  response_label: Exclude<CaseResponseLabel, "En riesgo">;
  is_waiting_for_agent: boolean;
  has_agent_interaction: boolean;
};

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

export function getCaseResponseActivity(
  messages: CaseResponseMessage[],
): CaseResponseActivity {
  const customerMessages = messages
    .filter(isCustomerInboundMessage)
    .map((message) => parseTime(message.created_at))
    .filter((time): time is number => time !== null)
    .sort((timeA, timeB) => timeA - timeB);
  const agentMessages = messages
    .filter(isAgentOutboundMessage)
    .map((message) => parseTime(message.created_at))
    .filter((time): time is number => time !== null)
    .sort((timeA, timeB) => timeA - timeB);

  const firstCustomerMessageAt = customerMessages[0] ?? null;
  const lastCustomerMessageAt = customerMessages.at(-1) ?? null;
  const firstAgentMessageAt = agentMessages[0] ?? null;
  const lastAgentMessageAt = agentMessages.at(-1) ?? null;
  const hasAgentAfterCustomer =
    lastCustomerMessageAt !== null &&
    agentMessages.some((messageTime) => messageTime > lastCustomerMessageAt);
  const isWaitingForAgent =
    lastCustomerMessageAt !== null &&
    (lastAgentMessageAt === null || lastCustomerMessageAt > lastAgentMessageAt);

  if (!firstCustomerMessageAt) {
    return {
      first_customer_message_at: null,
      last_customer_message_at: null,
      first_agent_message_at: toIso(firstAgentMessageAt),
      last_agent_message_at: toIso(lastAgentMessageAt),
      response_status: "GREEN",
      response_label: "Sin actividad cliente",
      is_waiting_for_agent: false,
      has_agent_interaction: firstAgentMessageAt !== null,
    };
  }

  if (!firstAgentMessageAt || !hasAgentAfterCustomer) {
    return {
      first_customer_message_at: toIso(firstCustomerMessageAt),
      last_customer_message_at: toIso(lastCustomerMessageAt),
      first_agent_message_at: toIso(firstAgentMessageAt),
      last_agent_message_at: toIso(lastAgentMessageAt),
      response_status: "YELLOW",
      response_label: firstAgentMessageAt ? "Esperando respuesta" : "Sin actividad agente",
      is_waiting_for_agent: true,
      has_agent_interaction: firstAgentMessageAt !== null,
    };
  }

  return {
    first_customer_message_at: toIso(firstCustomerMessageAt),
    last_customer_message_at: toIso(lastCustomerMessageAt),
    first_agent_message_at: toIso(firstAgentMessageAt),
    last_agent_message_at: toIso(lastAgentMessageAt),
    response_status: isWaitingForAgent ? "YELLOW" : "GREEN",
    response_label: isWaitingForAgent ? "Esperando respuesta" : "Al día",
    is_waiting_for_agent: isWaitingForAgent,
    has_agent_interaction: true,
  };
}
