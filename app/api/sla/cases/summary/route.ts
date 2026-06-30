import {
  computeCaseSla,
  FRT_TARGET_SECONDS,
  type CaseSlaCase,
  type CaseSlaMessage,
} from "@/lib/case-sla";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function groupMessagesByCase(messages: CaseSlaMessage[]) {
  const grouped = new Map<string, CaseSlaMessage[]>();

  messages.forEach((message) => {
    if (!message.case_id) return;

    const caseId = String(message.case_id);
    grouped.set(caseId, [...(grouped.get(caseId) ?? []), message]);
  });

  return grouped;
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

export async function GET() {
  const [casesResult, messagesResult] = await Promise.all([
    supabase
      .from("cases")
      .select(
        "id, case_number, subject, channel, priority, assigned_to, assigned_agent_id, assigned_at, created_at, updated_at, closed_at, lifecycle_status, routing_status, status",
      )
      .returns<CaseSlaCase[]>(),
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
  const cases = casesResult.data ?? [];
  const computed = cases.map((caseItem) =>
    computeCaseSla(
      { ...caseItem, id: String(caseItem.id) },
      messagesByCase.get(String(caseItem.id)) ?? [],
    ),
  );
  const closedCases = cases.filter(
    (caseItem) =>
      caseItem.status === "CLOSED" || caseItem.lifecycle_status === "CLOSED",
  );
  const pendingFirstResponseCount = computed.filter(
    (sla) => sla.notificationStatus === "RED",
  ).length;
  const waitingAgentCount = computed.filter(
    (sla) => sla.notificationStatus === "BLUE",
  ).length;
  const breachedFrtCount = computed.filter(
    (sla) => sla.frtSeconds > FRT_TARGET_SECONDS,
  ).length;

  return Response.json({
    totalCases: cases.length,
    openCases: cases.length - closedCases.length,
    closedCases: closedCases.length,
    avgFrtSeconds: average(computed.map((sla) => sla.frtSeconds)),
    avgAhtTotalSeconds: average(computed.map((sla) => sla.ahtTotalSeconds)),
    avgAhtAgentSeconds: average(computed.map((sla) => sla.ahtAgentSeconds)),
    avgTtcSeconds: average(
      computed
        .map((sla) => sla.ttcSeconds)
        .filter((seconds): seconds is number => seconds !== null),
    ),
    breachedFrtCount,
    pendingFirstResponseCount,
    waitingAgentCount,
  });
}
