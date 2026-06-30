import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import {
  computeCaseSla,
  formatDuration,
  type CaseNotificationStatus,
  type CaseSlaCase,
  type CaseSlaMessage,
} from "@/lib/case-sla";
import { formatCaseNumber } from "@/lib/case-status";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

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

function groupMessagesByCase(messages: CaseSlaMessage[]) {
  const grouped = new Map<string, CaseSlaMessage[]>();

  messages.forEach((message) => {
    if (!message.case_id) return;

    const caseId = String(message.case_id);
    grouped.set(caseId, [...(grouped.get(caseId) ?? []), message]);
  });

  return grouped;
}

function getCustomerName(caseItem: NotificationCaseRecord) {
  const customer = Array.isArray(caseItem.customer)
    ? caseItem.customer[0]
    : caseItem.customer;

  return customer?.name || caseItem.contact_name || caseItem.contact_email || "-";
}

function formatDate(date: string | null | undefined) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function badgeClass(status: CaseNotificationStatus) {
  if (status === "RED") return "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]";
  if (status === "BLUE") return "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]";
  if (status === "NEUTRAL") return "bg-[var(--g66-background)] text-[var(--g66-text-secondary)]";

  return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
}

export default async function NotificacionesPage() {
  const [casesResult, messagesResult] = await Promise.all([
    supabase
      .from("cases")
      .select(
        "id, case_number, subject, channel, priority, assigned_to, assigned_agent_id, assigned_at, created_at, updated_at, closed_at, lifecycle_status, routing_status, status, contact_name, contact_email, customer:customers(name)",
      )
      .neq("status", "CLOSED")
      .order("updated_at", { ascending: false })
      .returns<NotificationCaseRecord[]>(),
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
    };
  });
  const summary = rows.reduce(
    (counts, row) => {
      counts.total += 1;
      if (row.sla.notificationStatus === "RED") counts.red += 1;
      if (row.sla.notificationStatus === "BLUE") counts.blue += 1;
      if (row.sla.notificationStatus === "GREEN") counts.green += 1;

      return counts;
    },
    { red: 0, blue: 0, green: 0, total: 0 },
  );

  return (
    <>
      <PageHeader
        title="Centro de notificaciones"
        description="Casos pendientes por primera respuesta, respuesta de cliente y seguimiento operativo."
      />

      <RoleGuard anyPermission={["viewCases"]}>
        {casesResult.error || messagesResult.error ? (
          <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)] shadow-sm">
            {casesResult.error?.message ?? messagesResult.error?.message}
          </section>
        ) : (
          <div className="grid gap-6">
            <section className="grid gap-4 md:grid-cols-4">
              {[
                ["Rojo", "Sin primera respuesta", summary.red, "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]"],
                ["Azul", "Cliente respondió", summary.blue, "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]"],
                ["Verde", "Al día", summary.green, "bg-[var(--g66-success-soft)] text-[var(--g66-success)]"],
                ["Total", "Pendientes", summary.total, "bg-white text-[var(--g66-text-primary)]"],
              ].map(([title, label, value, className]) => (
                <article
                  key={String(title)}
                  className={`rounded-lg border border-[var(--g66-border)] p-4 shadow-sm ${className}`}
                >
                  <p className="text-xs font-bold uppercase tracking-wide">{title}</p>
                  <p className="mt-2 text-3xl font-bold">{value}</p>
                  <p className="mt-1 text-sm font-semibold">{label}</p>
                </article>
              ))}
            </section>

            <section className="overflow-hidden rounded-lg border border-[var(--g66-border)] bg-white shadow-sm">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-[var(--g66-background)] text-xs uppercase tracking-wide text-[var(--g66-text-secondary)]">
                  <tr className="border-b border-[var(--g66-border)]">
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Caso</th>
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">Asunto</th>
                    <th className="px-3 py-3">Canal</th>
                    <th className="px-3 py-3">Prioridad</th>
                    <th className="px-3 py-3">Agente</th>
                    <th className="px-3 py-3">Último cliente</th>
                    <th className="px-3 py-3">Último agente</th>
                    <th className="px-3 py-3">Esperando hace</th>
                    <th className="px-3 py-3">FRT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g66-border)]">
                  {rows.map(({ caseItem, sla }) => (
                    <tr key={caseItem.id} className="hover:bg-[var(--g66-background)]">
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${badgeClass(sla.notificationStatus)}`}
                        >
                          {sla.notificationLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-[var(--g66-brand-blue)]">
                        <Link href={`/casos/${caseItem.id}`} className="hover:underline">
                          {formatCaseNumber(caseItem.case_number, caseItem.id)}
                        </Link>
                      </td>
                      <td className="px-3 py-3 font-semibold">
                        {getCustomerName(caseItem)}
                      </td>
                      <td className="max-w-72 truncate px-3 py-3">
                        {caseItem.subject || "Sin asunto"}
                      </td>
                      <td className="px-3 py-3">{caseItem.channel || "-"}</td>
                      <td className="px-3 py-3">{caseItem.priority || "-"}</td>
                      <td className="px-3 py-3">{caseItem.assigned_to || "-"}</td>
                      <td className="px-3 py-3">{formatDate(sla.lastCustomerMessageAt)}</td>
                      <td className="px-3 py-3">{formatDate(sla.lastAgentMessageAt)}</td>
                      <td className="px-3 py-3">{sla.minutesWaiting} min</td>
                      <td className="px-3 py-3">{formatDuration(sla.frtSeconds)}</td>
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
