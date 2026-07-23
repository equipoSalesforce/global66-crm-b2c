import type { SmartSupervisionJson } from "@/lib/smartsupervision-types";

export function readSmartSupervisionValue(
  payload: SmartSupervisionJson | null | undefined,
  ...keys: string[]
) {
  if (!payload) return null;
  for (const key of keys) {
    const direct = payload[key];
    if (direct !== null && direct !== undefined && direct !== "") return direct;
    const normalizedKey = Object.keys(payload).find(
      (candidate) => candidate.trim().toLowerCase() === key.trim().toLowerCase(),
    );
    if (normalizedKey) {
      const value = payload[normalizedKey];
      if (value !== null && value !== undefined && value !== "") return value;
    }
  }
  return null;
}

export function smartSupervisionString(value: unknown) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

export function smartSupervisionBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = smartSupervisionString(value)?.toLowerCase();
  if (["true", "1", "si", "sí", "yes"].includes(normalized ?? "")) return true;
  if (["false", "0", "no"].includes(normalized ?? "")) return false;
  return null;
}

