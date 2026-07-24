import "server-only";

type PostgrestErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function serializeAiGovernanceError(error: unknown) {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string" && error.trim()) return error.trim();

  if (error && typeof error === "object") {
    const record = error as PostgrestErrorLike;
    const code = nonEmptyString(record.code);
    const message = nonEmptyString(record.message);
    const details = nonEmptyString(record.details);
    const hint = nonEmptyString(record.hint);

    if (message) {
      return [
        code ? `Supabase ${code}: ${message}` : message,
        details ? `Detalles: ${details}` : null,
        hint ? `Sugerencia: ${hint}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
    }
  }

  return "Error inesperado al administrar límites IA.";
}

export function logAiGovernanceError(scope: string, error: unknown) {
  console.error("[AI Governance Error]", {
    scope,
    error: serializeAiGovernanceError(error),
  });
}
