import "server-only";

import { supabase } from "@/lib/supabase";
import type {
  AiFeature,
  AiGovernanceUser,
  AiInteraction,
  AiInteractionStatus,
  AiUsageDecision,
  AiUserLimit,
} from "@/lib/ai-governance-types";

function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfUtcMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function asError(error: unknown, fallback: string) {
  return new Error(error instanceof Error ? error.message : fallback);
}

export async function getAiFeature(featureKey: string) {
  const { data, error } = await supabase
    .from("ai_features")
    .select("id, feature_key, name, description, channel, is_active")
    .eq("feature_key", featureKey)
    .maybeSingle<AiFeature>();
  if (error) throw asError(error, "No se pudo cargar la funcionalidad IA.");
  return data;
}

export async function getUserAiLimit(userId: string, featureKey: string) {
  const { data, error } = await supabase
    .from("ai_user_feature_limits")
    .select("*")
    .eq("user_id", userId)
    .eq("feature_key", featureKey)
    .maybeSingle<AiUserLimit>();
  if (error) throw asError(error, "No se pudo cargar el límite IA.");
  return data;
}

async function getUsage(userId: string, featureKey: string, from: string) {
  const { count, error } = await supabase
    .from("ai_interactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", featureKey)
    .eq("status", "SUCCESS")
    .gte("created_at", from);
  if (error) throw asError(error, "No se pudo calcular el uso IA.");
  return count ?? 0;
}

export function getTodayUsage(userId: string, featureKey: string) {
  return getUsage(userId, featureKey, startOfUtcDay());
}

export function getMonthUsage(userId: string, featureKey: string) {
  return getUsage(userId, featureKey, startOfUtcMonth());
}

export async function checkAiUsageLimit(
  userId: string,
  featureKey: string,
): Promise<AiUsageDecision> {
  const [feature, limit, dailyUsage, monthlyUsage] = await Promise.all([
    getAiFeature(featureKey),
    getUserAiLimit(userId, featureKey),
    getTodayUsage(userId, featureKey),
    getMonthUsage(userId, featureKey),
  ]);
  const temporaryActive = Boolean(
    limit?.temporary_daily_limit != null &&
      limit.temporary_expires_at &&
      new Date(limit.temporary_expires_at).getTime() >= Date.now(),
  );
  const effectiveDailyLimit = temporaryActive
    ? limit?.temporary_daily_limit ?? 0
    : limit?.daily_limit ?? 0;
  const remainingDaily = Math.max(0, effectiveDailyLimit - dailyUsage);
  const remainingMonthly = Math.max(0, (limit?.monthly_limit ?? 0) - monthlyUsage);
  let reason: string | null = null;
  if (!feature || !feature.is_active) reason = "La funcionalidad IA no está activa.";
  else if (!limit) reason = "No existe un límite asignado para esta funcionalidad.";
  else if (!limit.is_active) reason = "La funcionalidad está desactivada para tu usuario.";
  else if (dailyUsage >= effectiveDailyLimit) reason = "Alcanzaste el límite diario de esta funcionalidad.";
  else if (monthlyUsage >= limit.monthly_limit) reason = "Alcanzaste el límite mensual de esta funcionalidad.";

  return {
    allowed: reason === null,
    reason,
    feature,
    limit,
    effectiveDailyLimit,
    dailyUsage,
    monthlyUsage,
    remainingDaily,
    remainingMonthly,
  };
}

