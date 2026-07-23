import type { CrmUserRole, CrmUserStatus } from "@/lib/crm-users";

export const AUTH_SESSION_COOKIE = "g66_crm_session";

export type AuthRequestContext = {
  ipHash: string | null;
  userAgent: string | null;
};

export type AuthenticatedCrmUser = {
  id: string;
  name: string;
  email: string;
  role: CrmUserRole;
  area: string | null;
  team: string | null;
  status: CrmUserStatus;
  isAdmin: boolean;
};

export type AuthLoginEventType =
  | "DOMAIN_NOT_ALLOWED"
  | "RATE_LIMIT_EMAIL_WINDOW"
  | "RATE_LIMIT_EMAIL_DAILY"
  | "RATE_LIMIT_IP_DAILY"
  | "OTP_SEND_FAILED"
  | "INVALID_CODE"
  | "EXPIRED_CODE"
  | "MAX_ATTEMPTS_EXCEEDED"
  | "USER_DISABLED"
  | "LOGIN_SUCCESS"
  | "LOGOUT"
  | "ADMIN_BOOTSTRAPPED";

export class AuthOtpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AuthOtpError";
  }
}
