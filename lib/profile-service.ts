import "server-only";

import { isAuthOtpEnabled } from "@/lib/auth/auth-config";
import { getCurrentCrmUser } from "@/lib/current-crm-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ProfileActivityItem = {
  id: string;
  action: string;
  detail: string;
  success: boolean;
  createdAt: string;
};

export type CrmProfile = {
  user: Awaited<ReturnType<typeof getCurrentCrmUser>>;
  authEnabled: boolean;
  loginMethod: string;
  legacyAlias: string | null;
  lastLoginAt: string | null;
  sessionStartedAt: string | null;
  userAgent: string | null;
  activity: ProfileActivityItem[];
};

export async function getCrmProfile(): Promise<CrmProfile> {
  const user = await getCurrentCrmUser();
  const authEnabled = isAuthOtpEnabled();

  if (!authEnabled) {
    return {
      user,
      authEnabled,
      loginMethod: "Selector de usuario demo",
      legacyAlias: null,
      lastLoginAt: null,
      sessionStartedAt: null,
      userAgent: null,
      activity: [],
    };
  }

  const admin = getSupabaseAdmin();
  const [aliasesResult, sessionsResult, loginEventsResult, auditEventsResult] =
    await Promise.all([
      admin
        .from("auth_user_email_aliases")
        .select("email, is_primary")
        .eq("user_id", user.id)
        .order("is_primary", { ascending: false }),
      admin
        .from("auth_sessions")
        .select("created_at, last_seen_at, user_agent")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .order("last_seen_at", { ascending: false })
        .limit(1),
      admin
        .from("auth_login_events")
        .select("id, event_type, success, error_message, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12),
      admin
        .from("audit_events")
        .select("id, action, entity_type, created_at")
        .eq("actor_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  const session = sessionsResult.data?.[0] ?? null;
  const aliases = aliasesResult.data ?? [];
  const legacyAlias =
    aliases.find((alias) => alias.email.toLowerCase() !== user.email.toLowerCase())
      ?.email ?? null;
  const loginActivity: ProfileActivityItem[] = (loginEventsResult.data ?? []).map(
    (event) => ({
      id: `login-${event.id}`,
      action: event.success ? "Inicio de sesión" : "Intento de acceso",
      detail: event.success
        ? "Acceso al CRM mediante código por correo."
        : event.error_message || "Acceso no completado.",
      success: event.success,
      createdAt: event.created_at,
    }),
  );
  const auditActivity: ProfileActivityItem[] = (auditEventsResult.data ?? []).map(
    (event) => ({
      id: `audit-${event.id}`,
      action: event.action,
      detail: event.entity_type
        ? `Acción registrada sobre ${event.entity_type}.`
        : "Acción registrada en el CRM.",
      success: true,
      createdAt: event.created_at,
    }),
  );

  return {
    user,
    authEnabled,
    loginMethod: "Código por correo (OTP)",
    legacyAlias,
    lastLoginAt: session?.last_seen_at ?? null,
    sessionStartedAt: session?.created_at ?? null,
    userAgent: session?.user_agent ?? null,
    activity: [...loginActivity, ...auditActivity]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 16),
  };
}
