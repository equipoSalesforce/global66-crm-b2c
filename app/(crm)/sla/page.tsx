import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import {
  computeCaseSla,
  formatDuration,
  getFrtSlaState,
  type CaseSlaCase,
  type CaseSlaMessage,
} from "@/lib/case-sla";
import { formatCaseNumber } from "@/lib/case-status";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SlaCaseRecord = CaseSlaCase & {
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

function getCustomerName(caseItem: SlaCaseRecord) {
  const customer = Array.isArray(caseItem.customer)
    ? caseItem.customer[0]
    : caseItem.customer;

  return customer?.name || caseItem.contact_name || caseItem.contact_email || "-";
}

function slaBadgeClass(status: string) {
  if (status === "Breached") return "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]";
  if (status === "Warning") return "bg-[var(--g66-warning-soft)] text-[var(--g66-warning-text)]";

  return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
}

export default async function SlaPage() {
  const [casesResult, messagesResult] = await Promise.all([
    supabase
      .from("cases")
      .select(
        "id, case_number, subject, channel, priority, assigned_to, assigned_agent_id, assigned_at, created_at, updated_at, closed_at, lifecycle_status, routing_status, status, contact_name, contact_email, customer:customers(name)",
      )
      .returns<SlaCaseRecord[]>(),
    supabase
      .from("messages")
      .select("case_id, direction, sender_type, channel, message_type, created_at")
      .order("created_at", { ascending: true })
      .returns<CaseSlaMessage[]>(),
  ]);
  const messagesByCase = groupMessagesByCase(messagesResult.data ?? []);
  const rows = (casesResult.data ?? []).map((caseItem) => {
    const sla = computeCaseSla(
      { ...caseItem, id: String(caseItem.id) },
      messagesByCase.get(String(caseItem.id)) ?? [],
    );

    return {
      caseItem,
      sla,
      frtSla: getFrtSlaState(sla.frtSeconds, Boolean(sla.firstAgentResponseAt)),
    };
  });
  const closedRows = rows.filter(
    ({ caseItem }) =>
      caseItem.status === "CLOSED" || caseItem.lifecycle_status === "CLOSED",
  );
  const cards = [
    ["FRT promedio", formatDuration(average(rows.map((row) => row.sla.frtSeconds)))],
    [
      "AHT total promedio",
      formatDuration(average(rows.map((row) => row.sla.ahtTotalSeconds))),
    ],
    [
      "AHT ejecutivo promedio",
      formatDuration(average(rows.map((row) => row.sla.ahtAgentSeconds))),
    ],
    [
      "TTC promedio",
      formatDuration(
        average(
          rows
            .map((row) => row.sla.ttcSeconds)
            .filter((seconds): seconds is number => seconds !== null),
        ),
      ),
    ],
    [
      "Casos sin primera respuesta",
      String(rows.filter((row) => row.sla.notificationStatus === "RED").length),
    ],
    [
      "Casos esperando agente",
      String(rows.filter((row) => row.sla.notificationStatus === "BLUE").length),
    ],
  ];

  return (
    <>
      <PageHeader
        title="SLA operativo"
        description="Métricas de primera respuesta, tiempo de atención y cierre de casos."
      />

      <RoleGuard anyPermission={["viewCases"]}>
        {casesResult.error || messagesResult.error ? (
          <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)] shadow-sm">
            {casesResult.error?.message ?? messagesResult.error?.message}
          </section>
        ) : (
          <div className="grid gap-6">
            <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              {cards.map(([label, value]) => (
                <article
                  key={label}
                  className="rounded-lg border border-[var(--g66-border)] bg-white p-4 shadow-sm"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[var(--g66-text-primary)]">
                    {value}
                  </p>
                </article>
              ))}
            </section>

            <section className="overflow-hidden rounded-lg border border-[var(--g66-border)] bg-white shadow-sm">
              <div className="border-b border-[var(--g66-border)] bg-[var(--g66-background)] px-4 py-3 text-sm font-bold text-[var(--g66-text-secondary)]">
                {rows.length} casos · {closedRows.length} cerrados
              </div>
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-[var(--g66-background)] text-xs uppercase tracking-wide text-[var(--g66-text-secondary)]">
                  <tr className="border-b border-[var(--g66-border)]">
                    <th className="px-3 py-3">Caso</th>
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">FRT</th>
                    <th className="px-3 py-3">AHT total</th>
                    <th className="px-3 py-3">AHT ejecutivo</th>
                    <th className="px-3 py-3">TTC</th>
                    <th className="px-3 py-3">SLA FRT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g66-border)]">
                  {rows.map(({ caseItem, sla, frtSla }) => (
                    <tr key={caseItem.id} className="hover:bg-[var(--g66-background)]">
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-[var(--g66-brand-blue)]">
                        <Link href={`/casos/${caseItem.id}`} className="hover:underline">
                          {formatCaseNumber(caseItem.case_number, caseItem.id)}
                        </Link>
                      </td>
                      <td className="px-3 py-3 font-semibold">
                        {getCustomerName(caseItem)}
                      </td>
                      <td className="px-3 py-3">
                        {caseItem.lifecycle_status || caseItem.status || "-"}
                      </td>
                      <td className="px-3 py-3">{formatDuration(sla.frtSeconds)}</td>
                      <td className="px-3 py-3">
                        {formatDuration(sla.ahtTotalSeconds)}
                      </td>
                      <td className="px-3 py-3">
                        {formatDuration(sla.ahtAgentSeconds)}
                      </td>
                      <td className="px-3 py-3">
                        {formatDuration(sla.ttcSeconds ?? sla.ttcRunningSeconds)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${slaBadgeClass(frtSla)}`}
                        >
                          {frtSla}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </RoleGuard>
    </>
  );
}
