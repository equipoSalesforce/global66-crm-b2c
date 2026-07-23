import "server-only";

import { isAuthOtpEnabled } from "@/lib/auth/auth-config";
import { AuthOtpError } from "@/lib/auth/auth-types";

export function assertAuthOtpEnabled() {
  if (!isAuthOtpEnabled()) {
    throw new AuthOtpError("AUTH_OTP_DISABLED", "Autenticación OTP deshabilitada.", 404);
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthOtpError) {
    return Response.json(
      { ok: false, error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error("[auth-otp] Error interno", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Error no serializable",
    stack: error instanceof Error ? error.stack : undefined,
  });
  return Response.json(
    { ok: false, error: "No pudimos completar la solicitud. Intenta nuevamente." },
    { status: 500 },
  );
}
