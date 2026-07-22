import "server-only";

import {
  chunkKnowledgeContent,
  parseKnowledgeText,
} from "@/lib/ai-knowledge-importer";
import type {
  KnowledgeArticle,
  KnowledgeSource,
  KnowledgeVisibility,
} from "@/lib/ai-knowledge-types";
import { getCurrentCrmUser } from "@/lib/current-crm-user";
import {
  hasPermission,
  normalizeRole,
  type CrmRolePermissionRecord,
} from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

type SourceRow = {
  id: string;
  title: string;
  description: string | null;
  source_type: string;
  current_version_id: string | null;
  status: "ACTIVE" | "ARCHIVED";
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

type VersionRow = {
  id: string;
  source_id: string;
  version_label: string;
  file_name: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  published_at: string | null;
  created_at: string;
};

type ArticleRow = {
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function requireText(value: unknown, field: string, maxLength = 200) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${field} es obligatorio.`);
  return text.slice(0, maxLength);
}

function optionalText(value: unknown, maxLength = 200) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

function mapArticle(row: ArticleRow, sources: Map<string, string>, versions: Map<string, VersionRow>): KnowledgeArticle {
  const version = row.version_id ? versions.get(row.version_id) : null;
  return {
    id: row.id,
    sourceId: row.source_id,
    versionId: row.version_id,
    title: row.title,
    content: row.content,
    product: row.product,
    country: row.country,
    plan: row.plan,
    customerType: row.customer_type,
    category: row.category,
    section: row.section,
    visibility: row.visibility,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceTitle: row.source_id ? sources.get(row.source_id) ?? null : null,
    versionLabel: version?.version_label ?? null,
    versionStatus: version?.status ?? null,
  };
}

export async function getKnowledgeActor({ manager = false } = {}) {
  const user = await getCurrentCrmUser();
  if (!manager) return user;

  const { data } = await supabase
    .from("crm_role_permissions")
    .select("role, permission_key, enabled")
    .returns<CrmRolePermissionRecord[]>();
  const allowed = hasPermission(
    normalizeRole(user.role),
    "editKnowledgeBase",
    data ?? [],
  );
  if (!allowed) throw new Error("No tienes permisos para administrar Conocimiento IA.");
  return user;
}

export async function listKnowledgeSources(): Promise<KnowledgeSource[]> {
  await getKnowledgeActor();
  const [sourcesResult, versionsResult, articlesResult, chunksResult, usersResult] = await Promise.all([
    supabase.from("knowledge_sources").select("id, title, description, source_type, current_version_id, status, created_at, updated_at, updated_by").is("deleted_at", null).order("updated_at", { ascending: false }).returns<SourceRow[]>(),
    supabase.from("knowledge_source_versions").select("id, source_id, version_label, file_name, status, published_at, created_at").order("created_at", { ascending: false }).returns<VersionRow[]>(),
    supabase.from("knowledge_articles").select("id, source_id").is("deleted_at", null).returns<Array<{ id: string; source_id: string | null }>>(),
    supabase.from("knowledge_chunks").select("id, article_id").returns<Array<{ id: string; article_id: string }>>(),
    supabase.from("crm_users").select("id, name").returns<Array<{ id: string; name: string }>>(),
  ]);
  const error = sourcesResult.error || versionsResult.error || articlesResult.error || chunksResult.error || usersResult.error;
  if (error) throw new Error(error.message);

  const articleSource = new Map((articlesResult.data ?? []).map((row) => [row.id, row.source_id]));
  const users = new Map((usersResult.data ?? []).map((row) => [row.id, row.name]));
  return (sourcesResult.data ?? []).map((source) => {
    const sourceArticleIds = new Set((articlesResult.data ?? []).filter((row) => row.source_id === source.id).map((row) => row.id));
    return {
      id: source.id,
      title: source.title,
      description: source.description,
      sourceType: source.source_type,
      currentVersionId: source.current_version_id,
      status: source.status,
      createdAt: source.created_at,
      updatedAt: source.updated_at,
      updatedBy: source.updated_by ? users.get(source.updated_by) ?? null : null,
      articleCount: sourceArticleIds.size,
      chunkCount: (chunksResult.data ?? []).filter((row) => sourceArticleIds.has(row.article_id) || articleSource.get(row.article_id) === source.id).length,
      versions: (versionsResult.data ?? []).filter((version) => version.source_id === source.id).map((version) => ({
        id: version.id,
        sourceId: version.source_id,
        versionLabel: version.version_label,
        fileName: version.file_name,
        status: version.status,
        publishedAt: version.published_at,
        createdAt: version.created_at,
      })),
    };
  });
}

export async function listKnowledgeArticles(filters: Record<string, string | undefined> = {}) {
  await getKnowledgeActor();
  let query = supabase
    .from("knowledge_articles")
    .select("id, source_id, version_id, title, content, product, country, plan, customer_type, category, section, visibility, is_active, created_at, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (filters.product) query = query.eq("product", filters.product);
  if (filters.country) query = query.eq("country", filters.country);
  if (filters.plan) query = query.eq("plan", filters.plan);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.visibility) query = query.eq("visibility", filters.visibility);
  if (filters.status === "ACTIVE") query = query.eq("is_active", true);
  if (filters.status === "INACTIVE") query = query.eq("is_active", false);
  if (filters.q) query = query.or(`title.ilike.%${filters.q.replace(/[,()]/g, " ")}%,content.ilike.%${filters.q.replace(/[,()]/g, " ")}%`);

  const [articlesResult, sourcesResult, versionsResult] = await Promise.all([
    query.returns<ArticleRow[]>(),
    supabase.from("knowledge_sources").select("id, title").returns<Array<{ id: string; title: string }>>(),
    supabase.from("knowledge_source_versions").select("id, source_id, version_label, file_name, status, published_at, created_at").returns<VersionRow[]>(),
  ]);
  const error = articlesResult.error || sourcesResult.error || versionsResult.error;
  if (error) throw new Error(error.message);
  const sources = new Map((sourcesResult.data ?? []).map((row) => [row.id, row.title]));
  const versions = new Map((versionsResult.data ?? []).map((row) => [row.id, row]));
  return (articlesResult.data ?? []).map((row) => mapArticle(row, sources, versions));
}

export async function createKnowledgeSource(input: Record<string, unknown>) {
  const user = await getKnowledgeActor({ manager: true });
  const title = requireText(input.title, "Título");
  const { data: source, error } = await supabase.from("knowledge_sources").insert({
    title,
    description: optionalText(input.description, 1000),
    source_type: optionalText(input.sourceType) ?? "MANUAL",
    created_by: user.id,
    updated_by: user.id,
  }).select("id").single<{ id: string }>();
  if (error || !source) throw new Error(error?.message ?? "No se pudo crear la fuente.");
  const { data: version, error: versionError } = await supabase.from("knowledge_source_versions").insert({
    source_id: source.id,
    version_label: optionalText(input.versionLabel) ?? "v1",
    status: "DRAFT",
    created_by: user.id,
  }).select("id").single<{ id: string }>();
  if (versionError || !version) throw new Error(versionError?.message ?? "No se pudo crear la versión inicial.");
  return { sourceId: source.id, versionId: version.id };
}

export async function updateKnowledgeSource(sourceId: string, input: Record<string, unknown>) {
  const user = await getKnowledgeActor({ manager: true });
  const { error } = await supabase.from("knowledge_sources").update({
    title: requireText(input.title, "Título"),
    description: optionalText(input.description, 1000),
    source_type: optionalText(input.sourceType) ?? "MANUAL",
    updated_by: user.id,
  }).eq("id", sourceId);
  if (error) throw new Error(error.message);
}

async function replaceArticleChunks(articleId: string, versionId: string | null, content: string, metadata: Record<string, unknown>) {
  const { error: deleteError } = await supabase.from("knowledge_chunks").delete().eq("article_id", articleId);
  if (deleteError) throw new Error(deleteError.message);
  const chunks = chunkKnowledgeContent(content);
  if (!chunks.length) return;
  const { error } = await supabase.from("knowledge_chunks").insert(chunks.map((chunk, index) => ({
    article_id: articleId,
    version_id: versionId,
    chunk_index: index,
    content: chunk,
    metadata,
  })));
  if (error) throw new Error(error.message);
}

export async function saveKnowledgeArticle(input: Record<string, unknown>, articleId?: string) {
  const user = await getKnowledgeActor({ manager: true });
  const title = requireText(input.title, "Título");
  const content = requireText(input.content, "Contenido", 100000);
  const visibility = String(input.visibility ?? "CUSTOMER_ALLOWED") as KnowledgeVisibility;
  if (!["CUSTOMER_ALLOWED", "AGENT_GUIDANCE", "INTERNAL_ONLY"].includes(visibility)) throw new Error("Visibilidad inválida.");
  const values = {
    source_id: optionalText(input.sourceId),
    version_id: optionalText(input.versionId),
    title,
    content,
    product: optionalText(input.product),
    country: optionalText(input.country),
    plan: optionalText(input.plan),
    customer_type: optionalText(input.customerType),
    category: optionalText(input.category),
    section: optionalText(input.section),
    visibility,
    is_active: input.isActive !== false,
    updated_by: user.id,
  };
  const operation = articleId
    ? supabase.from("knowledge_articles").update(values).eq("id", articleId)
    : supabase.from("knowledge_articles").insert({ ...values, created_by: user.id });
  const { data, error } = await operation.select("id").single<{ id: string }>();
  if (error || !data) throw new Error(error?.message ?? "No se pudo guardar el artículo.");
  await replaceArticleChunks(data.id, values.version_id, content, {
    product: values.product,
    country: values.country,
    plan: values.plan,
    category: values.category,
    visibility,
  });
  return { articleId: data.id };
}

export async function setKnowledgeArticleActive(articleId: string, isActive: boolean) {
  const user = await getKnowledgeActor({ manager: true });
  const { error } = await supabase.from("knowledge_articles").update({ is_active: isActive, updated_by: user.id }).eq("id", articleId);
  if (error) throw new Error(error.message);
}

export async function importKnowledgeText(input: Record<string, unknown>) {
  const user = await getKnowledgeActor({ manager: true });
  const rawText = requireText(input.rawText, "Texto", 1000000);
  let sourceId = optionalText(input.sourceId);
  if (!sourceId) {
    const created = await createKnowledgeSource({
      title: input.title,
      description: input.description,
      sourceType: input.fileName ? "DOCUMENT" : "PASTED_TEXT",
      versionLabel: input.versionLabel,
    });
    sourceId = created.sourceId;
    const articles = parseKnowledgeText(rawText);
    await importParsedArticles(created.versionId, sourceId, articles, user.id, rawText, optionalText(input.fileName));
    return { ...created, articleCount: articles.length };
  }
  const versionLabel = requireText(input.versionLabel, "Versión", 80);
  const { data: version, error } = await supabase.from("knowledge_source_versions").insert({
    source_id: sourceId,
    version_label: versionLabel,
    file_name: optionalText(input.fileName, 255),
    raw_text: rawText,
    status: "DRAFT",
    created_by: user.id,
  }).select("id").single<{ id: string }>();
  if (error || !version) throw new Error(error?.message ?? "No se pudo crear la versión.");
  const articles = parseKnowledgeText(rawText);
  await importParsedArticles(version.id, sourceId, articles, user.id, rawText, optionalText(input.fileName));
  return { sourceId, versionId: version.id, articleCount: articles.length };
}

async function importParsedArticles(versionId: string, sourceId: string, articles: ReturnType<typeof parseKnowledgeText>, userId: string, rawText: string, fileName: string | null) {
  const { error: versionError } = await supabase.from("knowledge_source_versions").update({ raw_text: rawText, file_name: fileName }).eq("id", versionId);
  if (versionError) throw new Error(versionError.message);
  for (const article of articles) {
    await saveKnowledgeArticle({
      sourceId,
      versionId,
      title: article.title,
      content: article.content,
      section: article.section,
      visibility: article.visibility,
      isActive: true,
      createdBy: userId,
    });
  }
}

export async function publishKnowledgeVersion(versionId: string, rollback = false, notes?: string) {
  const user = await getKnowledgeActor({ manager: true });
  const { count, error: countError } = await supabase
    .from("knowledge_articles")
    .select("id", { count: "exact", head: true })
    .eq("version_id", versionId)
    .eq("is_active", true)
    .is("deleted_at", null);
  if (countError) throw new Error(countError.message);
  if (!count) throw new Error("La versión debe tener al menos un artículo activo antes de publicarse.");
  const { error } = await supabase.rpc("publish_knowledge_version", {
    p_version_id: versionId,
    p_user_id: user.id,
    p_event_type: rollback ? "ROLLBACK" : "PUBLISH",
    p_notes: notes ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function archiveKnowledgeSource(sourceId: string) {
  const user = await getKnowledgeActor({ manager: true });
  const { error } = await supabase.from("knowledge_sources").update({ status: "ARCHIVED", updated_by: user.id }).eq("id", sourceId);
  if (error) throw new Error(error.message);
  const { error: eventError } = await supabase.from("knowledge_publication_events").insert({
    source_id: sourceId,
    event_type: "ARCHIVE",
    created_by: user.id,
  });
  if (eventError) throw new Error(eventError.message);
}

export async function createKnowledgeFeedback(input: Record<string, unknown>) {
  const user = await getKnowledgeActor();
  const rating = String(input.rating ?? "").toUpperCase();
  if (!["HELPFUL", "NOT_HELPFUL"].includes(rating)) throw new Error("Feedback inválido.");
  const { error } = await supabase.from("knowledge_feedback").insert({
    case_id: optionalText(input.caseId),
    article_id: optionalText(input.articleId),
    chunk_id: optionalText(input.chunkId),
    user_id: user.id,
    rating,
    comment: optionalText(input.comment, 1000),
  });
  if (error) throw new Error(error.message);
}
