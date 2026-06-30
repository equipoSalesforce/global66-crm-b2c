"use client";

import {
  canEditCaseField,
  canViewCaseField,
  crmPermissionCatalog,
  crmPermissionCategories,
  defaultCrmRolePermissions,
  type CrmCaseFieldPermissionRecord,
  type CrmPermissionCategory,
  type CrmPermissionKey,
  type CrmRolePermissionRecord,
} from "@/lib/permissions";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Fragment } from "react";
import { useMemo, useState } from "react";
import { useToast } from "./toast-provider";

const managedRoles = ["ADMIN", "SUPERVISOR", "AGENT"] as const;

type ManagedRole = (typeof managedRoles)[number];

type PermissionCatalogRow = {
  key: CrmPermissionKey;
  label: string;
  description: string | null;
  category: CrmPermissionCategory;
};

type CasePermissionField = {
  field_key: string;
  label: string;
  field_type: string;
  is_standard: boolean;
  is_active: boolean;
};

const categoryLabels: Record<CrmPermissionCategory, string> = {
  navigation: "Navegación",
  cases: "Casos",
  customers: "Clientes",
  agents: "Agentes",
  configuration: "Configuración",
  users: "Usuarios",
  macros: "Macros",
  knowledge: "Conocimiento",
  reports: "Reportes",
  ai: "IA",
  aircall: "Aircall",
};

const fieldLabels: Record<string, string> = {
  subject: "Asunto",
  area: "Área",
  category: "Categoría",
  priority: "Prioridad",
  lifecycle_status: "Estado operativo",
  routing_status: "Estado de atención",
  resolution_type: "Resolución",
  contact_type: "Tipo de contacto",
  assigned_agent_id: "Agente asignado",
  assigned_to: "Asignado a",
};

function isRolePermissionEnabled(
  role: ManagedRole,
  permissionKey: CrmPermissionKey,
  permissions: CrmRolePermissionRecord[],
) {
  const configured = permissions.find(
    (permission) =>
      permission.role === role && permission.permission_key === permissionKey,
  );

  if (configured) return configured.enabled;

  return defaultCrmRolePermissions[role].includes(permissionKey);
}

