"use client";

import type { CrmRolePermissionRecord } from "@/lib/permissions";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useState } from "react";

export function useCrmPermissions() {
  const [permissions, setPermissions] = useState<CrmRolePermissionRecord[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadPermissions() {
      const { data, error } = await supabaseBrowser
        .from("crm_role_permissions")
        .select("role, permission_key, enabled");

      if (!isMounted) return;

      if (error) {
        console.error("[crm-permissions] Error loading role permissions", {
          message: error.message,
          error,
        });
        setPermissions([]);
      } else {
        setPermissions(data ?? []);
      }

      setIsLoadingPermissions(false);
    }

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, []);

  return { permissions, isLoadingPermissions };
}
