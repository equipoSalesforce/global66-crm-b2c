import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoUser } from "./demo-users";
import type {
  CaseSavedView,
  CaseSavedViewFilters,
} from "./case-views-storage-service";
import {
  normalizeCaseViewColumns,
  type CaseViewColumnKey,
  type CaseViewSorting,
} from "./case-view-service";

type CaseViewRow = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  owner_name: string | null;
  privacy: "PRIVATE" | "TEAM" | "PUBLIC";
  team_id: string | null;
  is_editable_by_others: boolean;
  visible_fields: CaseViewColumnKey[] | null;
  filters: Partial<CaseSavedViewFilters> | null;
  sort_config: { sorting?: CaseViewSorting } | null;
  created_at: string;
  updated_at: string;
};

type PreferenceRow = {
  default_case_view_id: string | null;
};

export type CaseViewPayload = {
  name?: string;
  description?: string;
  privacy?: CaseSavedView["privacy"];
  editableByOthers?: CaseSavedView["editableByOthers"];
  visibleColumns?: CaseViewColumnKey[];
  filters?: CaseSavedViewFilters;
  sorting?: CaseViewSorting;
  useAsDefault?: boolean;
};

const privacyToDb: Record<CaseSavedView["privacy"], CaseViewRow["privacy"]> = {
  Privada: "PRIVATE",
  Equipo: "TEAM",
  Pública: "PUBLIC",
};

const privacyFromDb: Record<CaseViewRow["privacy"], CaseSavedView["privacy"]> = {
  PRIVATE: "Privada",
  TEAM: "Equipo",
  PUBLIC: "Pública",
};

function canViewCaseView(view: Pick<CaseViewRow, "owner_user_id" | "privacy" | "team_id">, user: DemoUser) {
  if (view.owner_user_id === user.id) return true;
  if (view.privacy === "PUBLIC") return true;
  if (view.privacy === "TEAM" && view.team_id && view.team_id === user.teamId) {
    return true;
  }

  return false;
}

export function canEditCaseView(
  view: Pick<
    CaseViewRow,
    "owner_user_id" | "privacy" | "team_id" | "is_editable_by_others"
  >,
  user: DemoUser,
) {
  if (view.owner_user_id === user.id) return true;
  if (user.isAdmin) return true;

  return view.is_editable_by_others && canViewCaseView(view, user);
}

function normalizeFilters(filters: Partial<CaseSavedViewFilters> | null | undefined) {
  return {
    channel: filters?.channel ?? "",
    contactType: filters?.contactType ?? "",
    product: filters?.product ?? "",
    subproduct: filters?.subproduct ?? "",
    catPrincipal: filters?.catPrincipal ?? "",
    catSecondary: filters?.catSecondary ?? "",
    catExtra: filters?.catExtra ?? "",
    status: filters?.status ?? "",
  };
}

function toCaseSavedView(
  row: CaseViewRow,
  user: DemoUser,
  defaultViewId: string | null,
): CaseSavedView {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    privacy: privacyFromDb[row.privacy],
    editableByOthers: row.is_editable_by_others ? "Sí" : "No",
    visibleColumns: normalizeCaseViewColumns(row.visible_fields),
    filters: normalizeFilters(row.filters),
    sorting: row.sort_config?.sorting ?? "updated_desc",
    useAsDefault: row.id === defaultViewId,
    canEdit: canEditCaseView(row, user),
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name ?? "Usuario demo",
    teamId: row.team_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getDefaultViewId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("case_view_user_preferences")
    .select("default_case_view_id")
    .eq("user_id", userId)
    .maybeSingle<PreferenceRow>();

  if (error) throw error;

  return data?.default_case_view_id ?? null;
}