export function CrmPermissionsAdmin({
  permissions,
  initialRolePermissions,
  initialCaseFieldPermissions,
  caseFields,
}: {
  permissions: PermissionCatalogRow[];
  initialRolePermissions: CrmRolePermissionRecord[];
  initialCaseFieldPermissions: CrmCaseFieldPermissionRecord[];
  caseFields: CasePermissionField[];
}) {
  const toast = useToast();
  const [rolePermissions, setRolePermissions] = useState(initialRolePermissions);
  const [caseFieldPermissions, setCaseFieldPermissions] = useState(
    initialCaseFieldPermissions,
  );
  const [pendingKey, setPendingKey] = useState("");
  const permissionCatalog = permissions.length > 0 ? permissions : crmPermissionCatalog;

  const permissionsByCategory = useMemo(() => {
    return crmPermissionCategories
      .map((category) => ({
        category,
        permissions: permissionCatalog.filter(
          (permission) => permission.category === category,
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [permissionCatalog]);

  async function updateRolePermission(
    role: ManagedRole,
    permissionKey: CrmPermissionKey,
    enabled: boolean,
  ) {
    const actionKey = `role:${role}:${permissionKey}`;
    setPendingKey(actionKey);

    const { error } = await supabaseBrowser
      .from("crm_role_permissions")
      .upsert(
        {
          role,
          permission_key: permissionKey,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "role,permission_key" },
      );

    setPendingKey("");

    if (error) {
      console.error("[crm-permissions] Error updating role permission", {
        role,
        permissionKey,
        enabled,
        message: error.message,
        error,
      });
      toast.error("✗ No se pudo actualizar el permiso");
      return;
    }

    setRolePermissions((current) => {
      const withoutCurrent = current.filter(
        (permission) =>
          !(
            permission.role === role &&
            permission.permission_key === permissionKey
          ),
      );

      return [...withoutCurrent, { role, permission_key: permissionKey, enabled }];
    });
    toast.success("✓ Permiso actualizado");
  }

  async function updateCaseFieldPermission(
    role: ManagedRole,
    fieldKey: string,
    partial: Pick<CrmCaseFieldPermissionRecord, "can_view" | "can_edit">,
  ) {
    const actionKey = `field:${role}:${fieldKey}:${partial.can_view}:${partial.can_edit}`;
    setPendingKey(actionKey);

    const { error } = await supabaseBrowser
      .from("crm_case_field_permissions")
      .upsert(
        {
          role,
          field_key: fieldKey,
          can_view: partial.can_view,
          can_edit: partial.can_edit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "role,field_key" },
      );

    setPendingKey("");

    if (error) {
      console.error("[crm-permissions] Error updating field permission", {
        role,
        fieldKey,
        partial,
        message: error.message,
        error,
      });
      toast.error("✗ No se pudo actualizar el permiso del campo");
      return;
    }

    setCaseFieldPermissions((current) => {
      const withoutCurrent = current.filter(
        (permission) =>
          !(permission.role === role && permission.field_key === fieldKey),
      );

      return [
        ...withoutCurrent,
        {
          role,
          field_key: fieldKey,
          can_view: partial.can_view,
          can_edit: partial.can_edit,
        },
      ];
    });
    toast.success("✓ Permiso actualizado");
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--g66-brand-blue)]">
            Configuración
          </p>
          <h1 className="mt-1 text-2xl font-black text-[var(--g66-text-primary)]">
            Permisos
          </h1>
          <p className="mt-1 text-sm font-semibold text-[var(--g66-text-secondary)]">
            Configura qué puede ver y hacer cada rol dentro del CRM.
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-card)]">
        <div className="flex items-center gap-3 border-b border-[var(--g66-border-soft)] px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-black text-[var(--g66-text-primary)]">
              Permisos por rol
            </h2>
            <p className="text-xs font-semibold text-[var(--g66-text-secondary)]">
              Estos permisos controlan navegación y acciones generales.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--g66-border-soft)] text-sm">
            <thead className="bg-[var(--g66-surface-soft)] text-xs uppercase tracking-wide text-[var(--g66-text-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-black">Permiso</th>
                {managedRoles.map((role) => (
                  <th key={role} className="px-4 py-3 text-center font-black">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g66-border-soft)]">
              {permissionsByCategory.map((group) => (
                <Fragment key={group.category}>
                  <tr key={`${group.category}-header`} className="bg-[var(--g66-background)]">
                    <td
                      colSpan={managedRoles.length + 1}
                      className="px-4 py-2 text-xs font-black uppercase tracking-wide text-[var(--g66-brand-blue)]"
                    >
                      {categoryLabels[group.category]}
                    </td>
                  </tr>
                  {group.permissions.map((permission) => (
                    <tr key={permission.key} className="hover:bg-[var(--g66-surface-soft)]">
                      <td className="px-4 py-3">
                        <p className="font-black text-[var(--g66-text-primary)]">
                          {permission.label}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-[var(--g66-text-secondary)]">
                          {permission.key}
                        </p>
                      </td>
                      {managedRoles.map((role) => {
                        const checked = isRolePermissionEnabled(
                          role,
                          permission.key,
                          rolePermissions,
                        );
                        const actionKey = `role:${role}:${permission.key}`;

                        return (
                          <td key={`${role}-${permission.key}`} className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={pendingKey === actionKey}
                              onChange={(event) =>
                                updateRolePermission(
                                  role,
                                  permission.key,
                                  event.target.checked,
                                )
                              }
                              className="h-4 w-4 accent-[var(--g66-brand-blue)]"
                              aria-label={`${permission.label} ${role}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-card)]">
        <div className="flex items-center gap-3 border-b border-[var(--g66-border-soft)] px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--g66-success-soft)] text-[var(--g66-success)]">
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-black text-[var(--g66-text-primary)]">
              Campos del caso
            </h2>
            <p className="text-xs font-semibold text-[var(--g66-text-secondary)]">
              Define qué campos estándar puede ver o editar cada rol.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--g66-border-soft)] text-sm">
            <thead className="bg-[var(--g66-surface-soft)] text-xs uppercase tracking-wide text-[var(--g66-text-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-black">Campo</th>
                {managedRoles.map((role) => (
                  <th key={role} className="px-4 py-3 text-center font-black">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g66-border-soft)]">
              {caseFields.map((field) => (
                <tr key={field.field_key} className="hover:bg-[var(--g66-surface-soft)]">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-[var(--g66-text-primary)]">
                        {field.label || fieldLabels[field.field_key] || field.field_key}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          field.is_standard
                            ? "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]"
                            : "bg-[var(--g66-success-soft)] text-[var(--g66-success)]"
                        }`}
                      >
                        {field.is_standard ? "Estándar" : "Personalizado"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-[var(--g66-text-secondary)]">
                      {field.field_key} · {field.field_type}
                    </p>
                  </td>
                  {managedRoles.map((role) => {
                    const canView = canViewCaseField(
                      role,
                      field.field_key,
                      caseFieldPermissions,
                    );
                    const canEdit = canEditCaseField(
                      role,
                      field.field_key,
                      caseFieldPermissions,
                    );

                    return (
                      <td key={`${role}-${field.field_key}`} className="px-4 py-3">
                        <div className="flex justify-center gap-4">
                          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--g66-text-secondary)]">
                            <input
                              type="checkbox"
                              checked={canView}
                              onChange={(event) =>
                                updateCaseFieldPermission(role, field.field_key, {
                                  can_view: event.target.checked,
                                  can_edit: event.target.checked ? canEdit : false,
                                })
                              }
                              className="h-4 w-4 accent-[var(--g66-brand-blue)]"
                            />
                            Ver
                          </label>
                          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--g66-text-secondary)]">
                            <input
                              type="checkbox"
                              checked={canEdit}
                              disabled={!canView}
                              onChange={(event) =>
                                updateCaseFieldPermission(role, field.field_key, {
                                  can_view: canView || event.target.checked,
                                  can_edit: event.target.checked,
                                })
                              }
                              className="h-4 w-4 accent-[var(--g66-brand-blue)]"
                            />
                            Editar
                          </label>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
