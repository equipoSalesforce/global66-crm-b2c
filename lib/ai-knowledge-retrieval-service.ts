import "server-only";

import type {
  KnowledgeRetrievalRequest,
  KnowledgeSearchResult,
  KnowledgeVisibility,
} from "@/lib/ai-knowledge-types";
import { supabase } from "@/lib/supabase";

type PublishedSourceRow = { id: string; title: string; current_version_id: string | null };
type PublishedVersionRow = { id: string; source_id: string; version_label: string };
type PublishedArticleRow = {
  id: string;
  source_id: string | null;
  version_id: string | null;
  title: string;
  content: string;
  product: string | null;
  country: string | null;
  plan: string | null;
  customer_type: string | null;
  category: string | null;
  section: string | null;
  visibility: KnowledgeVisibility;
};
type ChunkRow = { id: string; article_id: string; content: string };

function normalize(value: string | null | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function tokens(value: string) {
  return [...new Set(normalize(value).split(/[^a-z0-9]+/).filter((token) => token.length >= 2))];
}

function metadataScore(expected: string | null | undefined, actual: string | null) {
  if (!expected || !actual) return 0;
  return normalize(expected) === normalize(actual) ? 0.18 : 0;
}

function snippet(content: string, queryTokens: string[]) {
  const normalizedContent = normalize(content);
  const firstIndex = queryTokens.reduce((best, token) => {
    const index = normalizedContent.indexOf(token);
    return index >= 0 && (best < 0 || index < best) ? index : best;
  }, -1);
  const start = Math.max(0, firstIndex - 90);
  const value = content.slice(start, start + 360).trim();
  return `${start > 0 ? "…" : ""}${value}${start + 360 < content.length ? "…" : ""}`;
}

export async function retrieveKnowledge(request: KnowledgeRetrievalRequest): Promise<KnowledgeSearchResult[]> {
  const query = request.query.trim().slice(0, 500);
  if (query.length < 2) return [];
  const queryTokens = tokens(query);
  const limit = Math.min(Math.max(request.limit ?? 8, 1), 20);

  const [sourcesResult, versionsResult] = await Promise.all([
    supabase.from("knowledge_sources").select("id, title, current_version_id").eq("status", "ACTIVE").is("deleted_at", null).returns<PublishedSourceRow[]>(),
    supabase.from("knowledge_source_versions").select("id, source_id, version_label").eq("status", "PUBLISHED").returns<PublishedVersionRow[]>(),
  ]);
  if (sourcesResult.error || versionsResult.error) throw new Error((sourcesResult.error || versionsResult.error)?.message);

  const activeSources = new Map((sourcesResult.data ?? []).map((source) => [source.id, source]));
  const publishedVersions = new Map(
    (versionsResult.data ?? [])
      .filter((version) => activeSources.get(version.source_id)?.current_version_id === version.id)
      .map((version) => [version.id, version]),
  );
  const versionIds = [...publishedVersions.keys()];
  if (!versionIds.length) return [];

  let articleQuery = supabase
    .from("knowledge_articles")
    .select("id, source_id, version_id, title, content, product, country, plan, customer_type, category, section, visibility")
    .in("version_id", versionIds)
    .eq("is_active", true)
    .is("deleted_at", null);
  if (!request.includeInternal) articleQuery = articleQuery.in("visibility", ["CUSTOMER_ALLOWED", "AGENT_GUIDANCE"]);
  const { data: articles, error: articlesError } = await articleQuery.limit(500).returns<PublishedArticleRow[]>();
  if (articlesError) throw new Error(articlesError.message);
  if (!articles?.length) return [];

  const articleIds = articles.map((article) => article.id);
  const fullTextResult = await supabase
    .from("knowledge_chunks")
    .select("id, article_id, content")
    .in("article_id", articleIds)
    .textSearch("search_vector", query, { config: "simple", type: "websearch" })
    .limit(300)
    .returns<ChunkRow[]>();
  if (fullTextResult.error) throw new Error(fullTextResult.error.message);
  const fallbackResult = fullTextResult.data?.length
    ? null
    : await supabase
        .from("knowledge_chunks")
        .select("id, article_id, content")
        .in("article_id", articleIds)
        .limit(1000)
        .returns<ChunkRow[]>();
  if (fallbackResult?.error) throw new Error(fallbackResult.error.message);
  const chunks = fullTextResult.data?.length ? fullTextResult.data : fallbackResult?.data;
  const chunksByArticle = new Map<string, ChunkRow[]>();
  for (const chunk of chunks ?? []) {
    chunksByArticle.set(chunk.article_id, [...(chunksByArticle.get(chunk.article_id) ?? []), chunk]);
  }

  return articles
    .flatMap((article) => {
      const candidates = chunksByArticle.get(article.id)?.length
        ? chunksByArticle.get(article.id)!
        : [{ id: null, article_id: article.id, content: article.content }];
      return candidates.map((chunk) => {
        const searchable = normalize(`${article.title} ${chunk.content}`);
        const matches = queryTokens.filter((token) => searchable.includes(token)).length;
        const textScore = queryTokens.length ? matches / queryTokens.length : 0;
        const score = Math.min(1, textScore * 0.64
          + metadataScore(request.product, article.product)
          + metadataScore(request.country, article.country)
          + metadataScore(request.plan, article.plan)
          + metadataScore(request.category, article.category)
          + metadataScore(request.customerType, article.customer_type));
        const version = article.version_id ? publishedVersions.get(article.version_id) : null;
        const source = article.source_id ? activeSources.get(article.source_id) : null;
        return {
          articleId: article.id,
          chunkId: chunk.id,
          title: article.title,
          snippet: snippet(chunk.content, queryTokens),
          product: article.product,
          country: article.country,
          plan: article.plan,
          customerType: article.customer_type,
          category: article.category,
          section: article.section,
          visibility: article.visibility,
          source: source?.title ?? "Fuente sin título",
          sourceId: article.source_id,
          version: version?.version_label ?? "Sin versión",
          versionId: article.version_id,
          score: Math.round(score * 100) / 100,
        } satisfies KnowledgeSearchResult;
      });
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
