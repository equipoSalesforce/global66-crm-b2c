import { isAuthOtpEnabled } from "@/lib/auth/auth-config";
import { authErrorResponse } from "@/lib/auth/auth-route-utils";
import { getAuthenticatedUserFromCookies } from "@/lib/auth/auth-session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthOtpEnabled()) {
    return Response.json({ enabled: false, user: null });
  }

  try {
    const user = await getAuthenticatedUserFromCookies();
    return Response.json(
      { enabled: true, user },
      { status: user ? 200 : 401 },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
