import { importKnowledgeText } from "@/lib/ai-knowledge-admin-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return Response.json(await importKnowledgeText(await request.json()), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo importar el conocimiento.";
    return Response.json({ error: message }, { status: message.includes("permisos") ? 403 : 400 });
  }
}
