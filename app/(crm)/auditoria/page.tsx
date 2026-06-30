import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

type AssignmentAuditLog = {
  id: string | number;
  case_id: string | number | null;
  agent_id: string | null;
  reason: string | null;
  created_at: string | null;
};

function formatDateTime(date: string | null) {
  if (!date) {
    return "Sin fecha";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

export default async function AuditoriaPage() {
  const { data, error } = await supabase
    .from("assignment_logs")
    .select("id, case_id, agent_id, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<AssignmentAuditLog[]>();

  const logs = data ?? [];

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Registro auditable de eventos operativos relevantes."
      />

      <RoleGuard anyPermission={["viewAudit"]}>
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-bold text-gray-950">
              Logs de asignación
            </h2>
          </div>

          {error ? (
            <p className="p-6 text-sm text-[var(--g66-danger)]">
              No se pudieron cargar los logs de auditoría.
            </p>
          ) : logs.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {logs.map((log) => (
                <li key={log.id} className="grid gap-3 p-5 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-semibold text-gray-950">
                      {log.reason || "Evento de asignación registrado."}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Agente {log.agent_id || "sin agente"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      {formatDateTime(log.created_at)}
                    </p>
                  </div>
                  {log.case_id ? (
                    <Link
                      href={`/casos/${log.case_id}`}
                      className="inline-flex h-9 items-center rounded-lg border border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue-soft)] px-3 text-sm font-semibold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] md:justify-self-end"
                    >
                      Ver caso
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-gray-600">
              No hay eventos de auditoría registrados todavía.
            </p>
          )}
        </section>
      </RoleGuard>
    </>
  );
}
