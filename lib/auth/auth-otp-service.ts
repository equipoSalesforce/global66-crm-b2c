import "server-only";

import {
  recordAuditEvent,
  recordAuthLoginEvent,
} from "@/lib/auth/auth-audit-service";
import {
  getAuthRuntimeSettings,
  getAuthStaticConfig,
  isProfileAdminEmail,
} from "@/lib/auth/auth-config";
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCode,
} from "@/lib/auth/auth-crypto";
import { sendAuthOtpEmail } from "@/lib/auth/auth-email-service";
import { createAuthSession } from "@/lib/auth/auth-session-service";
import {
  AuthOtpError,
  type AuthRequestContext,
} from "@/lib/auth/auth-types";
import type { CrmUserRole } from "@/lib/crm-users";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: CrmUserRole;
  status: "ACTIVE" | "INACTIVE";
};

type LoginCodeRow = {
  id: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
};

export function normalizeAuthEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function assertAllowedEmail(email: string) {
  const { allowedEmailDomain } = getAuthStaticConfig();
  const validFormat = /^[^\s@]+@[^\s@]+$/.test(email);
  if (!validFormat || !email.endsWith(`@${allowedEmailDomain}`)) {
    throw new AuthOtpError(
      "DOMAIN_NOT_ALLOWED",
      `Sólo se permiten correos @${allowedEmailDomain}.`,
      400,
    );
  }
}

