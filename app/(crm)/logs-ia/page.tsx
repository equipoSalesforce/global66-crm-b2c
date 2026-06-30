import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

type AiMessageArticleLog = {
  id: string | number;
  case_id: string | number | null;
  message_id: string | number | null;
  article_id: string | number | null;
  article_title: string | null;
  relevance_score: number | null;
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

function formatRelevance(value: number | null) {
  if (value === null) {
    return "0%";
  }

  return `${Math.round(value * 100)}%`;
}

export default async function LogsIaPage() {
  const { data, error } = await supabase
    .from("ai_message_articles")
    .select("id, case_id, message_id, article_id, article_title, relevance_score, created_at")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<AiMessageArticleLog[]>();

  const logs = data ?? [];

  return (
    <>
      <PageHeader
        title="Logs IA"
        description="Trazabilidad de artículos utilizados por respuestas generadas con IA."
      />

      <RoleGuard anyPermission={["viewAiLogs"]}>
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-bold text-gray-950">
              Trazabilidad IA
            </h2>
          </div>

          {error ? (
            <p className="p-6 text-sm text-[var(--g66-danger)]">
              No se pudieron cargar los logs IA.
            </p>
          ) : logs.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {logs.map((log) => (
                <li key={log.id} className="grid gap-3 p-5 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-semibold text-gray-950">
                      {log.article_title || "Artículo sin título"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Mensaje {log.message_id || "sin mensaje"} ·{" "}
                      {formatRelevance(log.relevance_score)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      {formatDateTime(log.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {log.case_id ? (
                      <Link
                        href={`/casos/${log.case_id}`}
                        className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Ver caso
                      </Link>
                    ) : null}
                    {log.article_id ? (
                      <Link
                        href={`/base-conocimiento/${log.article_id}`}
                        className="inline-flex h-9 items-center rounded-lg border border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue-soft)] px-3 text-sm font-semibold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                      >
                        Ver artículo
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-gray-600">
              No hay logs IA registrados todavía.
            </p>
          )}
        </section>
      </RoleGuard>
    </>
  );
}
