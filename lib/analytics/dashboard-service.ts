import "server-only";

import { supabase } from "@/lib/supabase";
import { resolveDashboardWidgets } from "@/lib/analytics/dashboard-query-service";
import { validateDashboardDefinition, type SafeDashboardDefinition } from "@/lib/analytics/semantic-layer";
import type { AiGovernanceUser } from "@/lib/ai-governance-types";

export type DashboardVisibility = "PRIVATE" | "TEAM" | "PUBLIC";
export type DashboardRecord = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  owner_user_name: string | null;
  visibility: DashboardVisibility;
  source: string;
  prompt: string | null;
  definition: SafeDashboardDefinition;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function canAccess(record: DashboardRecord, user: AiGovernanceUser) {
  return user.role === "ADMIN" || record.owner_user_id === user.id || record.visibility !== "PRIVATE";
}

function dashboardPermissions(record: DashboardRecord, user: AiGovernanceUser) {
  const canManage = user.role === "ADMIN" || record.owner_user_id === user.id;
  return { canEdit: canManage, canDelete: canManage, canChangeVisibility: user.role === "ADMIN" };
}

export async function listVisibleDashboards(user: AiGovernanceUser) {
  let query = supabase
    .from("dashboard_definitions")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (user.role !== "ADMIN") {
    query = query.or(`owner_user_id.eq.${user.id},visibility.in.(TEAM,PUBLIC)`);
  }
  const { data, error } = await query.returns<DashboardRecord[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((record) => ({
    ...record,
    definition: validateDashboardDefinition(record.definition),
    permissions: dashboardPermissions(record, user),
  }));
}

export async function createDashboard(input: {
  user: AiGovernanceUser;
  definition: unknown;
  prompt?: string | null;
  visibility?: DashboardVisibility;
}) {
  const definition = validateDashboardDefinition(input.definition);
  const visibility = input.user.role === "ADMIN" ? input.visibility ?? "PRIVATE" : "PRIVATE";
  if (!["PRIVATE", "TEAM", "PUBLIC"].includes(visibility)) throw new Error("Visibilidad no válida.");
  const { data, error } = await supabase
    .from("dashboard_definitions")
    .insert({
      name: definition.title,
      description: definition.description,
      owner_user_id: input.user.id,
      owner_user_name: input.user.name,
      visibility,
      source: "AI_DASHBOARD_BUILDER",
      prompt: input.prompt?.trim() || null,
      definition,
    })
    .select("*")
    .single<DashboardRecord>();
  if (error) throw new Error(error.message);
  return { ...data, definition };
}

export async function getDashboardWithData(id: string, user: AiGovernanceUser) {
  const { data, error } = await supabase
    .from("dashboard_definitions")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle<DashboardRecord>();
  if (error) throw new Error(error.message);
  if (!data || !canAccess(data, user)) return null;
  const resolved = await resolveDashboardWidgets(data.definition);
  return {
    dashboard: { ...data, definition: resolved.definition },
    data: resolved.widgets,
    resolvedAt: resolved.resolvedAt,
    permissions: dashboardPermissions(data, user),
  };
}

export async function updateDashboard(input: {
  id: string;
  user: AiGovernanceUser;
  definition: unknown;
  visibility?: DashboardVisibility;
}) {
  const { data: existing, error: findError } = await supabase
    .from("dashboard_definitions")
    .select("*")
    .eq("id", input.id)
    .eq("is_active", true)
    .maybeSingle<DashboardRecord>();
  if (findError) throw new Error(findError.message);
  if (!existing) return null;
  if (existing.owner_user_id !== input.user.id && input.user.role !== "ADMIN") {
    throw new Error("No tienes permiso para editar este dashboard.");
  }
  const definition = validateDashboardDefinition(input.definition);
  const visibility = input.user.role === "ADMIN" ? input.visibility ?? existing.visibility : "PRIVATE";
  if (!["PRIVATE", "TEAM", "PUBLIC"].includes(visibility)) throw new Error("Visibilidad no válida.");
  const { data, error } = await supabase
    .from("dashboard_definitions")
    .update({
      name: definition.title,
      description: definition.description,
      definition,
      visibility,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("*")
    .single<DashboardRecord>();
  if (error) throw new Error(error.message);
  return { ...data, definition };
}

export async function deleteDashboard(id: string, user: AiGovernanceUser) {
  const { data: existing, error: findError } = await supabase
    .from("dashboard_definitions")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle<DashboardRecord>();
  if (findError) throw new Error(findError.message);
  if (!existing) return false;
  if (existing.owner_user_id !== user.id && user.role !== "ADMIN") {
    throw new Error("No tienes permiso para eliminar este dashboard.");
  }
  const { error } = await supabase
    .from("dashboard_definitions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}
