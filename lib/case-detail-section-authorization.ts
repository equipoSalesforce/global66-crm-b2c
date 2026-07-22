import "server-only";

import { getCurrentCrmUser } from "@/lib/current-crm-user";
import { hasPermission, type CrmRolePermissionRecord } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

export async function canConfigureCaseDetailSections() {
  const currentUser = await getCurrentCrmUser();
  const { data, error } = await supabase
    .from("crm_role_permissions")
    .select("role, permission_key, enabled")
    .eq("role", currentUser.role)
    .returns<CrmRolePermissionRecord[]>();

  if (error) return false;
  return hasPermission(currentUser.role, "editGlobalSettings", data ?? []);
}
