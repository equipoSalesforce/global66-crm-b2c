import { publishKnowledgeVersion } from "@/lib/ai-knowledge-admin-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const payload = await request.json().catch(() => ({})) as { rollback?: boolean; notes?: string };
    await publishKnowledgeVersion(id, payload.rollback === true, payload.notes);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo publicar la versión.";
    return Response.json({ error: message }, { status: message.includes("permisos") ? 403 : 400 });
  }
}
