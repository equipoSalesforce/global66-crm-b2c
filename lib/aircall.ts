import { hasPermission, type CrmRolePermissionRecord } from "./permissions";

export type AircallDialErrorCode =
  | "no_event_name"
  | "not_ready"
  | "no_answer"
  | "does_not_exists"
  | "invalid_response"
  | "unknown_error"
  | "in_call"
  | "not_in_keyboard";

export type AircallMapping = {
  id: string;
  crm_user_id: string;
  aircall_user_id: string;
  aircall_email: string | null;
  aircall_name: string | null;
  default_aircall_number_id: string | null;
  default_aircall_number: string | null;
  is_active: boolean;
};

export function normalizeAircallPhone(phone: string | null | undefined) {
  const rawValue = (phone ?? "").trim();
  if (!rawValue) return "";

  const normalized = rawValue
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+");

  if (normalized.startsWith("+")) return normalized;

  if (normalized.length >= 8 && normalized.length <= 9) {
    return `+56${normalized}`;
  }

  return `+${normalized}`;
}

export function aircallPhoneMatches(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = (left ?? "").replace(/\D/g, "");
  const normalizedRight = (right ?? "").replace(/\D/g, "");

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const localComparisonLength = 9;
  if (
    normalizedLeft.length < localComparisonLength ||
    normalizedRight.length < localComparisonLength
  ) {
    return false;
  }

  return (
    normalizedLeft.slice(-localComparisonLength) ===
    normalizedRight.slice(-localComparisonLength)
  );
}

export function getAircallDialErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message)
      : "";

  if (code === "not_ready") return "Aircall todavía no está listo.";
  if (code === "no_answer") return "Aircall no respondió. Inicia sesión nuevamente.";
  if (code === "in_call") return "Aircall ya está en una llamada.";
  if (code === "does_not_exists") return "La acción de marcado no está disponible.";
  if (code === "unknown_error") return "Aircall respondió con un error desconocido.";

  return message || "No se pudo iniciar la llamada en Aircall.";
}

export function canUseAircall(
  role: string | null | undefined,
  configuredPermissions?: CrmRolePermissionRecord[] | null,
) {
  return hasPermission(role, "use_aircall", configuredPermissions);
}

export function canViewAircallHistory(
  role: string | null | undefined,
  configuredPermissions?: CrmRolePermissionRecord[] | null,
) {
  return hasPermission(role, "view_call_history", configuredPermissions);
}

export function canManageAircallSettings(
  role: string | null | undefined,
  configuredPermissions?: CrmRolePermissionRecord[] | null,
) {
  return hasPermission(role, "manage_aircall_settings", configuredPermissions);
}
