import "server-only";

import { authorizeCaseAction } from "@/lib/case-action-authorization";
import { SmartSupervisionClientError } from "@/lib/smartsupervision-client";
import { serializeSmartSupervisionError } from "@/lib/smartsupervision-errors";

export async function authorizeSmartSupervisionRoute() {
  const { user } = await authorizeCaseAction("manage_cases");
  return user;
}

type ErrorLike = {
  cause?: unknown;
  message?: unknown;
  name?: unknown;
  stack?: unknown;
};

function readErrorLike(error: unknown) {
  const errorLike = error !== null && typeof error === "object"
    ? error as ErrorLike
    : null;
  return {
    cause: errorLike?.cause,
    message: typeof errorLike?.message === "string"
      ? errorLike.message
      : typeof error === "string"
        ? error
        : "Error SmartSupervisión.",
    name: typeof errorLike?.name === "string"
      ? errorLike.name
      : "UnknownError",
    stack: typeof errorLike?.stack === "string" ? errorLike.stack : undefined,
  };
}

export function smartSupervisionErrorResponse(error: unknown, route: string) {
  const errorInfo = readErrorLike(error);
  console.error("[SmartSupervisión] Error en ruta interna", {
    route,
    name: errorInfo.name,
    message: errorInfo.message,
    stack: errorInfo.stack,
    cause: errorInfo.cause,
  });

  const message = serializeSmartSupervisionError(error);
  const status = message.includes("permiso")
    ? 403
    : error instanceof SmartSupervisionClientError
      ? error.status === null
        ? 503
        : 502
      : 400;
  const response: Record<string, unknown> = {
    ok: false,
    error: "Error SmartSupervisión.",
  };

  if (process.env.NODE_ENV === "development") {
    response.detail = message;
    response.stack = errorInfo.stack ?? null;
    if (error instanceof SmartSupervisionClientError) {
      response.upstream = error.response;
    }
  }

  return Response.json(response, { status });
}
