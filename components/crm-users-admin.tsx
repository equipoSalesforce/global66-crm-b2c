"use client";

import {
  crmUserRoles,
  crmUserStatuses,
  type CrmUser,
  type CrmUserRole,
  type CrmUserStatus,
} from "@/lib/crm-users";
import { hasPermission } from "@/lib/permissions";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "./toast-provider";
import { useCrmPermissions } from "./use-crm-permissions";
import { useDemoRole } from "./use-demo-role";

type UserDraft = {
  id?: string;
  name: string;
  email: string;
  role: CrmUserRole;
  area: string;
  team: string;
  status: CrmUserStatus;
  aircall_user_id: string;
  aircall_email: string;
  aircall_name: string;
  default_aircall_number_id: string;
  default_aircall_number: string;
  aircall_is_active: boolean;
};

const emptyDraft: UserDraft = {
  name: "",
  email: "",
  role: "AGENT",
  area: "",
  team: "",
  status: "ACTIVE",
  aircall_user_id: "",
  aircall_email: "",
  aircall_name: "",
  default_aircall_number_id: "",
  default_aircall_number: "",
  aircall_is_active: true,
};

export type CrmAircallUserMapping = {
  id: string;
  crm_user_id: string;
  aircall_user_id: string;
  aircall_email: string | null;
  aircall_name: string | null;
  default_aircall_number_id: string | null;
  default_aircall_number: string | null;
  is_active: boolean;
};

function formatDateTime(value: string | null) {
  if (!value) return "Sin acceso";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin acceso";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function roleBadgeClass(role: CrmUserRole) {
  if (role === "ADMIN") {
    return "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]";
  }

  if (role === "SUPERVISOR") {
    return "bg-[var(--g66-warning-soft)] text-[#B77900]";
  }

  return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
}

function statusBadgeClass(status: CrmUserStatus) {
  return status === "ACTIVE"
    ? "bg-[var(--g66-success-soft)] text-[var(--g66-success)]"
    : "bg-[var(--g66-background-soft)] text-[var(--g66-text-secondary)]";
}

function normalizeDraft(
  user: CrmUser,
  mapping?: CrmAircallUserMapping,
): UserDraft {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    area: user.area ?? "",
    team: user.team ?? "",
    status: user.status,
    aircall_user_id: mapping?.aircall_user_id ?? "",
    aircall_email: mapping?.aircall_email ?? "",
    aircall_name: mapping?.aircall_name ?? "",
    default_aircall_number_id: mapping?.default_aircall_number_id ?? "",
    default_aircall_number: mapping?.default_aircall_number ?? "",
    aircall_is_active: mapping?.is_active ?? true,
  };
}

