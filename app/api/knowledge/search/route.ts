import { getKnowledgeActor } from "@/lib/ai-knowledge-admin-service";
import { retrieveKnowledge } from "@/lib/ai-knowledge-retrieval-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getKnowledgeActor();
    const params = new URL(request.url).searchParams;
    const query = params.get("q")?.trim() ?? "";
    if (query.length < 2) return Response.json({ error: "Ingresa al menos 2 caracteres." }, { status: 400 });
    const canIncludeInternal = user.role === "ADMIN" || user.role === "SUPERVISOR";
    const results = await retrieveKnowledge({
      query,
      product: params.get("product"),
      country: params.get("country"),
      plan: params.get("plan"),
      category: params.get("category"),
      customerType: params.get("customerType"),
      includeInternal: canIncludeInternal && params.get("includeInternal") === "true",
      limit: 20,
    });
    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo buscar conocimiento." }, { status: 500 });
  }
}
