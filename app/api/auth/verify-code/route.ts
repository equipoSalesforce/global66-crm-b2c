import {
  assertAuthOtpEnabled,
  authErrorResponse,
} from "@/lib/auth/auth-route-utils";
import { verifyOtpAndCreateSession } from "@/lib/auth/auth-otp-service";
import { getAuthRequestContext } from "@/lib/auth/auth-request-context";
import { setAuthSessionCookie } from "@/lib/auth/auth-session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAuthOtpEnabled();
    const body = await request.json().catch(() => ({})) as {
      email?: unknown;
      code?: unknown;
    };
    const result = await verifyOtpAndCreateSession({
      rawEmail: body.email,
      rawCode: body.code,
      context: getAuthRequestContext(request),
    });
    await setAuthSessionCookie({
      token: result.session.token,
      expiresAt: result.session.expiresAt,
      request,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