export function CrmUsersAdmin({
  initialUsers,
  initialAircallMappings = [],
}: {
  initialUsers: CrmUser[];
  initialAircallMappings?: CrmAircallUserMapping[];
}) {
  const toast = useToast();
  const { role } = useDemoRole();
  const { permissions: rolePermissions } = useCrmPermissions();
  const canManageAircallSettings = hasPermission(
    role,
    "manage_aircall_settings",
    rolePermissions,
  );
  const [users, setUsers] = useState(initialUsers);
  const [aircallMappings, setAircallMappings] = useState(initialAircallMappings);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areas = useMemo(
    () =>
      Array.from(
        new Set(users.map((user) => user.area).filter((area): area is string => Boolean(area))),
      ).sort(),
    [users],
  );

  const filteredUsers = users.filter((user) => {
    if (roleFilter && user.role !== roleFilter) return false;
    if (statusFilter && user.status !== statusFilter) return false;
    if (areaFilter && user.area !== areaFilter) return false;

    const searchableText = [user.name, user.email, user.role, user.area, user.team]
      .join(" ")
      .toLowerCase();

    return !query || searchableText.includes(query.toLowerCase());
  });

  function openCreateModal() {
    setDraft(emptyDraft);
    setError(null);
    setIsModalOpen(true);
  }

  function openEditModal(user: CrmUser) {
    setDraft(
      normalizeDraft(
        user,
        aircallMappings.find((mapping) => mapping.crm_user_id === user.id),
      ),
    );
    setError(null);
    setIsModalOpen(true);
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const payload = {
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      role: draft.role,
      area: draft.area.trim() || null,
      team: draft.team.trim() || null,
      status: draft.status,
      updated_at: new Date().toISOString(),
    };

    if (!payload.name || !payload.email) {
      setError("Nombre y email son obligatorios.");
      setIsSaving(false);
      return;
    }

    const result = draft.id
      ? await supabaseBrowser
          .from("crm_users")
          .update({
            name: payload.name,
            role: payload.role,
            area: payload.area,
            team: payload.team,
            status: payload.status,
            updated_at: payload.updated_at,
          })
          .eq("id", draft.id)
          .select("*")
          .single<CrmUser>()
      : await supabaseBrowser
          .from("crm_users")
          .insert(payload)
          .select("*")
          .single<CrmUser>();

    setIsSaving(false);

    if (result.error) {
      console.error("[crm-users] Error saving user", {
        message: result.error.message,
        error: result.error,
      });
      setError(result.error.message);
      toast.error("No se pudo guardar el usuario");
      return;
    }

    const savedUser = result.data;

    if (canManageAircallSettings && draft.aircall_user_id.trim()) {
      const mappingPayload = {
        crm_user_id: savedUser.id,
        aircall_user_id: draft.aircall_user_id.trim(),
        aircall_email: draft.aircall_email.trim() || null,
        aircall_name: draft.aircall_name.trim() || null,
        default_aircall_number_id: draft.default_aircall_number_id.trim() || null,
        default_aircall_number: draft.default_aircall_number.trim() || null,
        is_active: draft.aircall_is_active,
        updated_at: new Date().toISOString(),
      };
      const { data: savedMapping, error: mappingError } = await supabaseBrowser
        .from("crm_aircall_users")
        .upsert(mappingPayload, { onConflict: "crm_user_id" })
        .select(
          "id, crm_user_id, aircall_user_id, aircall_email, aircall_name, default_aircall_number_id, default_aircall_number, is_active",
        )
        .single<CrmAircallUserMapping>();

      if (mappingError) {
        console.error("[crm-users] Error saving Aircall mapping", mappingError);
        toast.error("Usuario guardado, pero no se pudo guardar el mapeo Aircall");
      } else if (savedMapping) {
        setAircallMappings((currentMappings) => {
          const exists = currentMappings.some(
            (mapping) => mapping.crm_user_id === savedMapping.crm_user_id,
          );

          return exists
            ? currentMappings.map((mapping) =>
                mapping.crm_user_id === savedMapping.crm_user_id
                  ? savedMapping
                  : mapping,
              )
            : [savedMapping, ...currentMappings];
        });
      }
    }

    setUsers((currentUsers) =>
      draft.id
        ? currentUsers.map((user) => (user.id === savedUser.id ? savedUser : user))
        : [savedUser, ...currentUsers],
    );
    setIsModalOpen(false);
    toast.success(draft.id ? "Usuario actualizado" : "Usuario creado");
  }

  async function toggleUserStatus(user: CrmUser) {
    const nextStatus: CrmUserStatus =
      user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const { data, error: updateError } = await supabaseBrowser
      .from("crm_users")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("*")
      .single<CrmUser>();

    if (updateError) {
      console.error("[crm-users] Error toggling user status", {
        message: updateError.message,
        error: updateError,
      });
      toast.error("No se pudo actualizar el estado");
      return;
    }

    setUsers((currentUsers) =>
      currentUsers.map((currentUser) =>
        currentUser.id === user.id ? data : currentUser,
      ),
    );
    toast.success(nextStatus === "ACTIVE" ? "Usuario activado" : "Usuario desactivado");
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[var(--g66-radius-xl)] border border-[var(--g66-border)] bg-white p-6 shadow-[var(--g66-shadow-card)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--g66-brand-blue)]">
              Configuración
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--g66-text-primary)]">
              Usuarios
            </h1>
            <p className="mt-2 text-sm font-medium text-[var(--g66-text-secondary)]">
              Administración de usuarios internos del CRM.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-5 text-sm font-bold text-white shadow-[0_14px_28px_rgb(var(--crm-primary-rgb)/0.2)] transition hover:bg-[var(--g66-brand-blue-hover)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo usuario
          </button>
        </div>
      </section>

      <section className="rounded-[var(--g66-radius-xl)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-72 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--g66-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o email"
              className="h-10 w-full rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white py-0 pl-9 pr-3 text-sm font-semibold outline-none placeholder:text-[var(--g66-text-muted)] focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
            />
          </label>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="h-10 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
          >
            <option value="">Rol</option>
            {crmUserRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
          >
            <option value="">Estado</option>
            {crmUserStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={areaFilter}
            onChange={(event) => setAreaFilter(event.target.value)}
            className="h-10 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
          >
            <option value="">Área</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-[var(--g66-radius-xl)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-card)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--g66-surface-soft)] text-xs uppercase tracking-wide text-[var(--g66-text-secondary)]">
            <tr className="border-b border-[var(--g66-border)]">
              <th className="px-5 py-4">Nombre</th>
              <th className="px-5 py-4">Email</th>
              <th className="px-5 py-4">Rol</th>
              <th className="px-5 py-4">Área/equipo</th>
              <th className="px-5 py-4">Estado</th>
              <th className="px-5 py-4">Último acceso</th>
              <th className="px-5 py-4">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g66-border-soft)]">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="transition hover:bg-[var(--g66-surface-soft)]">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-xs font-black text-[var(--g66-brand-blue)]">
                      {user.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span className="font-black text-[var(--g66-text-primary)]">
                      {user.name}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4 font-semibold text-[var(--g66-text-secondary)]">
                  {user.email}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${roleBadgeClass(
                      user.role,
                    )}`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <p className="font-bold text-[var(--g66-text-primary)]">
                    {user.area || "Sin área"}
                  </p>
                  <p className="text-xs font-semibold text-[var(--g66-text-secondary)]">
                    {user.team || "Sin equipo"}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${statusBadgeClass(
                      user.status,
                    )}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {user.status}
                  </span>
                </td>
                <td className="px-5 py-4 font-semibold text-[var(--g66-text-secondary)]">
                  {formatDateTime(user.last_login_at)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(user)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white px-3 text-xs font-black text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                    >
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleUserStatus(user)}
                      className="inline-flex h-8 items-center rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white px-3 text-xs font-black text-[var(--g66-text-secondary)] hover:bg-[var(--g66-surface-soft)]"
                    >
                      {user.status === "ACTIVE" ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-sm font-semibold text-[var(--g66-text-secondary)]"
                >
                  No hay usuarios para los filtros actuales.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 bg-[var(--g66-text-primary)]/25 p-4">
          <div className="ml-auto flex h-full w-full max-w-xl flex-col rounded-[var(--g66-radius-xl)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-soft)]">
            <div className="flex h-16 items-center justify-between border-b border-[var(--g66-border-soft)] px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-[var(--g66-text-primary)]">
                    {draft.id ? "Editar usuario" : "Nuevo usuario"}
                  </h2>
                  <p className="text-xs font-semibold text-[var(--g66-text-secondary)]">
                    Sin contraseña. La identidad vendrá desde Cognito/Google SSO.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={saveUser} className="grid flex-1 content-start gap-4 overflow-y-auto p-5">
              {error ? (
                <p className="rounded-[var(--g66-radius-md)] border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-3 text-sm font-semibold text-[var(--g66-danger)]">
                  {error}
                </p>
              ) : null}

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[var(--g66-text-primary)]">
                  Nombre
                </span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[var(--g66-text-primary)]">
                  Email
                </span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, email: event.target.value }))
                  }
                  disabled={Boolean(draft.id)}
                  className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:bg-[var(--g66-background-soft)] disabled:text-[var(--g66-text-secondary)]"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[var(--g66-text-primary)]">
                    Rol
                  </span>
                  <select
                    value={draft.role}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        role: event.target.value as CrmUserRole,
                      }))
                    }
                    className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
                  >
                    {crmUserRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[var(--g66-text-primary)]">
                    Estado
                  </span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        status: event.target.value as CrmUserStatus,
                      }))
                    }
                    className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
                  >
                    {crmUserStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[var(--g66-text-primary)]">
                    Área
                  </span>
                  <input
                    value={draft.area}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, area: event.target.value }))
                    }
                    className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[var(--g66-text-primary)]">
                    Equipo
                  </span>
                  <input
                    value={draft.team}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, team: event.target.value }))
                    }
                    className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                  />
                </label>
              </div>

              {canManageAircallSettings ? (
              <section className="grid gap-4 rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-[var(--g66-surface-soft)] p-4">
                <div>
                  <h3 className="text-sm font-black text-[var(--g66-text-primary)]">
                    Aircall
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-[var(--g66-text-secondary)]">
                    Mapeo temporal CRM ↔ Aircall. En AWS se resolverá con Cognito/SSO y backend.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[var(--g66-text-primary)]">
                      Aircall User ID
                    </span>
                    <input
                      value={draft.aircall_user_id}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          aircall_user_id: event.target.value,
                        }))
                      }
                      placeholder="123456"
                      className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[var(--g66-text-primary)]">
                      Aircall email
                    </span>
                    <input
                      type="email"
                      value={draft.aircall_email}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          aircall_email: event.target.value,
                        }))
                      }
                      className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[var(--g66-text-primary)]">
                      Aircall nombre
                    </span>
                    <input
                      value={draft.aircall_name}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          aircall_name: event.target.value,
                        }))
                      }
                      className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[var(--g66-text-primary)]">
                      Número Aircall
                    </span>
                    <input
                      value={draft.default_aircall_number}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          default_aircall_number: event.target.value,
                        }))
                      }
                      placeholder="+569..."
                      className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[var(--g66-text-primary)]">
                      ID número Aircall
                    </span>
                    <input
                      value={draft.default_aircall_number_id}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          default_aircall_number_id: event.target.value,
                        }))
                      }
                      className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 py-3 text-sm font-bold text-[var(--g66-text-primary)]">
                    <input
                      type="checkbox"
                      checked={draft.aircall_is_active}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          aircall_is_active: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[var(--g66-brand-blue)]"
                    />
                    Mapeo activo
                  </label>
                </div>
              </section>
              ) : null}

              <div className="mt-2 flex justify-end gap-3 border-t border-[var(--g66-border-soft)] pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-4 text-sm font-bold text-[var(--g66-text-secondary)] hover:bg-[var(--g66-surface-soft)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-10 items-center justify-center rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-4 text-sm font-bold text-white hover:bg-[var(--g66-brand-blue-hover)] disabled:cursor-not-allowed disabled:bg-[var(--g66-border)]"
                >
                  {isSaving ? "Guardando..." : draft.id ? "Guardar cambios" : "Crear usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
