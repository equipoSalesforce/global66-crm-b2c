import {
  listKnowledgeArticles,
  saveKnowledgeArticle,
  setKnowledgeArticleActive,
} from "@/lib/ai-knowledge-admin-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Error administrando artículos.";
  return Response.json({ error: message }, { status: message.includes("permisos") ? 403 : 400 });
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json({
      articles: await listKnowledgeArticles({
        q: params.get("q") || undefined,
        product: params.get("product") || undefined,
        country: params.get("country") || undefined,
        plan: params.get("plan") || undefined,
        category: params.get("category") || undefined,
        visibility: params.get("visibility") || undefined,
        status: params.get("status") || undefined,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return Response.json(await saveKnowledgeArticle(await request.json()), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown> & { articleId?: string; action?: string };
    if (!payload.articleId) throw new Error("Artículo inválido.");
    if (payload.action === "SET_ACTIVE") {
      await setKnowledgeArticleActive(payload.articleId, payload.isActive === true);
      return Response.json({ ok: true });
    }
    return Response.json(await saveKnowledgeArticle(payload, payload.articleId));
  } catch (error) {
    return errorResponse(error);
  }
}
