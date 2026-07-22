import { createKnowledgeFeedback } from "@/lib/ai-knowledge-admin-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await createKnowledgeFeedback(await request.json());
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar el feedback." },
      { status: 400 },
    );
  }
}
