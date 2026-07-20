import { getCurrentAiUser } from "@/lib/ai-current-user";
import { checkAiUsageLimit } from "@/lib/ai-usage-control-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentAiUser();
    const body = (await request.json()) as { featureKey?: string };
    if (!body.featureKey?.trim()) return Response.json({ ok: false, error: "featureKey es requerido." }, { status: 400 });
    const decision = await checkAiUsageLimit(user.id, body.featureKey.trim());
    return Response.json({ ok: true, decision });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo validar el uso IA." }, { status: 500 });
  }
}