export async function registerAiInteraction(input: {
  userId: string;
  featureKey: string;
  status: AiInteractionStatus;
  decision: AiUsageDecision;
  caseId?: string | null;
  caseNumber?: string | null;
  channel?: string | null;
  topic?: string | null;
  tokensUsed?: number | null;
  model?: string | null;
  requestMetadata?: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  const successIncrement = input.status === "SUCCESS" ? 1 : 0;
  const { data, error } = await supabase
    .from("ai_interactions")
    .insert({
      user_id: input.userId,
      feature_key: input.featureKey,
      case_id: input.caseId ?? null,
      case_number: input.caseNumber ?? null,
      channel: input.channel ?? input.decision.feature?.channel ?? null,
      topic: input.topic ?? null,
      tokens_used: input.tokensUsed ?? null,
      model: input.model ?? null,
      status: input.status,
      daily_limit: input.decision.effectiveDailyLimit,
      daily_usage_before: input.decision.dailyUsage,
      daily_usage_after: input.decision.dailyUsage + successIncrement,
      monthly_limit: input.decision.limit?.monthly_limit ?? 0,
      monthly_usage_before: input.decision.monthlyUsage,
      monthly_usage_after: input.decision.monthlyUsage + successIncrement,
      remaining_daily: Math.max(0, input.decision.remainingDaily - successIncrement),
      remaining_monthly: Math.max(0, input.decision.remainingMonthly - successIncrement),
      request_metadata: input.requestMetadata ?? {},
      error_message: input.errorMessage ?? null,
    })
    .select("*")
    .single<AiInteraction>();
  if (error) throw asError(error, "No se pudo registrar la interacción IA.");
  return data;
}

export async function getUserAiLimits(userId: string) {
  const { data, error } = await supabase
    .from("ai_user_feature_limits")
    .select("*")
    .eq("user_id", userId)
    .order("feature_key")
    .returns<AiUserLimit[]>();
  if (error) throw asError(error, "No se pudieron cargar los límites IA.");
  return data ?? [];
}

export async function getAiUsageProfile(userId: string, filters: {
  featureKey?: string;
  status?: string;
  topic?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 10));
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("ai_interactions")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (filters.featureKey) query = query.eq("feature_key", filters.featureKey);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.topic) query = query.eq("topic", filters.topic);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);
  if (filters.search) {
    const escaped = filters.search.replace(/[%_,]/g, "");
    query = query.or(`case_number.ilike.%${escaped}%,topic.ilike.%${escaped}%`);
  }
  const { data, error, count } = await query.range(from, from + pageSize - 1).returns<AiInteraction[]>();
  if (error) throw asError(error, "No se pudieron cargar las interacciones IA.");

  const [featuresResult, limits, todayRows, monthRows] = await Promise.all([
    supabase.from("ai_features").select("id, feature_key, name, description, channel, is_active").eq("is_active", true).order("name").returns<AiFeature[]>(),
    getUserAiLimits(userId),
    supabase.from("ai_interactions").select("feature_key, topic, status, created_at").eq("user_id", userId).gte("created_at", startOfUtcDay()),
    supabase.from("ai_interactions").select("feature_key, topic, status, created_at").eq("user_id", userId).gte("created_at", startOfUtcMonth()),
  ]);
  if (featuresResult.error || todayRows.error || monthRows.error) {
    throw new Error("No se pudo calcular el perfil de uso IA.");
  }
  const todaySuccess = (todayRows.data ?? []).filter((row) => row.status === "SUCCESS");
  const monthSuccess = (monthRows.data ?? []).filter((row) => row.status === "SUCCESS");
  const featureUsage = (featuresResult.data ?? []).map((feature) => {
    const limit = limits.find((item) => item.feature_key === feature.feature_key) ?? null;
    const temporaryActive = Boolean(limit?.temporary_daily_limit != null && limit.temporary_expires_at && new Date(limit.temporary_expires_at).getTime() >= Date.now());
    const effectiveDailyLimit = temporaryActive ? limit?.temporary_daily_limit ?? 0 : limit?.daily_limit ?? 0;
    const usedToday = todaySuccess.filter((item) => item.feature_key === feature.feature_key).length;
    const usedMonth = monthSuccess.filter((item) => item.feature_key === feature.feature_key).length;
    return { feature, limit, effectiveDailyLimit, usedToday, usedMonth, remainingToday: Math.max(0, effectiveDailyLimit - usedToday), temporaryActive };
  });
  const topicCounts = new Map<string, number>();
  monthSuccess.forEach((row) => { if (row.topic) topicCounts.set(row.topic, (topicCounts.get(row.topic) ?? 0) + 1); });
  const topics = [...topicCounts.entries()].map(([topic, uses]) => ({ topic, uses })).sort((a, b) => b.uses - a.uses).slice(0, 5);
  const totalDailyLimit = featureUsage.reduce((sum, item) => sum + item.effectiveDailyLimit, 0);
  const totalMonthlyLimit = featureUsage.reduce((sum, item) => sum + (item.limit?.monthly_limit ?? 0), 0);
  const mostUsed = featureUsage.slice().sort((a, b) => b.usedMonth - a.usedMonth)[0] ?? null;

  return {
    metrics: { usedToday: todaySuccess.length, usedMonth: monthSuccess.length, totalDailyLimit, totalMonthlyLimit, remainingToday: Math.max(0, totalDailyLimit - todaySuccess.length), mostUsed },
    featureUsage,
    topics,
    interactions: data ?? [],
    pagination: { page, pageSize, total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)) },
  };
}

