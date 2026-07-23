import "server-only";

import { isAuthOtpEnabled } from "@/lib/auth/auth-config";
import { getAuthenticatedUserFromCookies } from "@/lib/auth/auth-session-service";
import { getCurrentDemoUser } from "@/lib/demo-users";
import { supabase } from "@/lib/supabase";
import type { AiGovernanceUser } from "@/lib/ai-governance-types";

export async function getCurrentCrmUser() {
  if (isAuthOtpEnabled()) {
    const authenticatedUser = await getAuthenticatedUserFromCookies();
    if (!authenticatedUser) {
      throw new Error("No existe una sesión CRM válida.");
    }
    return {
      id: authenticatedUser.id,
      name: authenticatedUser.name,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
      area: authenticatedUser.area,
      team: authenticatedUser.team,
      status: "ACTIVE" as const,
    };
  }

  const demoUser = await getCurrentDemoUser();
  const baseQuery = supabase
    .from("crm_users")
    .select("id, name, email, role, area, team, status")
    .limit(1);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    demoUser.id,
  );
  const { data, error } = isUuid
    ? await baseQuery.eq("id", demoUser.id).maybeSingle<AiGovernanceUser>()
    : await baseQuery
        .eq("email", demoUser.email.toLowerCase())
        .maybeSingle<AiGovernanceUser>();

  if (error || !data || data.status !== "ACTIVE") {
    throw new Error("Usuario CRM inválido o inactivo.");
  }

  return data;
}
