"use client";

import { Permission, hasPermission } from "@/lib/permissions";
import { useDemoRole } from "./use-demo-role";
import { useCrmPermissions } from "./use-crm-permissions";

export function PermissionAction({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { role, isCheckingRole } = useDemoRole();
  const { permissions: rolePermissions, isLoadingPermissions } = useCrmPermissions();

  if (
    isCheckingRole ||
    isLoadingPermissions ||
    !hasPermission(role, permission, rolePermissions)
  ) {
    return null;
  }

  return <>{children}</>;
}
