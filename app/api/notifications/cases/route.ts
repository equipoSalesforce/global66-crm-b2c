import {
  computeCaseSla,
  type CaseNotificationStatus,
  type CaseSlaCase,
  type CaseSlaMessage,
} from "@/lib/case-sla";
import { formatCaseNumber } from "@/lib/case-status";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type NotificationCaseRecord = CaseSlaCase & {
  contact_name: string | null;
  contact_email: string | null;
  customer:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
};

function getCustomerName(caseItem: NotificationCaseRecord) {
  const customer = Array.isArray(caseItem.customer)
    ? caseItem.customer[0]
    : caseItem.customer;

  return (
    customer?.name ||
    caseItem.contact_name ||
    caseItem.contact_email ||
    "Cliente no relacionado"
  );
}

function groupMessagesByCase(messages: CaseSlaMessage[]) {
  const grouped = new Map<string, CaseSlaMessage[]>();

  messages.forEach((message) => {
    if (!message.case_id) return;

    const caseId = String(message.case_id);
    grouped.set(caseId, [...(grouped.get(caseId) ?? []), message]);
  });

  return grouped;
}

function getLatestDate(...values: Array<string | null | undefined>) {
  const latestTime = values.reduce<number | null>((latest, value) => {
    if (!value) return latest;

    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return latest;

    return latest === null || time > latest ? time : latest;
  }, null);

  return latestTime === null ? null : new Date(latestTime).toISOString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId")?.trim();
  const channel = url.searchParams.get("channel")?.trim().toUpperCase();
  const openOnly = url.searchParams.get("openOnly") !== "false";
  let casesQuery = supabase
    .from("cases")
    .select(
      "id, case_number, subject, channel, priority, assigned_to, assigned_agent_id, assigned_at, created_at, updated_at, closed_at, lifecycle_status, routing_status, status, contact_name, contact_email, customer:customers(name)",
    )
    .order("updated_at", { ascending: false });

  if (openOnly) {
    casesQuery = casesQuery
      .neq("status", "CLOSED")
      .or("lifecycle_status.is.null,lifecycle_status.neq.CLOSED");
  }

  if (agentId) {
    casesQuery = casesQuery.eq("assigned_agent_id", agentId);
  }

  if (channel) {
    casesQuery = casesQuery.eq("channel", channel);
  }

  const [casesResult, messagesResult] = await Promise.all([
    casesQuery.returns<NotificationCaseRecord[]>(),
    supabase
      .from("messages")
      .select("case_id, direction, sender_type, channel, message_type, created_at")
      .order("created_at", { ascending: true })
      .returns<CaseSlaMessage[]>(),
  ]);

  if (casesResult.error || messagesResult.error) {
    return Response.json(
      {
        error: casesResult.error?.message ?? messagesResult.error?.message,
      },
      { status: 500 },
    );
  }

  const messagesByCase = groupMessagesByCase(messagesResult.data ?? []);
  const summary: Record<Lowercase<CaseNotificationStatus> | "total", number> = {
    red: 0,
    blue: 0,
    green: 0,
    neutral: 0,
    total: 0,
  };
  const cases = (casesResult.data ?? []).map((caseItem) => {
    const caseMessages = messagesByCase.get(String(caseItem.id)) ?? [];

    const sla = computeCaseSla(
      { ...caseItem, id: String(caseItem.id) },
      caseMessages,
    );
    const summaryKey = sla.notificationStatus.toLowerCase() as Lowercase<
      CaseNotificationStatus
    >;
    const lastActivityAt = getLatestDate(
      sla.lastCustomerMessageAt,
      sla.lastAgentMessageAt,
      caseItem.updated_at,
      caseItem.created_at,
    );

    summary[summaryKey] += 1;
    summary.total += 1;

    return {
      caseId: String(caseItem.id),
      caseNumber: formatCaseNumber(caseItem.case_number, caseItem.id),
      subject: caseItem.subject,
      customerName: getCustomerName(caseItem),
      channel: caseItem.channel,
      priority: caseItem.priority,
      assignedTo: caseItem.assigned_to,
      notificationStatus: sla.notificationStatus,
      notificationLabel: sla.notificationLabel,
      lastCustomerMessageAt: sla.lastCustomerMessageAt,
      lastAgentMessageAt: sla.lastAgentMessageAt,
      lastActivityAt,
      assignedAt: sla.assignedAt,
      createdAt: caseItem.created_at,
      minutesWaiting: sla.minutesWaiting,
      frtSeconds: sla.frtSeconds,
      ahtTotalSeconds: sla.ahtTotalSeconds,
      ahtAgentSeconds: sla.ahtAgentSeconds,
      ttcSeconds: sla.ttcSeconds,
    };
  }).sort((a, b) => {
    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;

    return bTime - aTime;
  });

  return Response.json({
    summary,
    cases,
  });
}
