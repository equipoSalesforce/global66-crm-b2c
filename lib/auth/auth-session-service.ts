import "server-only";

import { cookies } from "next/headers";
import {
  createSessionToken,
  hashSessionToken,
} from "@/lib/auth/auth-crypto";
import {
  getAuthRuntimeSettings,
  getAuthStaticConfig,
  isProfileAdminEmail,
} from "@/lib/auth/auth-config";
import {
  AUTH_SESSION_COOKIE,
  AuthOtpError,
  type AuthenticatedCrmUser,
  type AuthRequestContext,
} from "@/lib/auth/auth-types";
import {
  normalizeCrmUserRole,
  normalizeCrmUserStatus,
} from "@/lib/crm-users";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  area: string | null;
  team: string | null;
  status: string;
};

async function resolveSessionEmail(user: UserRow) {
  const { data, error } = await getSupabaseAdmin()
    .from("auth_user_email_aliases")
    .select("email, is_primary")
    .eq("user_id", user.id)
    .not("verified_at", "is", null)
    .returns<Array<{ email: string; is_primary: boolean }>>();
  if (error) throw error;

  const aliases = data ?? [];
  const adminAlias = aliases.find((alias) => isProfileAdminEmail(alias.email));
  return (
    adminAlias?.email ??
    aliases.find((alias) => alias.is_primary)?.email ??
    user.email
  ).toLowerCase();
}

async function loadSessionUser(userId: string): Promise<AuthenticatedCrmUser | null> {
  const { data: user, error } = await getSupabaseAdmin()
    .from("crm_users")
    .select("id, name, email, role, area, team, status")
    .eq("id", userId)
    .maybeSingle<UserRow>();
  if (error) throw error;
  if (!user || normalizeCrmUserStatus(user.status) !== "ACTIVE") return null;

  const email = await resolveSessionEmail(user);
  const storedRole = normalizeCrmUserRole(user.role);
  return {
    id: user.id,
    name: user.name,
    email,
    role: storedRole,
    area: user.area,
    team: user.team,
    status: "ACTIVE",
    isAdmin: storedRole === "ADMIN",
  };
}

export async function createAuthSession(
  userId: string,
  context: AuthRequestContext,
) {
  const settings = await getAuthRuntimeSettings();
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(
    Date.now() + settings.sessionDays * 24 * 60 * 60 * 1000,
  );
  const { error } = await getSupabaseAdmin().from("auth_sessions").insert({
    user_id: userId,
    session_token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    last_seen_at: new Date().toISOString(),
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
  });
  if (error) throw error;

  return { token, expiresAt };
}

export async function getAuthenticatedUserByToken(
  token: string | null | undefined,
): Promise<AuthenticatedCrmUser | null> {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const { data: session, error } = await getSupabaseAdmin()
    .from("auth_sessions")
    .select("id, user_id, expires_at")
    .eq("session_token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<SessionRow>();
  if (error) throw error;
  if (!session) return null;

  const user = await loadSessionUser(session.user_id);
  if (!user) return null;

  await getSupabaseAdmin()
    .from("auth_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id);
  return user;
}

export async function getAuthenticatedUserFromCookies() {
  const cookieStore = await cookies();
  return getAuthenticatedUserByToken(
    cookieStore.get(AUTH_SESSION_COOKIE)?.value,
  );
}

export async function revokeAuthSession(token: string | null | undefined) {
  if (!token) return;
  const { error } = await getSupabaseAdmin()
    .from("auth_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("session_token_hash", hashSessionToken(token))
    .is("revoked_at", null);
  if (error) throw error;
}

export async function setAuthSessionCookie(input: {
  token: string;
  expiresAt: Date;
  request: Request;
}) {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_SESSION_COOKIE, input.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(input.request.url).protocol === "https:",
    path: "/",
    expires: input.expiresAt,
    priority: "high",
  });
}

export async function clearAuthSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function isSessionUserAdmin(user: AuthenticatedCrmUser) {
  const configuredAdmins = getAuthStaticConfig().profileAdminEmails;
  return configuredAdmins.has(user.email.toLowerCase());
}

export async function requireProfileAdmin() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user || !isSessionUserAdmin(user)) {
    throw new AuthOtpError(
      "ADMIN_REQUIRED",
      "No tienes permisos para administrar autenticación.",
      403,
    );
  }
  return user;
}
