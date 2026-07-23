import { cookies } from "next/headers";
import {
  recordAuditEvent,
  recordAuthLoginEvent,
} from "@/lib/auth/auth-audit-service";
import { isAuthOtpEnabled } from "@/lib/auth/auth-config";
import { getAuthRequestContext } from "@/lib/auth/auth-request-context";
import { authErrorResponse } from "@/lib/auth/auth-route-utils";
import {
  clearAuthSessionCookie,
  getAuthenticatedUserByToken,
  revokeAuthSession,
} from "@/lib/auth/auth-session-service";
import { AUTH_SESSION_COOKIE } from "@/lib/auth/auth-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
    const context = getAuthRequestContext(request);

    if (isAuthOtpEnabled() && token) {
      const user = await getAuthenticatedUserByToken(token);
      await revokeAuthSession(token);
      if (user) {
        await recordAuthLoginEvent({
          email: user.email,
          userId: user.id,
          eventType: "LOGOUT",
          success: true,
          context,
        });
        await recordAuditEvent({
          actorUserId: user.id,
          actorEmail: user.email,
          action: "LOGOUT",
          entityType: "auth_session",
          context,
        });
      }
    }

    await clearAuthSessionCookie();
    return Response.json({ ok: true });
  } catch (error) {
    await clearAuthSessionCookie();
    return authErrorResponse(error);
  }
}
