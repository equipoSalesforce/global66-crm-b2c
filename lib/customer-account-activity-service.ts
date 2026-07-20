import "server-only";

import type { AccountActivityItem } from "@/lib/account-360-api";
import { supabase } from "@/lib/supabase";

type CustomerCaseRecord = {
  id: string;
  case_number: string | null;
  subject: string | null;
  status: string | null;
  channel: string | null;
  contact_type: string | null;
  assigned_to: string | null;
  created_at: string | null;
  priority: string | null;
};

type CustomerMessageRecord = {
  id: string;
  case_id: string;
  body: string | null;
  sender_type: string | null;
  direction: string | null;
  created_at: string | null;
  channel: string | null;
  message_type: string | null;
  email_subject: string | null;
};

type CustomerCallRecord = {
  id: string;
  case_id: string | null;
  direction: string | null;
  status: string | null;
  result: string | null;
  started_at: string | null;
  created_at: string;
  duration_seconds: number | null;
  aircall_user_name: string | null;
};

export class CustomerAccountActivityError extends Error {}

function caseLabel(caseItem: CustomerCaseRecord) {
  return caseItem.case_number ? `Caso #${caseItem.case_number}` : "Caso";
}

function caseDescription(caseItem: CustomerCaseRecord) {
  return [
    caseItem.subject,
    `Estado: ${caseItem.status || "—"}`,
    `Canal: ${caseItem.channel || "—"}`,
    `Tipo: ${caseItem.contact_type || "—"}`,
    `Owner: ${caseItem.assigned_to || "Sin asignar"}`,
    `Prioridad: ${caseItem.priority || "—"}`,
  ].filter(Boolean).join(" · ");
}

export async function getCustomerCrmActivity(
  customerDbId: string,
): Promise<AccountActivityItem[]> {
  const { data: cases, error: casesError } = await supabase
    .from("cases")
    .select(
      "id, case_number, subject, status, channel, contact_type, assigned_to, created_at, priority",
    )
    .eq("customer_id", customerDbId)
    .order("created_at", { ascending: false })
    .returns<CustomerCaseRecord[]>();

  if (casesError) {
    throw new CustomerAccountActivityError(
      "No se pudieron cargar los casos asociados a la cuenta.",
    );
  }

  const customerCases = cases ?? [];
  const caseIds = customerCases.map((caseItem) => caseItem.id);
  const casesById = new Map(customerCases.map((caseItem) => [caseItem.id, caseItem]));

  const messagesPromise = caseIds.length
    ? supabase
        .from("messages")
        .select(
          "id, case_id, body, sender_type, direction, created_at, channel, message_type, email_subject",
        )
        .in("case_id", caseIds)
        .order("created_at", { ascending: false })
        .returns<CustomerMessageRecord[]>()
    : Promise.resolve({ data: [] as CustomerMessageRecord[], error: null });

  const callsByCasePromise = caseIds.length
    ? supabase
        .from("aircall_calls")
        .select(
          "id, case_id, direction, status, result, started_at, created_at, duration_seconds, aircall_user_name",
        )
        .in("case_id", caseIds)
        .order("started_at", { ascending: false })
        .returns<CustomerCallRecord[]>()
    : Promise.resolve({ data: [] as CustomerCallRecord[], error: null });

  const callsByCustomerPromise = supabase
    .from("aircall_calls")
    .select(
      "id, case_id, direction, status, result, started_at, created_at, duration_seconds, aircall_user_name",
    )
    .eq("customer_id", customerDbId)
    .order("started_at", { ascending: false })
    .returns<CustomerCallRecord[]>();

  const [messagesResult, callsByCaseResult, callsByCustomerResult] =
    await Promise.all([
      messagesPromise,
      callsByCasePromise,
      callsByCustomerPromise,
    ]);

  const caseActivity: AccountActivityItem[] = customerCases
    .filter((caseItem) => caseItem.created_at)
    .map((caseItem) => ({
      activity_id: `case-${caseItem.id}`,
      activity_type: "CASE",
      activity_category: "case",
      title: caseLabel(caseItem),
      description: caseDescription(caseItem),
      occurred_at: caseItem.created_at as string,
      channel: caseItem.channel,
      status: caseItem.status,
      href: `/casos/${caseItem.id}`,
    }));

  const messageActivity: AccountActivityItem[] = (messagesResult.data ?? [])
    .filter((message) => message.created_at)
    .flatMap((message) => {
      const channel = message.channel?.toUpperCase() || "";
      const sender = message.sender_type?.toUpperCase() || "";
      const isEmail =
        channel === "EMAIL" || channel === "GMAIL" || Boolean(message.email_subject);
      const isWhatsappOrAi =
        channel === "WHATSAPP" || /AI|IA|BOT|ASSISTANT/.test(sender);
      if (!isEmail && !isWhatsappOrAi) return [];

      const relatedCase = casesById.get(message.case_id);
      const activityCategory = isEmail ? "email" : "whatsapp_ai";
      const title = isEmail
        ? message.email_subject || "Email sin asunto"
        : `Mensaje ${/AI|IA|BOT|ASSISTANT/.test(sender) ? "IA" : "WhatsApp"}`;

      return [{
        activity_id: `message-${message.id}`,
        activity_type: isEmail ? "EMAIL" : /AI|IA|BOT|ASSISTANT/.test(sender) ? "AI" : "WHATSAPP",
        activity_category: activityCategory,
        title,
        description: [
          relatedCase ? caseLabel(relatedCase) : null,
          message.direction,
          message.body,
        ].filter(Boolean).join(" · "),
        occurred_at: message.created_at as string,
        channel: message.channel,
        href: `/casos/${message.case_id}`,
      } satisfies AccountActivityItem];
    });

  const calls = new Map<string, CustomerCallRecord>();
  for (const call of [
    ...(callsByCaseResult.data ?? []),
    ...(callsByCustomerResult.data ?? []),
  ]) {
    calls.set(call.id, call);
  }

  const callActivity: AccountActivityItem[] = [...calls.values()].map((call) => ({
    activity_id: `call-${call.id}`,
    activity_type: "CALL",
    activity_category: "call",
    title: `Llamada ${call.direction || "Aircall"}`,
    description: [
      call.result || call.status,
      call.aircall_user_name,
      call.duration_seconds === null ? null : `${call.duration_seconds}s`,
    ].filter(Boolean).join(" · "),
    occurred_at: call.started_at || call.created_at,
    status: call.status,
    href: call.case_id ? `/casos/${call.case_id}` : undefined,
  }));

  return [...caseActivity, ...messageActivity, ...callActivity].sort(
    (left, right) =>
      new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime(),
  );
}
