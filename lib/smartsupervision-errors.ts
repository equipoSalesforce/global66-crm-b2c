import "server-only";

type ErrorRecord = Record<string, unknown>;

function stringField(record: ErrorRecord, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeJsonStringify(value: unknown) {
  const seen = new WeakSet<object>();
  try {
    const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => {
      if (typeof nestedValue === "bigint") return nestedValue.toString();
      if (nestedValue !== null && typeof nestedValue === "object") {
        if (seen.has(nestedValue)) return "[Circular]";
        seen.add(nestedValue);
      }
      return nestedValue;
    });
    return serialized ?? Object.prototype.toString.call(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

export function serializeSmartSupervisionError(error: unknown): string {
  if (error === null || error === undefined) return "Unknown error";
  if (typeof error === "string") return error;

  if (error instanceof Error) {
    const message = error.message || error.name || "Unknown error";
    if (process.env.NODE_ENV === "development" && error.stack) {
      return `${message}\n${error.stack}`;
    }
    return message;
  }

  if (typeof error === "object") {
    const record = error as ErrorRecord;
    const code = stringField(record, "code");
    const message = stringField(record, "message");
    const details = stringField(record, "details");
    const hint = stringField(record, "hint");

    if (message && (code || details || hint)) {
      const prefix = code ? `Supabase error ${code}` : "Supabase error";
      return [
        `${prefix}: ${message}`,
        details ? `details: ${details}` : null,
        hint ? `hint: ${hint}` : null,
      ].filter(Boolean).join(" | ");
    }

    return safeJsonStringify(error);
  }

  return String(error);
}
