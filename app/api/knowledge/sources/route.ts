import {
  archiveKnowledgeSource,
  createKnowledgeSource,
  listKnowledgeSources,
  updateKnowledgeSource,
} from "@/lib/ai-knowledge-admin-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Error administrando fuentes.";
  return Response.json({ error: message }, { status: message.includes("permisos") ? 403 : 400 });
}

export async function GET() {
  try {
    return Response.json({ sources: await listKnowledgeSources() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return Response.json(await createKnowledgeSource(await request.json()), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as { sourceId?: string; action?: string };
    if (!payload.sourceId) throw new Error("Fuente inválida.");
    if (payload.action === "ARCHIVE") await archiveKnowledgeSource(payload.sourceId);
    else if (payload.action === "UPDATE") await updateKnowledgeSource(payload.sourceId, payload);
    else throw new Error("Acción de fuente inválida.");
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