export async function getAiGovernanceSummary() {
  const [usersResult, featuresResult, limitsResult, todayResult, eventsResult] = await Promise.all([
    supabase.from("crm_users").select("id, name, email, role, area, team, status").order("name").returns<AiGovernanceUser[]>(),
    supabase.from("ai_features").select("id, feature_key, name, description, channel, is_active").order("name").returns<AiFeature[]>(),
    supabase.from("ai_user_feature_limits").select("*").returns<AiUserLimit[]>(),
    supabase.from("ai_interactions").select("user_id, feature_key, status, created_at").gte("created_at", startOfUtcDay()),
    supabase.from("ai_limit_change_events").select("*, target:crm_users!ai_limit_change_events_target_user_id_fkey(name, email), changer:crm_users!ai_limit_change_events_changed_by_user_id_fkey(name, email)").order("created_at", { ascending: false }).limit(100),
  ]);
  if (usersResult.error || featuresResult.error || limitsResult.error || todayResult.error || eventsResult.error) throw new Error("No se pudo cargar Gobierno IA.");
  const successful = (todayResult.data ?? []).filter((row) => row.status === "SUCCESS");
  const blockedUsers = new Set((todayResult.data ?? []).filter((row) => row.status === "BLOCKED_LIMIT").map((row) => row.user_id));
  return {
    users: usersResult.data ?? [], features: featuresResult.data ?? [], limits: limitsResult.data ?? [], interactionsToday: todayResult.data ?? [], history: eventsResult.data ?? [],
    summary: { activeUsers: (usersResult.data ?? []).filter((user) => user.status === "ACTIVE").length, usesToday: successful.length, usersAtLimit: blockedUsers.size, activeLimits: (limitsResult.data ?? []).filter((limit) => limit.is_active).length },
  };
}

async function auditLimitChange(input: { targetUserId: string; actorUserId: string; changeType: string; featureKey?: string | null; previousValue?: unknown; newValue?: unknown; reason?: string | null }) {
  const { error } = await supabase.from("ai_limit_change_events").insert({ target_user_id: input.targetUserId, changed_by_user_id: input.actorUserId, change_type: input.changeType, feature_key: input.featureKey ?? null, previous_value: input.previousValue ?? null, new_value: input.newValue ?? null, reason: input.reason ?? null });
  if (error) throw asError(error, "No se pudo auditar el cambio IA.");
}

