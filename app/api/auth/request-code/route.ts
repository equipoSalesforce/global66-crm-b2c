import {
  assertAuthOtpEnabled,
  authErrorResponse,
} from "@/lib/auth/auth-route-utils";
import { requestOtpCode } from "@/lib/auth/auth-otp-service";
import { getAuthRequestContext } from "@/lib/auth/auth-request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAuthOtpEnabled();
    const body = await request.json().catch(() => ({})) as { email?: unknown };
    const result = await requestOtpCode(
      body.email,
      getAuthRequestContext(request),
    );
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return authErrorResponse(error);
  }
}
