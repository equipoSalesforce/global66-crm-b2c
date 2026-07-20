import { getCurrentAiUser, requireAiAdmin } from "@/lib/ai-current-user";
import { updateUserAiLimitsBatch } from "@/lib/ai-usage-control-service";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type LimitInput = {
  featureKey?: string;
  dailyLimit?: number;
  monthlyLimit?: number;
  temporaryDailyLimit?: number | null;
  temporaryLimitExpiresAt?: string | null;
  isActive?: boolean;
};

export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentAiUser();
    requireAiAdmin(admin);
    const body = (await request.json()) as { userId?: string; limits?: LimitInput[] };
    if (!body.userId || !body.limits?.length) {
      return Response.json({ ok: false, error: "Usuario y límites son requeridos." }, { status: 400 });
    }
    const { data: targetUser, error: userError } = await supabase
      .from("crm_users")
      .select("id")
      .eq("id", body.userId)
      .maybeSingle<{ id: string }>();
    if (userError || !targetUser) {
      return Response.json({ ok: false, error: "Usuario no encontrado." }, { status: 404 });
    }
    const invalid = body.limits.some((limit) =>
      !limit.featureKey ||
      !Number.isInteger(limit.dailyLimit) || (limit.dailyLimit ?? -1) < 0 ||
      !Number.isInteger(limit.monthlyLimit) || (limit.monthlyLimit ?? -1) < 0 ||
      (limit.temporaryDailyLimit != null && (!Number.isInteger(limit.temporaryDailyLimit) || limit.temporaryDailyLimit < 0)) ||
      (limit.temporaryLimitExpiresAt != null && Number.isNaN(Date.parse(limit.temporaryLimitExpiresAt))) ||
      ((limit.temporaryDailyLimit == null) !== (limit.temporaryLimitExpiresAt == null)) ||
      typeof limit.isActive !== "boolean",
    );
    if (invalid) return Response.json({ ok: false, error: "Los límites enviados no son válidos." }, { status: 400 });

    const limits = await updateUserAiLimitsBatch({
      targetUserId: targetUser.id,
      actorUserId: admin.id,
      limits: body.limits.map((limit) => ({
        featureKey: limit.featureKey!,
        dailyLimit: limit.dailyLimit!,
        monthlyLimit: limit.monthlyLimit!,
        temporaryDailyLimit: limit.temporaryDailyLimit ?? null,
        temporaryLimitExpiresAt: limit.temporaryLimitExpiresAt ?? null,
        isActive: limit.isActive!,
      })),
    });
    return Response.json({ ok: true, updated: limits.length, limits });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron guardar los límites.";
    return Response.json({ ok: false, error: message }, { status: message.includes("permisos") ? 403 : 500 });
  }
}
