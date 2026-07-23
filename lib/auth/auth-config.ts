import "server-only";

import { normalizeCrmUserRole } from "@/lib/crm-users";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const SETTING_KEYS = [
  "AUTH_OTP_MAX_REQUESTS_PER_IP_PER_DAY",
  "AUTH_OTP_MAX_REQUESTS_PER_EMAIL_PER_WINDOW",
  "AUTH_OTP_EMAIL_WINDOW_MINUTES",
  "AUTH_OTP_MAX_REQUESTS_PER_EMAIL_PER_DAY",
  "AUTH_OTP_EXPIRES_MINUTES",
  "AUTH_OTP_MAX_ATTEMPTS",
  "AUTH_SESSION_DAYS",
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

const DEFAULT_NUMERIC_SETTINGS: Record<SettingKey, number> = {
  AUTH_OTP_MAX_REQUESTS_PER_IP_PER_DAY: 3,
  AUTH_OTP_MAX_REQUESTS_PER_EMAIL_PER_WINDOW: 1,
  AUTH_OTP_EMAIL_WINDOW_MINUTES: 15,
  AUTH_OTP_MAX_REQUESTS_PER_EMAIL_PER_DAY: 5,
  AUTH_OTP_EXPIRES_MINUTES: 10,
  AUTH_OTP_MAX_ATTEMPTS: 5,
  AUTH_SESSION_DAYS: 7,
};

function positiveInteger(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizedEmailList(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAuthOtpEnabled() {
  return process.env.AUTH_OTP_ENABLED?.trim().toLowerCase() === "true";
}

export function getAuthStaticConfig() {
  const allowedEmailDomain = (
    process.env.AUTH_ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase() || "global66.com"
  ).replace(/^@/, "");

  return {
    allowedEmailDomain,
    defaultRole: normalizeCrmUserRole(
      process.env.AUTH_DEFAULT_ROLE?.trim().toUpperCase() || "AGENT",
    ),
    profileAdminEmails: normalizedEmailList(process.env.AUTH_PROFILE_ADMIN_EMAILS),
    bootstrapAdminEmail: (
      process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ||
      "katherine.araya@global66.com"
    ),
    bootstrapAdminLegacyEmail: (
      process.env.AUTH_BOOTSTRAP_ADMIN_LEGACY_EMAIL?.trim().toLowerCase() ||
      "ka@test.com"
    ),
  };
}

export function isProfileAdminEmail(email: string) {
  return getAuthStaticConfig().profileAdminEmails.has(email.trim().toLowerCase());
}

export async function getAuthRuntimeSettings() {
  const fromEnvironment = Object.fromEntries(
    SETTING_KEYS.map((key) => [
      key,
      positiveInteger(process.env[key], DEFAULT_NUMERIC_SETTINGS[key]),
    ]),
  ) as Record<SettingKey, number>;

  const { data, error } = await getSupabaseAdmin()
    .from("auth_settings")
    .select("key, value")
    .in("key", [...SETTING_KEYS])
    .returns<Array<{ key: string; value: string }>>();
  if (error) throw error;

  for (const setting of data ?? []) {
    if (!SETTING_KEYS.includes(setting.key as SettingKey)) continue;
    const key = setting.key as SettingKey;
    fromEnvironment[key] = positiveInteger(setting.value, fromEnvironment[key]);
  }

  return {
    maxRequestsPerIpPerDay: fromEnvironment.AUTH_OTP_MAX_REQUESTS_PER_IP_PER_DAY,
    maxRequestsPerEmailPerWindow:
      fromEnvironment.AUTH_OTP_MAX_REQUESTS_PER_EMAIL_PER_WINDOW,
    emailWindowMinutes: fromEnvironment.AUTH_OTP_EMAIL_WINDOW_MINUTES,
    maxRequestsPerEmailPerDay:
      fromEnvironment.AUTH_OTP_MAX_REQUESTS_PER_EMAIL_PER_DAY,
    otpExpiresMinutes: fromEnvironment.AUTH_OTP_EXPIRES_MINUTES,
    otpMaxAttempts: fromEnvironment.AUTH_OTP_MAX_ATTEMPTS,
    sessionDays: fromEnvironment.AUTH_SESSION_DAYS,
  };
}
