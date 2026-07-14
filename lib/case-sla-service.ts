import {
  getCaseResponseActivity,
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
  const breached =
    first_response_sla_breached || between_responses_sla_breached;

  return {
    ...activity,
    first_response_sla_breached,
    between_responses_sla_breached,
    response_status: breached ? "RED" : activity.response_status,
    response_label: breached ? "En riesgo" : activity.response_label,
  };
}
