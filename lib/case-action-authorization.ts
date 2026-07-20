import "server-only";

import { getCurrentDemoUser } from "@/lib/demo-users";
import { hasPermission, type Permission, type CrmRolePermissionRecord } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import type { CaseAuditActor } from "@/lib/case-audit";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function authorizeCaseAction(permission: Permission) {
  const user = await getCurrentDemoUser();
  const { data, error } = await supabase
    .from("crm_role_permissions")
    .select("role, permission_key, enabled")
    .eq("role", user.role)
    .returns<CrmRolePermissionRecord[]>();

  if (error) throw error;
  if (!hasPermission(user.role, permission, data ?? [])) {
    throw new Error("No tienes permiso para realizar esta acción.");
  }

  const actor: CaseAuditActor = {
    userId: isUuid(user.id) ? user.id : null,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return { user, actor };
}
