import { getCurrentAiUser, requireAiAdmin } from "@/lib/ai-current-user";
import { getAiGovernanceSummary, updateUserAiLimit } from "@/lib/ai-usage-control-service";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo administrar Gobierno IA.";
  return Response.json({ ok: false, error: message }, { status: message.includes("permisos") ? 403 : 500 });
}

export async function GET() {
  try {
    const user = await getCurrentAiUser();
    requireAiAdmin(user);
    return Response.json({ ok: true, ...(await getAiGovernanceSummary()) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentAiUser();
    requireAiAdmin(user);
    const body = (await request.json()) as { targetUserId?: string; featureKey?: string; dailyLimit?: number; monthlyLimit?: number; isActive?: boolean; reason?: string };
    if (!body.targetUserId || !body.featureKey) return Response.json({ ok: false, error: "Usuario y funcionalidad son requeridos." }, { status: 400 });
    if (body.dailyLimit != null && (!Number.isInteger(body.dailyLimit) || body.dailyLimit < 0)) return Response.json({ ok: false, error: "El límite diario debe ser un entero mayor o igual a cero." }, { status: 400 });
    if (body.monthlyLimit != null && (!Number.isInteger(body.monthlyLimit) || body.monthlyLimit < 0)) return Response.json({ ok: false, error: "El límite mensual debe ser un entero mayor o igual a cero." }, { status: 400 });
    const limit = await updateUserAiLimit({ targetUserId: body.targetUserId, actorUserId: user.id, featureKey: body.featureKey, dailyLimit: body.dailyLimit, monthlyLimit: body.monthlyLimit, isActive: body.isActive, reason: body.reason });
    return Response.json({ ok: true, limit });
  } catch (error) {
    return errorResponse(error);
  }
}

