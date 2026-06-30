"use client";

import {
  AgentRole,
  Permission,
  hasPermission,
  normalizeRole,
} from "@/lib/permissions";
import { useCrmPermissions } from "./use-crm-permissions";
import { useCrmSession } from "./use-crm-session";

export function RoleGuard({
  anyPermission,
  allowedRoles,
  children,
}: {
  anyPermission?: Permission[];
  allowedRoles?: AgentRole[];
  children: React.ReactNode;
}) {
  const { user, isChecking } = useCrmSession({ redirectInactive: false });
  const { permissions: rolePermissions, isLoadingPermissions } = useCrmPermissions();
  const role = normalizeRole(user?.role);

  if (isChecking || isLoadingPermissions) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
        Validando permisos...
      </section>
    );
  }

  const roleAllowed = allowedRoles ? allowedRoles.includes(role) : true;
  const permissionAllowed = anyPermission
    ? anyPermission.some((permission) =>
        hasPermission(role, permission, rolePermissions),
      )
    : true;

  if (!user || user.status === "INACTIVE" || !roleAllowed || !permissionAllowed) {
    return (
      <section className="rounded-lg border border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue-soft)] p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--g66-brand-blue)]">Acceso restringido</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--g66-brand-blue)]">
          Tu perfil demo no tiene permisos para ver esta sección.
        </p>
      </section>
    );
  }

  return <>{children}</>;
}
