import "server-only";

import {
  logAiGovernanceError,
  serializeAiGovernanceError,
} from "@/lib/ai-governance-errors";
import type { AiFeature, AiUserLimit } from "@/lib/ai-governance-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type BaseLimit = {
  dailyLimit: number;
  monthlyLimit: number;
  isActive: boolean;
};

// Mirrors the AGENT defaults introduced by the existing AI governance migrations.
const agentDefaultsByFeature: Record<string, BaseLimit> = {
  EMAIL_SUGGESTION: { dailyLimit: 5, monthlyLimit: 150, isActive: true },
  WHATSAPP_SUGGESTION: { dailyLimit: 1, monthlyLimit: 30, isActive: true },
  CASE_SUMMARY: { dailyLimit: 10, monthlyLimit: 300, isActive: true },
  CASE_ANALYSIS: { dailyLimit: 5, monthlyLimit: 150, isActive: true },
  HISTORICAL_CASE_AI_SUMMARY: {
    dailyLimit: 3,
    monthlyLimit: 90,
    isActive: true,
  },
  MACRO_SUGGESTION: { dailyLimit: 3, monthlyLimit: 90, isActive: true },
  RESPONSE_TONE_REWRITE: { dailyLimit: 5, monthlyLimit: 150, isActive: true },
  TICKET_SUGGESTION: { dailyLimit: 5, monthlyLimit: 150, isActive: true },
  AI_DASHBOARD_BUILDER: { dailyLimit: 3, monthlyLimit: 30, isActive: true },
};

function throwProvisioningError(step: string, error: unknown): never {
  logAiGovernanceError(`ensureDefaultAiLimitsForUser:${step}`, error);
  throw new Error(serializeAiGovernanceError(error), { cause: error });
}

function roleDefault(role: string, featureKey: string): BaseLimit | null {
  if (role.trim().toUpperCase() === "ADMIN") {
    return { dailyLimit: 100, monthlyLimit: 3000, isActive: true };
  }

  return agentDefaultsByFeature[featureKey] ?? null;
}

async function getDemoAgentLimits(featureKeys: string[]) {
  if (featureKeys.length === 0) return new Map<string, BaseLimit>();

  const admin = getSupabaseAdmin();
  const { data: demoUser, error: demoUserError } = await admin
    .from("crm_users")
    .select("id")
    .or("name.ilike.%Agente Demo%,email.ilike.%agente.demo%")
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (demoUserError) throwProvisioningError("load_demo_user", demoUserError);
  if (!demoUser) return new Map<string, BaseLimit>();

  const { data, error } = await admin
    .from("ai_user_feature_limits")
    .select("feature_key, daily_limit, monthly_limit, is_active")
    .eq("user_id", demoUser.id)
    .in("feature_key", featureKeys)
    .returns<
      Array<{
        feature_key: string;
        daily_limit: number;
        monthly_limit: number;
        is_active: boolean;
      }>
    >();
  if (error) throwProvisioningError("load_demo_limits", error);

  return new Map(
    (data ?? []).map((limit) => [
      limit.feature_key,
      {
        dailyLimit: limit.daily_limit,
        monthlyLimit: limit.monthly_limit,
        isActive: limit.is_active,
      },
    ]),
  );
}

export async function ensureDefaultAiLimitsForUser(input: {
  userId: string;
  role?: string | null;
  actorUserId?: string | null;
  reason?: string;
}) {
  const admin = getSupabaseAdmin();
  const { data: user, error: userError } = await admin
    .from("crm_users")
    .select("id, role, status")
    .eq("id", input.userId)
    .maybeSingle<{ id: string; role: string; status: string }>();
  if (userError) throwProvisioningError("load_user", userError);
  if (!user) throw new Error("Usuario no encontrado.");
  if (user.status !== "ACTIVE") {
    throw new Error("Sólo se pueden provisionar límites para usuarios activos.");
  }

  const [featuresResult, existingResult] = await Promise.all([
    admin
      .from("ai_features")
      .select("id, feature_key, name, description, channel, is_active")
      .eq("is_active", true)
      .order("feature_key")
      .returns<AiFeature[]>(),
    admin
      .from("ai_user_feature_limits")
      .select("*")
      .eq("user_id", input.userId)
      .returns<AiUserLimit[]>(),
  ]);
  if (featuresResult.error) {
    throwProvisioningError("load_active_features", featuresResult.error);
  }
  if (existingResult.error) {
    throwProvisioningError("load_existing_limits", existingResult.error);
  }

  const features = featuresResult.data ?? [];
  const existing = existingResult.data ?? [];
  const existingKeys = new Set(existing.map((limit) => limit.feature_key));
  const missingFeatures = features.filter(
    (feature) => !existingKeys.has(feature.feature_key),
  );

  if (missingFeatures.length === 0) {
    return {
      createdCount: 0,
      existingCount: existing.length,
      totalActiveFeatures: features.length,
      created: [] as AiUserLimit[],
    };
  }

  const role = user.role || input.role?.trim() || "AGENT";
  const unknownFeatureKeys = missingFeatures
    .filter((feature) => !roleDefault(role, feature.feature_key))
    .map((feature) => feature.feature_key);
  const demoDefaults = await getDemoAgentLimits(unknownFeatureKeys);
  const rows = missingFeatures.map((feature) => {
    const base =
      roleDefault(role, feature.feature_key) ??
      demoDefaults.get(feature.feature_key) ?? {
        dailyLimit: 1,
        monthlyLimit: 30,
        isActive: true,
      };

    return {
      user_id: input.userId,
      feature_key: feature.feature_key,
      daily_limit: base.dailyLimit,
      monthly_limit: base.monthlyLimit,
      is_active: base.isActive,
      updated_at: new Date().toISOString(),
    };
  });

  const { data: created, error: createError } = await admin
    .from("ai_user_feature_limits")
    .upsert(rows, {
      onConflict: "user_id,feature_key",
      ignoreDuplicates: true,
    })
    .select("*")
    .returns<AiUserLimit[]>();
  if (createError) throwProvisioningError("insert_missing_limits", createError);

  const inserted = created ?? [];
  if (inserted.length > 0) {
    const { error: auditError } = await admin
      .from("ai_limit_change_events")
      .insert(
        inserted.map((limit) => ({
          target_user_id: input.userId,
          changed_by_user_id: input.actorUserId ?? null,
          change_type: "AI_LIMITS_PROVISIONED",
          feature_key: limit.feature_key,
          previous_value: null,
          new_value: {
            daily_limit: limit.daily_limit,
            monthly_limit: limit.monthly_limit,
            is_active: limit.is_active,
          },
          reason:
            input.reason ??
            "Provisioning de límites IA base para usuario activo.",
        })),
      );
    if (auditError) {
      // The limits are already persisted at this point. Preserve the successful
      // provisioning result and retain a safe server-side audit diagnostic.
      logAiGovernanceError(
        "ensureDefaultAiLimitsForUser:audit_provisioned_limits",
        auditError,
      );
    }
  }

  return {
    createdCount: inserted.length,
    existingCount: existing.length,
    totalActiveFeatures: features.length,
    created: inserted,
  };
}
