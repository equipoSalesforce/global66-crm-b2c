import { PageHeader } from "@/components/page-header";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type KnowledgeArticle = {
  id: string | number;
  title: string | null;
  content: string | null;
  category: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function formatDate(date: string | null) {
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
  }).format(parsedDate);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-950">{value}</dd>
    </div>
  );
}

export default async function KnowledgeArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("knowledge_articles")
    .select("id, title, content, category, is_active, created_at, updated_at")
    .eq("id", id)
    .limit(1)
    .returns<KnowledgeArticle[]>();

  if (error || !data?.[0]) {
    notFound();
  }

  const article = data[0];

  return (
    <>
      <PageHeader
        title={article.title || "Artículo sin título"}
        description="Detalle del artículo utilizado por CRM."
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-950">Contenido</h2>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-700">
            {article.content || "Sin contenido disponible."}
          </p>
        </article>

        <aside className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-950">Datos</h2>
          <dl className="mt-5 space-y-4">
            <InfoRow label="Categoría" value={article.category || "Sin categoría"} />
            <InfoRow
              label="Estado"
              value={article.is_active ? "Activo" : "Inactivo"}
            />
            <InfoRow label="Creado" value={formatDate(article.created_at)} />
            <InfoRow label="Actualizado" value={formatDate(article.updated_at)} />
          </dl>
        </aside>
      </section>
    </>
  );
}
