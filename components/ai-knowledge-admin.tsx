"use client";

import type {
  KnowledgeArticle,
  KnowledgeSearchResult,
  KnowledgeSource,
  KnowledgeVisibility,
} from "@/lib/ai-knowledge-types";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  FileUp,
  Pencil,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";

type Tab = "sources" | "articles" | "import" | "search";
type ArticleDraft = Omit<KnowledgeArticle, "id" | "createdAt" | "updatedAt"> & { id?: string };

const emptyArticle: ArticleDraft = {
  sourceId: null,
  versionId: null,
  title: "",
  content: "",
  product: null,
  country: null,
  plan: null,
  customerType: null,
  category: null,
  section: null,
  visibility: "CUSTOMER_ALLOWED",
  isActive: true,
};

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la operación.");
  return payload;
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function StatusBadge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "blue" | "amber" }) {
  const tones = {
    gray: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function AiKnowledgeAdmin() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("sources");
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [sourceDraft, setSourceDraft] = useState<{ id?: string; title: string; description: string; sourceType: string } | null>(null);
  const [articleDraft, setArticleDraft] = useState<ArticleDraft | null>(null);
  const [articleQuery, setArticleQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [importDraft, setImportDraft] = useState({ sourceId: "", title: "", description: "", versionLabel: "v1", fileName: "", rawText: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);

  const loadSources = useCallback(async () => {
    const payload = await jsonRequest<{ sources: KnowledgeSource[] }>("/api/knowledge/sources");
    setSources(payload.sources);
  }, []);

  const loadArticles = useCallback(async (filters?: { q?: string; visibility?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.q?.trim()) params.set("q", filters.q.trim());
    if (filters?.visibility) params.set("visibility", filters.visibility);
    if (filters?.status) params.set("status", filters.status);
    const payload = await jsonRequest<{ articles: KnowledgeArticle[] }>(`/api/knowledge/articles?${params}`);
    setArticles(payload.articles);
  }, []);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      void Promise.all([loadSources(), loadArticles()])
        .catch((error) => active && toast.error(error instanceof Error ? error.message : "No se pudo cargar Conocimiento IA."))
        .finally(() => active && setIsLoading(false));
    }, 0);
    return () => { active = false; window.clearTimeout(timeoutId); };
  }, [loadArticles, loadSources, toast]);

  async function saveSource(event: FormEvent) {
    event.preventDefault();
    if (!sourceDraft) return;
    setPending("source");
    try {
      await jsonRequest("/api/knowledge/sources", {
        method: sourceDraft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sourceDraft, action: sourceDraft.id ? "UPDATE" : undefined }),
      });
      toast.success(sourceDraft.id ? "Fuente actualizada." : "Fuente y versión borrador creadas.");
      setSourceDraft(null);
      await loadSources();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la fuente.");
    } finally {
      setPending(null);
    }
  }

  async function sourceAction(sourceId: string, action: "ARCHIVE") {
    setPending(`${action}:${sourceId}`);
    try {
      await jsonRequest("/api/knowledge/sources", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId, action }) });
      toast.success("Fuente archivada.");
      await loadSources();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la fuente.");
    } finally { setPending(null); }
  }

  async function publishVersion(versionId: string, rollback: boolean) {
    setPending(`publish:${versionId}`);
    try {
      await jsonRequest(`/api/knowledge/versions/${versionId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollback, notes: rollback ? "Rollback desde Conocimiento IA" : "Publicación desde Conocimiento IA" }),
      });
      toast.success(rollback ? "Versión anterior republicada." : "Versión publicada.");
      await Promise.all([loadSources(), loadArticles()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo publicar.");
    } finally { setPending(null); }
  }

  async function saveArticle(event: FormEvent) {
    event.preventDefault();
    if (!articleDraft) return;
    setPending("article");
    try {
      await jsonRequest("/api/knowledge/articles", {
        method: articleDraft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...articleDraft, articleId: articleDraft.id }),
      });
      toast.success(articleDraft.id ? "Artículo actualizado." : "Artículo creado en borrador.");
      setArticleDraft(null);
      await Promise.all([loadArticles(), loadSources()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el artículo.");
    } finally { setPending(null); }
  }

  async function toggleArticle(article: KnowledgeArticle) {
    setPending(`article:${article.id}`);
    try {
      await jsonRequest("/api/knowledge/articles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId: article.id, action: "SET_ACTIVE", isActive: !article.isActive }) });
      await loadArticles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el artículo.");
    } finally { setPending(null); }
  }

  function openNewArticle() {
    const source = sources.find((item) => item.status === "ACTIVE");
    const versionId = source?.versions.find((version) => version.status === "DRAFT")?.id
      ?? source?.currentVersionId
      ?? null;
    setArticleDraft({ ...emptyArticle, sourceId: source?.id ?? null, versionId });
    if (!source) toast.info("Crea una fuente y su versión antes de publicar artículos manuales.");
  }

  async function importText(event: FormEvent) {
    event.preventDefault();
    setPending("import");
    try {
      const payload = await jsonRequest<{ articleCount: number }>("/api/knowledge/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(importDraft) });
      toast.success(`Versión DRAFT creada con ${payload.articleCount} artículos para revisar.`);
      setImportDraft({ sourceId: "", title: "", description: "", versionLabel: "v1", fileName: "", rawText: "" });
      setTab("sources");
      await Promise.all([loadSources(), loadArticles()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo importar el texto.");
    } finally { setPending(null); }
  }

  async function chooseFile(file: File | null) {
    if (!file) return;
    if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
      setImportDraft((current) => ({ ...current, fileName: file.name, rawText: "" }));
      const rawText = await file.text();
      setImportDraft((current) => ({ ...current, fileName: file.name, rawText }));
      return;
    }
    setImportDraft((current) => ({ ...current, fileName: file.name }));
    toast.info("En esta fase PDF/DOCX conserva el nombre del archivo y requiere pegar el texto extraído para revisión.");
  }

  async function searchKnowledge(event: FormEvent) {
    event.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setPending("search");
    try {
      const payload = await jsonRequest<{ results: KnowledgeSearchResult[] }>(`/api/knowledge/search?q=${encodeURIComponent(searchQuery.trim())}&includeInternal=true`);
      setSearchResults(payload.results);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo buscar.");
    } finally { setPending(null); }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "sources", label: "Fuentes" },
    { id: "articles", label: "Artículos" },
    { id: "import", label: "Importar" },
    { id: "search", label: "Buscar" },
  ];

  if (isLoading) return <section className="rounded-xl border border-[var(--g66-border)] bg-white p-8 text-sm text-[var(--g66-text-secondary)]">Cargando Conocimiento IA...</section>;

  return (
    <div className="grid gap-4">
      <nav className="flex gap-1 rounded-xl border border-[var(--g66-border)] bg-white p-1" aria-label="Secciones de Conocimiento IA">
        {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`h-9 rounded-lg px-4 text-sm font-semibold ${tab === item.id ? "bg-[var(--g66-brand-blue)] text-white" : "text-[var(--g66-text-secondary)] hover:bg-[var(--g66-surface-soft)]"}`}>{item.label}</button>)}
      </nav>

      {tab === "sources" ? (
        <section className="grid gap-3">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Fuentes de conocimiento</h2><p className="text-sm text-[var(--g66-text-secondary)]">Sólo la versión publicada vigente alimenta las sugerencias.</p></div><button type="button" onClick={() => setSourceDraft({ title: "", description: "", sourceType: "MANUAL" })} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--g66-brand-blue)] px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Nueva fuente</button></div>
          {sourceDraft ? <form onSubmit={saveSource} className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4"><h3 className="font-semibold">{sourceDraft.id ? "Editar fuente" : "Nueva fuente"}</h3><div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-semibold">Título<input required value={sourceDraft.title} onChange={(event) => setSourceDraft({ ...sourceDraft, title: event.target.value })} className="h-9 rounded-lg border bg-white px-3 text-sm" /></label><label className="grid gap-1 text-xs font-semibold">Tipo<select value={sourceDraft.sourceType} onChange={(event) => setSourceDraft({ ...sourceDraft, sourceType: event.target.value })} className="h-9 rounded-lg border bg-white px-3 text-sm"><option value="MANUAL">Manual</option><option value="DOCUMENT">Documento</option><option value="PASTED_TEXT">Texto pegado</option></select></label></div><label className="grid gap-1 text-xs font-semibold">Descripción<textarea value={sourceDraft.description} onChange={(event) => setSourceDraft({ ...sourceDraft, description: event.target.value })} className="min-h-20 rounded-lg border bg-white p-3 text-sm" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setSourceDraft(null)} className="h-9 rounded-lg border bg-white px-3 text-sm">Cancelar</button><button disabled={pending === "source"} className="h-9 rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white">Guardar</button></div></form> : null}
          {sources.map((source) => <article key={source.id} className="rounded-xl border border-[var(--g66-border)] bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-[var(--g66-brand-blue)]" /><h3 className="font-semibold">{source.title}</h3><StatusBadge tone={source.status === "ACTIVE" ? "green" : "gray"}>{source.status}</StatusBadge></div><p className="mt-1 text-sm text-[var(--g66-text-secondary)]">{source.description || "Sin descripción"}</p><p className="mt-2 text-xs text-[var(--g66-text-muted)]">{source.articleCount} artículos · {source.chunkCount} chunks · Actualizado {formatDate(source.updatedAt)}{source.updatedBy ? ` por ${source.updatedBy}` : ""}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSourceDraft({ id: source.id, title: source.title, description: source.description || "", sourceType: source.sourceType })} className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs"><Pencil className="h-3.5 w-3.5" />Editar</button><button type="button" onClick={() => { setImportDraft((current) => ({ ...current, sourceId: source.id, title: source.title, versionLabel: `v${source.versions.length + 1}` })); setTab("import"); }} className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs"><Plus className="h-3.5 w-3.5" />Nueva versión</button><button type="button" disabled={pending === `ARCHIVE:${source.id}`} onClick={() => sourceAction(source.id, "ARCHIVE")} className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs text-slate-600"><Archive className="h-3.5 w-3.5" />Archivar</button></div></div><div className="mt-3 grid gap-2 border-t pt-3">{source.versions.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--g66-surface-soft)] px-3 py-2"><div><span className="text-sm font-semibold">{version.versionLabel}</span><span className="ml-2"><StatusBadge tone={version.status === "PUBLISHED" ? "green" : version.status === "DRAFT" ? "blue" : "amber"}>{version.status}</StatusBadge></span><span className="ml-2 text-xs text-[var(--g66-text-muted)]">{version.fileName || "Sin archivo"} · {formatDate(version.publishedAt || version.createdAt)}</span></div>{version.status !== "PUBLISHED" ? <button type="button" disabled={pending === `publish:${version.id}`} onClick={() => publishVersion(version.id, version.status === "ARCHIVED")} className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2 text-xs font-semibold text-blue-700">{version.status === "ARCHIVED" ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{version.status === "ARCHIVED" ? "Rollback" : "Publicar"}</button> : null}</div>)}</div></article>)}
          {!sources.length ? <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-[var(--g66-text-secondary)]">No hay fuentes. Crea una o importa texto.</p> : null}
        </section>
      ) : null}

      {tab === "articles" ? (
        <section className="grid gap-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Artículos</h2><p className="text-sm text-[var(--g66-text-secondary)]">Revisa metadata y visibilidad antes de publicar.</p></div><button type="button" onClick={openNewArticle} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--g66-brand-blue)] px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Crear artículo</button></div><form onSubmit={(event) => { event.preventDefault(); void loadArticles({ q: articleQuery, visibility: visibilityFilter, status: statusFilter }); }} className="grid gap-2 rounded-xl border bg-white p-3 md:grid-cols-[1fr_180px_150px_auto]"><input value={articleQuery} onChange={(event) => setArticleQuery(event.target.value)} placeholder="Buscar título o contenido" className="h-9 rounded-lg border px-3 text-sm" /><select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)} className="h-9 rounded-lg border px-2 text-sm"><option value="">Toda visibilidad</option><option>CUSTOMER_ALLOWED</option><option>AGENT_GUIDANCE</option><option>INTERNAL_ONLY</option></select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-lg border px-2 text-sm"><option value="">Todo estado</option><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select><button className="h-9 rounded-lg border px-3 text-sm font-semibold">Filtrar</button></form>
          {articleDraft ? <ArticleEditor draft={articleDraft} sources={sources} pending={pending === "article"} onChange={setArticleDraft} onCancel={() => setArticleDraft(null)} onSubmit={saveArticle} /> : null}
          <div className="overflow-hidden rounded-xl border bg-white"><div className="divide-y">{articles.map((article) => <article key={article.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{article.title}</h3><StatusBadge tone={article.visibility === "CUSTOMER_ALLOWED" ? "green" : article.visibility === "AGENT_GUIDANCE" ? "amber" : "gray"}>{article.visibility}</StatusBadge><StatusBadge tone={article.versionStatus === "PUBLISHED" ? "green" : "blue"}>{article.versionStatus || "SIN VERSIÓN"}</StatusBadge></div><p className="mt-1 line-clamp-2 text-sm text-[var(--g66-text-secondary)]">{article.content}</p><p className="mt-2 text-xs text-[var(--g66-text-muted)]">{[article.sourceTitle, article.versionLabel, article.product, article.country, article.plan, article.category].filter(Boolean).join(" · ") || "Sin metadata"}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => setArticleDraft({ ...article })} className="h-8 rounded-lg border px-2 text-xs">Editar</button><button type="button" disabled={pending === `article:${article.id}`} onClick={() => toggleArticle(article)} className={`h-8 rounded-lg px-2 text-xs font-semibold ${article.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{article.isActive ? "Activo" : "Inactivo"}</button></div></article>)}</div>{!articles.length ? <p className="p-8 text-center text-sm text-[var(--g66-text-secondary)]">No hay artículos para los filtros seleccionados.</p> : null}</div>
        </section>
      ) : null}

      {tab === "import" ? <section className="grid gap-4 rounded-xl border bg-white p-5"><div><h2 className="text-lg font-semibold">Importar conocimiento</h2><p className="text-sm text-[var(--g66-text-secondary)]">TXT se extrae automáticamente. Para PDF/DOCX, conserva el archivo como referencia y pega el texto en esta primera fase.</p></div><form onSubmit={importText} className="grid gap-3"><div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-semibold">Fuente existente<select value={importDraft.sourceId} onChange={(event) => setImportDraft({ ...importDraft, sourceId: event.target.value })} className="h-9 rounded-lg border px-3 text-sm"><option value="">Crear fuente nueva</option>{sources.filter((source) => source.status === "ACTIVE").map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label><label className="grid gap-1 text-xs font-semibold">Etiqueta de versión<input required value={importDraft.versionLabel} onChange={(event) => setImportDraft({ ...importDraft, versionLabel: event.target.value })} className="h-9 rounded-lg border px-3 text-sm" /></label></div>{!importDraft.sourceId ? <div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-semibold">Título de nueva fuente<input required value={importDraft.title} onChange={(event) => setImportDraft({ ...importDraft, title: event.target.value })} className="h-9 rounded-lg border px-3 text-sm" /></label><label className="grid gap-1 text-xs font-semibold">Descripción<input value={importDraft.description} onChange={(event) => setImportDraft({ ...importDraft, description: event.target.value })} className="h-9 rounded-lg border px-3 text-sm" /></label></div> : null}<label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-[var(--g66-text-secondary)]"><FileUp className="h-5 w-5" /><span>{importDraft.fileName || "Seleccionar PDF, DOCX o TXT"}</span><input type="file" accept=".pdf,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} className="sr-only" /></label><label className="grid gap-1 text-xs font-semibold">Texto a importar<textarea required value={importDraft.rawText} onChange={(event) => setImportDraft({ ...importDraft, rawText: event.target.value })} placeholder="Pega aquí el contenido del documento. Se dividirá por encabezados y se creará como DRAFT." className="min-h-72 rounded-xl border p-3 text-sm leading-6" /></label><div className="flex justify-end"><button disabled={pending === "import"} className="h-10 rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white">{pending === "import" ? "Importando..." : "Crear versión DRAFT"}</button></div></form></section> : null}

      {tab === "search" ? <section className="grid gap-4"><form onSubmit={searchKnowledge} className="flex gap-2 rounded-xl border bg-white p-4"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--g66-text-muted)]" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar en conocimiento publicado" className="h-9 w-full rounded-lg border pl-9 pr-3 text-sm" /></div><button disabled={pending === "search"} className="h-9 rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white">Buscar</button></form><div className="grid gap-3">{searchResults.map((result) => <article key={`${result.articleId}:${result.chunkId}`} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{result.title}</h3><p className="text-xs text-[var(--g66-text-muted)]">{result.source} · {result.version}</p></div><div className="flex gap-2"><StatusBadge tone={result.visibility === "CUSTOMER_ALLOWED" ? "green" : result.visibility === "AGENT_GUIDANCE" ? "amber" : "gray"}>{result.visibility}</StatusBadge><StatusBadge tone="blue">Score {result.score.toFixed(2)}</StatusBadge></div></div><p className="mt-3 text-sm leading-6 text-[var(--g66-text-secondary)]">{result.snippet}</p><p className="mt-2 text-xs text-[var(--g66-text-muted)]">{[result.product, result.country, result.plan, result.category, result.section].filter(Boolean).join(" · ") || "Sin metadata específica"}</p></article>)}{searchQuery && !searchResults.length && pending !== "search" ? <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-[var(--g66-text-secondary)]">No se encontraron resultados publicados.</p> : null}</div></section> : null}
    </div>
  );
}

