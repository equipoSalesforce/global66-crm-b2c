import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type KnowledgeArticle = {
  id?: string | number | null;
  title?: string | null;
  name?: string | null;
  question?: string | null;
  content?: string | null;
  answer?: string | null;
  summary?: string | null;
  status?: string | null;
};

function getArticleTitle(article: KnowledgeArticle, index: number) {
  return (
    article.title ??
    article.name ??
    article.question ??
    `Artículo ${index + 1}`
  );
}

function getArticleDescription(article: KnowledgeArticle) {
  return (
    article.summary ??
    article.content ??
    article.answer ??
    "Artículo disponible para la base de conocimiento."
  );
}

export default async function BaseConocimientoPage() {
  const { data, error } = await supabase
    .from("knowledge_articles")
    .select("*")
    .limit(50)
    .returns<KnowledgeArticle[]>();

  const articles = data ?? [];

  return (
    <>
      <PageHeader
        title="Base de conocimiento"
        description="Artículos que alimentan las respuestas asistidas por IA."
      />

      <RoleGuard anyPermission={["viewKnowledgeBase"]}>
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-bold text-gray-950">Artículos IA</h2>
          </div>

          {error ? (
            <p className="p-6 text-sm text-[var(--g66-danger)]">
              No se pudieron cargar los artículos.
            </p>
          ) : articles.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {articles.map((article, index) => (
                <li key={article.id ?? index} className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-950">
                        {getArticleTitle(article, index)}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">
                        {getArticleDescription(article)}
                      </p>
                    </div>

                    {article.status ? (
                      <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                        {article.status}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-gray-600">
              No hay artículos para mostrar.
            </p>
          )}
        </section>
      </RoleGuard>
    </>
  );
}