async function countLoginCodes(filters: {
  email?: string;
  ipHash?: string;
  since: Date;
}) {
  let query = getSupabaseAdmin()
    .from("auth_login_codes")
    .select("id", { count: "exact", head: true })
    .gte("created_at", filters.since.toISOString());
  if (filters.email) query = query.eq("email", filters.email);
  if (filters.ipHash) query = query.eq("ip_hash", filters.ipHash);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function rejectWithLoginEvent(input: {
  email: string;
  context: AuthRequestContext;
  code:
    | "DOMAIN_NOT_ALLOWED"
    | "RATE_LIMIT_EMAIL_WINDOW"
    | "RATE_LIMIT_EMAIL_DAILY"
    | "RATE_LIMIT_IP_DAILY";
  message: string;
  status?: number;
}): Promise<never> {
  await recordAuthLoginEvent({
    email: input.email || null,
    eventType: input.code,
    errorCode: input.code,
    errorMessage: input.message,
    context: input.context,
  });
  throw new AuthOtpError(input.code, input.message, input.status ?? 429);
}

export async function requestOtpCode(
  rawEmail: unknown,
  context: AuthRequestContext,
) {
  const email = normalizeAuthEmail(rawEmail);
  try {
    assertAllowedEmail(email);
  } catch (error) {
    if (error instanceof AuthOtpError) {
      await rejectWithLoginEvent({
        email,
        context,
        code: "DOMAIN_NOT_ALLOWED",
        message: error.message,
        status: error.status,
      });
    }
    throw error;
  }

  const settings = await getAuthRuntimeSettings();
  const now = Date.now();
  const windowCount = await countLoginCodes({
    email,
    since: new Date(now - settings.emailWindowMinutes * 60 * 1000),
  });
  if (windowCount >= settings.maxRequestsPerEmailPerWindow) {
    await rejectWithLoginEvent({
      email,
      context,
      code: "RATE_LIMIT_EMAIL_WINDOW",
      message: "Ya se envió un código recientemente. Intenta nuevamente en unos minutos.",
    });
  }

  const dayStart = new Date(now - 24 * 60 * 60 * 1000);
  const emailDayCount = await countLoginCodes({ email, since: dayStart });
  if (emailDayCount >= settings.maxRequestsPerEmailPerDay) {
    await rejectWithLoginEvent({
      email,
      context,
      code: "RATE_LIMIT_EMAIL_DAILY",
      message: "Ya se envió un código recientemente. Intenta nuevamente en unos minutos.",
    });
  }

  if (context.ipHash) {
    const ipDayCount = await countLoginCodes({
      ipHash: context.ipHash,
      since: dayStart,
    });
    if (ipDayCount >= settings.maxRequestsPerIpPerDay) {
      await rejectWithLoginEvent({
        email,
        context,
        code: "RATE_LIMIT_IP_DAILY",
        message: "Demasiadas solicitudes desde esta red. Intenta más tarde.",
      });
    }
  }

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const expiresAt = new Date(now + settings.otpExpiresMinutes * 60 * 1000);
  const { data: loginCode, error: insertError } = await getSupabaseAdmin()
    .from("auth_login_codes")
    .insert({
      email,
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
      max_attempts: settings.otpMaxAttempts,
      ip_hash: context.ipHash,
      user_agent: context.userAgent,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError) throw insertError;

  try {
    await sendAuthOtpEmail({
      email,
      code,
      expiresMinutes: settings.otpExpiresMinutes,
    });
  } catch {
    await getSupabaseAdmin()
      .from("auth_login_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", loginCode.id);
    await recordAuthLoginEvent({
      email,
      eventType: "OTP_SEND_FAILED",
      errorCode: "OTP_SEND_FAILED",
      errorMessage: "No pudimos enviar el código. Intenta nuevamente.",
      context,
    });
    throw new AuthOtpError(
      "OTP_SEND_FAILED",
      "No pudimos enviar el código. Intenta nuevamente.",
      503,
    );
  }

  return {
    email,
    expiresInMinutes: settings.otpExpiresMinutes,
  };
}

function userNameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "Usuario Global66";
}

async function findUserById(userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("crm_users")
    .select("id, name, email, role, status")
    .eq("id", userId)
    .maybeSingle<UserRow>();
  if (error) throw error;
  return data;
}

async function findUserByEmail(email: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("crm_users")
    .select("id, name, email, role, status")
    .ilike("email", email)
    .maybeSingle<UserRow>();
  if (error) throw error;
  return data;
}

async function findAliasUser(email: string) {
  const { data: alias, error } = await getSupabaseAdmin()
    .from("auth_user_email_aliases")
    .select("user_id")
    .ilike("email", email)
    .maybeSingle<{ user_id: string }>();
  if (error) throw error;
  return alias ? findUserById(alias.user_id) : null;
}

async function createKatherineAlias(
  user: UserRow,
  email: string,
  context: AuthRequestContext,
) {
  const { error } = await getSupabaseAdmin()
    .from("auth_user_email_aliases")
    .insert({
      user_id: user.id,
      email,
      is_primary: false,
      verified_at: new Date().toISOString(),
    });
  if (error?.code === "23505") {
    const aliasedUser = await findAliasUser(email);
    if (aliasedUser) return aliasedUser;
  }
  if (error) throw error;

  await recordAuthLoginEvent({
    email,
    userId: user.id,
    eventType: "ADMIN_BOOTSTRAPPED",
    success: true,
    context,
  });
  await recordAuditEvent({
    actorUserId: user.id,
    actorEmail: email,
    action: "ADMIN_BOOTSTRAPPED",
    entityType: "crm_user",
    entityId: user.id,
    afterData: { aliasEmail: email },
    context,
  });
  return user;
}

async function resolveOrCreateUser(
  email: string,
  context: AuthRequestContext,
) {
  const config = getAuthStaticConfig();
  const aliasedUser = await findAliasUser(email);
  if (aliasedUser) return aliasedUser;

  if (email === config.bootstrapAdminEmail) {
    const legacyUser = await findUserByEmail(config.bootstrapAdminLegacyEmail);
    if (legacyUser) {
      return createKatherineAlias(legacyUser, email, context);
    }
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) return existingUser;

  const { data: user, error } = await getSupabaseAdmin()
    .from("crm_users")
    .insert({
      name: userNameFromEmail(email),
      email,
      role: config.defaultRole,
      status: "ACTIVE",
    })
    .select("id, name, email, role, status")
    .single<UserRow>();
  if (error?.code === "23505") {
    const concurrentUser = await findUserByEmail(email);
    if (concurrentUser) return concurrentUser;
  }
  if (error) throw error;

  await recordAuditEvent({
    actorUserId: user.id,
    actorEmail: email,
    action: "USER_CREATED",
    entityType: "crm_user",
    entityId: user.id,
    afterData: { email, role: config.defaultRole, status: "ACTIVE" },
    context,
  });
  return user;
}

async function rejectVerification(input: {
  email: string;
  userId?: string | null;
  context: AuthRequestContext;
  eventType: "INVALID_CODE" | "EXPIRED_CODE" | "MAX_ATTEMPTS_EXCEEDED";
}): Promise<never> {
  await recordAuthLoginEvent({
    email: input.email,
    userId: input.userId,
    eventType: input.eventType,
    errorCode: input.eventType,
    errorMessage: "Código inválido o expirado.",
    context: input.context,
  });
  throw new AuthOtpError(
    input.eventType,
    "Código inválido o expirado.",
    400,
  );
}

export async function verifyOtpAndCreateSession(input: {
  rawEmail: unknown;
  rawCode: unknown;
  context: AuthRequestContext;
}) {
  const email = normalizeAuthEmail(input.rawEmail);
  assertAllowedEmail(email);
  const code = typeof input.rawCode === "string" ? input.rawCode.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    await rejectVerification({
      email,
      context: input.context,
      eventType: "INVALID_CODE",
    });
  }

  const { data: loginCode, error } = await getSupabaseAdmin()
    .from("auth_login_codes")
    .select("id, code_hash, expires_at, attempts, max_attempts")
    .eq("email", email)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<LoginCodeRow>();
  if (error) throw error;
  if (!loginCode) {
    return rejectVerification({
      email,
      context: input.context,
      eventType: "INVALID_CODE",
    });
  }

  if (new Date(loginCode.expires_at).getTime() <= Date.now()) {
    await getSupabaseAdmin()
      .from("auth_login_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", loginCode.id);
    await rejectVerification({
      email,
      context: input.context,
      eventType: "EXPIRED_CODE",
    });
  }

  if (loginCode.attempts >= loginCode.max_attempts) {
    await rejectVerification({
      email,
      context: input.context,
      eventType: "MAX_ATTEMPTS_EXCEEDED",
    });
  }

  if (!(await verifyOtpCode(code, loginCode.code_hash))) {
    const attempts = loginCode.attempts + 1;
    await getSupabaseAdmin()
      .from("auth_login_codes")
      .update({ attempts })
      .eq("id", loginCode.id);
    await rejectVerification({
      email,
      context: input.context,
      eventType: attempts >= loginCode.max_attempts
        ? "MAX_ATTEMPTS_EXCEEDED"
        : "INVALID_CODE",
    });
  }

  const { data: consumedCode, error: consumeError } = await getSupabaseAdmin()
    .from("auth_login_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", loginCode.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (consumeError) throw consumeError;
  if (!consumedCode) {
    return rejectVerification({
      email,
      context: input.context,
      eventType: "INVALID_CODE",
    });
  }

  const user = await resolveOrCreateUser(email, input.context);
  if (user.status !== "ACTIVE") {
    await recordAuthLoginEvent({
      email,
      userId: user.id,
      eventType: "USER_DISABLED",
      errorCode: "USER_DISABLED",
      errorMessage: "Tu usuario está desactivado. Contacta a Katherine.",
      context: input.context,
    });
    await recordAuditEvent({
      actorUserId: user.id,
      actorEmail: email,
      action: "USER_DISABLED_LOGIN_BLOCKED",
      entityType: "crm_user",
      entityId: user.id,
      metadata: { status: user.status },
      context: input.context,
    });
    throw new AuthOtpError(
      "USER_DISABLED",
      "Tu usuario está desactivado. Contacta a Katherine.",
      403,
    );
  }

  const session = await createAuthSession(user.id, input.context);
  await getSupabaseAdmin()
    .from("crm_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id);
  await recordAuthLoginEvent({
    email,
    userId: user.id,
    eventType: "LOGIN_SUCCESS",
    success: true,
    context: input.context,
    metadata: { profileAdmin: isProfileAdminEmail(email) },
  });
  await recordAuditEvent({
    actorUserId: user.id,
    actorEmail: email,
    action: "LOGIN_SUCCESS",
    entityType: "auth_session",
    metadata: { profileAdmin: isProfileAdminEmail(email) },
    context: input.context,
  });

  return { user, session };
}