function ArticleEditor({ draft, sources, pending, onChange, onCancel, onSubmit }: { draft: ArticleDraft; sources: KnowledgeSource[]; pending: boolean; onChange: (draft: ArticleDraft) => void; onCancel: () => void; onSubmit: (event: FormEvent) => void }) {
  const source = sources.find((item) => item.id === draft.sourceId);
  const update = (key: keyof ArticleDraft, value: string | boolean | null) => onChange({ ...draft, [key]: value });
  return <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4"><h3 className="font-semibold">{draft.id ? "Editar artículo" : "Crear artículo"}</h3><div className="grid gap-3 md:grid-cols-3"><label className="grid gap-1 text-xs font-semibold">Fuente<select value={draft.sourceId || ""} onChange={(event) => { const sourceId = event.target.value || null; const nextSource = sources.find((item) => item.id === sourceId); onChange({ ...draft, sourceId, versionId: nextSource?.versions.find((version) => version.status === "DRAFT")?.id || nextSource?.currentVersionId || null }); }} className="h-9 rounded-lg border bg-white px-2 text-sm"><option value="">Sin fuente</option>{sources.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="grid gap-1 text-xs font-semibold">Versión<select value={draft.versionId || ""} onChange={(event) => update("versionId", event.target.value || null)} className="h-9 rounded-lg border bg-white px-2 text-sm"><option value="">Sin versión</option>{source?.versions.map((version) => <option key={version.id} value={version.id}>{version.versionLabel} · {version.status}</option>)}</select></label><label className="grid gap-1 text-xs font-semibold">Visibilidad<select value={draft.visibility} onChange={(event) => update("visibility", event.target.value as KnowledgeVisibility)} className="h-9 rounded-lg border bg-white px-2 text-sm"><option>CUSTOMER_ALLOWED</option><option>AGENT_GUIDANCE</option><option>INTERNAL_ONLY</option></select></label></div><label className="grid gap-1 text-xs font-semibold">Título<input required value={draft.title} onChange={(event) => update("title", event.target.value)} className="h-9 rounded-lg border bg-white px-3 text-sm" /></label><label className="grid gap-1 text-xs font-semibold">Contenido<textarea required value={draft.content} onChange={(event) => update("content", event.target.value)} className="min-h-40 rounded-lg border bg-white p-3 text-sm leading-6" /></label><div className="grid gap-3 md:grid-cols-3">{(["product", "country", "plan", "customerType", "category", "section"] as const).map((field) => <label key={field} className="grid gap-1 text-xs font-semibold">{{ product: "Producto", country: "País", plan: "Plan", customerType: "Tipo cliente", category: "Categoría", section: "Sección" }[field]}<input value={draft[field] || ""} onChange={(event) => update(field, event.target.value || null)} className="h-9 rounded-lg border bg-white px-3 text-sm" /></label>)}</div><div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="h-9 rounded-lg border bg-white px-3 text-sm">Cancelar</button><button disabled={pending} className="h-9 rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white">Guardar artículo</button></div></form>;
}