export async function updateUserAiLimit(input: { targetUserId: string; actorUserId: string; featureKey: string; dailyLimit?: number; monthlyLimit?: number; isActive?: boolean; reason?: string | null }) {
  const previous = await getUserAiLimit(input.targetUserId, input.featureKey);
  if (!previous) throw new Error("El usuario no tiene un límite configurado para esta funcionalidad.");
  const update = { daily_limit: input.dailyLimit ?? previous.daily_limit, monthly_limit: input.monthlyLimit ?? previous.monthly_limit, is_active: input.isActive ?? previous.is_active, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("ai_user_feature_limits").update(update).eq("id", previous.id).select("*").single<AiUserLimit>();
  if (error) throw asError(error, "No se pudo actualizar el límite IA.");
  await auditLimitChange({ targetUserId: input.targetUserId, actorUserId: input.actorUserId, changeType: "LIMIT_UPDATED", featureKey: input.featureKey, previousValue: previous, newValue: data, reason: input.reason });
  return data;
}

export async function updateUserAiLimitsBatch(input: {
  targetUserId: string;
  actorUserId: string;
  limits: Array<{
    featureKey: string;
    dailyLimit: number;
    monthlyLimit: number;
    temporaryDailyLimit: number | null;
    temporaryLimitExpiresAt: string | null;
    isActive: boolean;
  }>;
}) {
  const featuresResult = await supabase
    .from("ai_features")
    .select("feature_key")
    .in("feature_key", input.limits.map((limit) => limit.featureKey));
  if (featuresResult.error) throw asError(featuresResult.error, "No se pudieron validar las funcionalidades IA.");
  const validFeatures = new Set((featuresResult.data ?? []).map((feature) => feature.feature_key));
  if (validFeatures.size !== new Set(input.limits.map((limit) => limit.featureKey)).size) {
    throw new Error("Una o más funcionalidades IA no son válidas.");
  }

  const currentLimits = await getUserAiLimits(input.targetUserId);
  const changed = input.limits.filter((next) => {
    const current = currentLimits.find((limit) => limit.feature_key === next.featureKey);
    return !current ||
      current.daily_limit !== next.dailyLimit ||
      current.monthly_limit !== next.monthlyLimit ||
      current.temporary_daily_limit !== next.temporaryDailyLimit ||
      current.temporary_expires_at !== next.temporaryLimitExpiresAt ||
      current.is_active !== next.isActive;
  });

  const saved: AiUserLimit[] = [];
  for (const next of changed) {
    const previous = currentLimits.find((limit) => limit.feature_key === next.featureKey) ?? null;
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("ai_user_feature_limits")
      .upsert(
        {
          user_id: input.targetUserId,
          feature_key: next.featureKey,
          daily_limit: next.dailyLimit,
          monthly_limit: next.monthlyLimit,
          temporary_daily_limit: next.temporaryDailyLimit,
          temporary_expires_at: next.temporaryLimitExpiresAt,
          temporary_reason: next.temporaryDailyLimit == null ? null : previous?.temporary_reason ?? "Edición administrativa",
          is_active: next.isActive,
          updated_at: now,
        },
        { onConflict: "user_id,feature_key" },
      )
      .select("*")
      .single<AiUserLimit>();
    if (error) throw asError(error, "No se pudieron guardar los límites del usuario.");
    await auditLimitChange({
      targetUserId: input.targetUserId,
      actorUserId: input.actorUserId,
      changeType: "USER_LIMITS_SAVED",
      featureKey: next.featureKey,
      previousValue: previous,
      newValue: data,
      reason: "Guardado explícito desde Gestión por usuario",
    });
    saved.push(data);
  }
  return saved;
}

export async function applyBulkAiLimits(input: { targetUserIds: string[]; actorUserId: string; limits: Array<{ featureKey: string; dailyLimit: number; monthlyLimit: number; isActive?: boolean }>; reason?: string | null }) {
  const results = [];
  for (const targetUserId of input.targetUserIds) {
    for (const limit of input.limits) results.push(await updateUserAiLimit({ targetUserId, actorUserId: input.actorUserId, featureKey: limit.featureKey, dailyLimit: limit.dailyLimit, monthlyLimit: limit.monthlyLimit, isActive: limit.isActive, reason: input.reason }));
  }
  return results;
}

export async function createTemporaryAiLimit(input: { targetUserIds: string[]; actorUserId: string; featureKey: string; dailyLimit: number; expiresAt: string; reason?: string | null }) {
  const results = [];
  for (const targetUserId of input.targetUserIds) {
    const previous = await getUserAiLimit(targetUserId, input.featureKey);
    if (!previous) throw new Error("El usuario no tiene un límite base configurado.");
    const { data, error } = await supabase.from("ai_user_feature_limits").update({ temporary_daily_limit: input.dailyLimit, temporary_expires_at: input.expiresAt, temporary_reason: input.reason ?? null, updated_at: new Date().toISOString() }).eq("id", previous.id).select("*").single<AiUserLimit>();
    if (error) throw asError(error, "No se pudo crear la excepción temporal.");
    await auditLimitChange({ targetUserId, actorUserId: input.actorUserId, changeType: "TEMPORARY_LIMIT_CREATED", featureKey: input.featureKey, previousValue: previous, newValue: data, reason: input.reason });
    results.push(data);
  }
  return results;
}