async function setDefaultView(
  supabase: SupabaseClient,
  user: DemoUser,
  viewId: string | null,
) {
  const { error } = await supabase.from("case_view_user_preferences").upsert({
    user_id: user.id,
    default_case_view_id: viewId,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

async function auditCaseView(
  supabase: SupabaseClient,
  user: DemoUser,
  eventType: string,
  viewId: string | null,
  description: string,
  metadata?: Record<string, unknown>,
) {
  const { error } = await supabase.from("case_view_audit_events").insert({
    case_view_id: viewId,
    actor_user_id: user.id,
    actor_name: user.name,
    event_type: eventType,
    description,
    metadata: metadata ?? null,
  });

  if (error) throw error;
}

export async function listCaseViews(supabase: SupabaseClient, user: DemoUser) {
  const [{ data, error }, defaultViewId] = await Promise.all([
    supabase
      .from("case_views")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .returns<CaseViewRow[]>(),
    getDefaultViewId(supabase, user.id),
  ]);

  if (error) throw error;

  return (data ?? [])
    .filter((view) => canViewCaseView(view, user))
    .map((view) => toCaseSavedView(view, user, defaultViewId));
}

export async function createCaseViewForUser(
  supabase: SupabaseClient,
  user: DemoUser,
  payload: CaseViewPayload,
) {
  const privacy = privacyToDb[payload.privacy ?? "Privada"];
  const { data, error } = await supabase
    .from("case_views")
    .insert({
      name: payload.name?.trim() || "Vista sin nombre",
      description: payload.description ?? "",
      owner_user_id: user.id,
      owner_name: user.name,
      privacy,
      team_id: privacy === "TEAM" ? user.teamId : user.teamId,
      is_editable_by_others: payload.editableByOthers === "Sí",
      visible_fields: normalizeCaseViewColumns(payload.visibleColumns),
      filters: payload.filters ?? {},
      sort_config: { sorting: payload.sorting ?? "updated_desc" },
    })
    .select("*")
    .single<CaseViewRow>();

  if (error) throw error;

  if (payload.useAsDefault) {
    await setDefaultView(supabase, user, data.id);
  }

  await auditCaseView(supabase, user, "CASE_VIEW_CREATED", data.id, "Vista de casos creada", {
    privacy,
  });

  return toCaseSavedView(data, user, payload.useAsDefault ? data.id : null);
}

export async function getCaseViewForEdit(
  supabase: SupabaseClient,
  user: DemoUser,
  id: string,
) {
  const { data, error } = await supabase
    .from("case_views")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<CaseViewRow>();

  if (error) throw error;
  if (!data || !canViewCaseView(data, user)) return null;

  return data;
}

export async function updateCaseViewForUser(
  supabase: SupabaseClient,
  user: DemoUser,
  id: string,
  payload: CaseViewPayload,
) {
  const view = await getCaseViewForEdit(supabase, user, id);

  if (!view) {
    return { status: 404 as const, error: "Vista no encontrada." };
  }

  if (!canEditCaseView(view, user)) {
    return { status: 403 as const, error: "No puedes modificar esta vista." };
  }

  const updatePayload: Record<string, unknown> = {};

  if (payload.name !== undefined) updatePayload.name = payload.name.trim() || "Vista sin nombre";
  if (payload.description !== undefined) updatePayload.description = payload.description;
  if (payload.privacy !== undefined) updatePayload.privacy = privacyToDb[payload.privacy];
  if (payload.privacy !== undefined) updatePayload.team_id = user.teamId;
  if (payload.editableByOthers !== undefined) {
    updatePayload.is_editable_by_others = payload.editableByOthers === "Sí";
  }
  if (payload.visibleColumns !== undefined) {
    updatePayload.visible_fields = normalizeCaseViewColumns(payload.visibleColumns);
  }
  if (payload.filters !== undefined) updatePayload.filters = payload.filters;
  if (payload.sorting !== undefined) updatePayload.sort_config = { sorting: payload.sorting };

  const { data, error } = await supabase
    .from("case_views")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single<CaseViewRow>();

  if (error) throw error;

  if (payload.useAsDefault !== undefined) {
    await setDefaultView(supabase, user, payload.useAsDefault ? id : null);
  }

  const defaultViewId = payload.useAsDefault ? id : await getDefaultViewId(supabase, user.id);

  await auditCaseView(supabase, user, "CASE_VIEW_UPDATED", id, "Vista de casos actualizada", {
    editableByOthers: data.is_editable_by_others,
    privacy: data.privacy,
  });

  return { status: 200 as const, view: toCaseSavedView(data, user, defaultViewId) };
}

export async function deleteCaseViewForUser(
  supabase: SupabaseClient,
  user: DemoUser,
  id: string,
) {
  const view = await getCaseViewForEdit(supabase, user, id);

  if (!view) {
    return { status: 404 as const, error: "Vista no encontrada." };
  }

  if (!canEditCaseView(view, user)) {
    return { status: 403 as const, error: "No puedes eliminar esta vista." };
  }

  const { error } = await supabase
    .from("case_views")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;

  await auditCaseView(supabase, user, "CASE_VIEW_DELETED", id, "Vista de casos eliminada");

  return { status: 200 as const };
}
