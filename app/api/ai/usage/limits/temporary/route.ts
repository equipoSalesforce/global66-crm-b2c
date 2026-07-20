import { getCurrentAiUser, requireAiAdmin } from "@/lib/ai-current-user";
import { createTemporaryAiLimit } from "@/lib/ai-usage-control-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentAiUser();
    requireAiAdmin(user);
    const body = (await request.json()) as { targetUserIds?: string[]; featureKey?: string; dailyLimit?: number; expiresAt?: string; reason?: string };
    if (!body.targetUserIds?.length || !body.featureKey || !Number.isInteger(body.dailyLimit) || (body.dailyLimit ?? -1) < 0 || !body.expiresAt || Number.isNaN(Date.parse(body.expiresAt)) || Date.parse(body.expiresAt) <= Date.now()) return Response.json({ ok: false, error: "La excepción temporal enviada no es válida." }, { status: 400 });
    const limits = await createTemporaryAiLimit({ targetUserIds: [...new Set(body.targetUserIds)], actorUserId: user.id, featureKey: body.featureKey, dailyLimit: body.dailyLimit!, expiresAt: body.expiresAt, reason: body.reason });
    return Response.json({ ok: true, updated: limits.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la excepción temporal.";
    return Response.json({ ok: false, error: message }, { status: message.includes("permisos") ? 403 : 500 });
  }
}
