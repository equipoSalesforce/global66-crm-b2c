import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/lib/auth/auth-types";

const PUBLIC_PATHS = new Set(["/login", "/health"]);
const PUBLIC_API_PREFIXES = [
  "/api/auth/",
  "/api/health",
  "/api/integrations/",
  "/api/webhooks/",
  "/api/aircall/webhook",
];

export function proxy(request: NextRequest) {
  if (process.env.AUTH_OTP_ENABLED?.trim().toLowerCase() !== "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.png"
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.has(AUTH_SESSION_COOKIE)) {
    if (pathname.startsWith("/api/")) {
      if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return NextResponse.next();
      }
      return NextResponse.json(
        { ok: false, error: "Sesión requerida." },
        { status: 401 },
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
