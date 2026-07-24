import { getCurrentAiUser, requireAiAdmin } from "@/lib/ai-current-user";
import {
  logAiGovernanceError,
  serializeAiGovernanceError,
} from "@/lib/ai-governance-errors";
import { applyBulkAiLimits } from "@/lib/ai-usage-control-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentAiUser();
    requireAiAdmin(user);
    const body = (await request.json()) as { targetUserIds?: string[]; limits?: Array<{ featureKey: string; dailyLimit: number; monthlyLimit: number; isActive?: boolean }>; reason?: string };
    if (!body.targetUserIds?.length || !body.limits?.length) return Response.json({ ok: false, error: "Selecciona usuarios y al menos un límite." }, { status: 400 });
    if (body.limits.some((limit) => !limit.featureKey || !Number.isInteger(limit.dailyLimit) || limit.dailyLimit < 0 || !Number.isInteger(limit.monthlyLimit) || limit.monthlyLimit < 0)) return Response.json({ ok: false, error: "Los límites enviados no son válidos." }, { status: 400 });
    const limits = await applyBulkAiLimits({ targetUserIds: [...new Set(body.targetUserIds)], actorUserId: user.id, limits: body.limits, reason: body.reason });
    return Response.json({ ok: true, updated: limits.length });
  } catch (error) {
    logAiGovernanceError("POST /api/ai/usage/limits/bulk", error);
    const message = serializeAiGovernanceError(error);
    return Response.json({ ok: false, error: message }, { status: message.includes("permisos") ? 403 : 500 });
  }
}
