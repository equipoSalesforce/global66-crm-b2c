import { normalizeAircallPhone } from "./aircall";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function firstRecord(...values: unknown[]) {
  return values.find(isRecord) as JsonRecord | undefined;
}

function getPath(payload: unknown, path: string[]) {
  let current: unknown = payload;

  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }

  return current;
}

function firstString(payload: unknown, paths: string[][]) {
  for (const path of paths) {
    const value = getPath(payload, path);

    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return null;
}

function firstNumber(payload: unknown, paths: string[][]) {
  for (const path of paths) {
    const value = getPath(payload, path);

    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function asIsoTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    return new Date(milliseconds).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue) && value.length <= 13) {
      return asIsoTimestamp(numericValue);
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return null;
}

function getCallData(payload: unknown) {
  if (!isRecord(payload)) return {};

  return firstRecord(payload.data, payload.call, payload.resource, payload) ?? {};
}

function getUserData(payload: unknown) {
  const call = getCallData(payload);

  return firstRecord(
    call.user,
    call.aircall_user,
    call.assigned_to,
    call.teammate,
    getPath(payload, ["data", "user"]),
  );
}

function getCustomerData(payload: unknown) {
  const call = getCallData(payload);

  return firstRecord(call.customer, call.contact, call.person, getPath(payload, ["data", "customer"]));
}

function getNumberData(payload: unknown) {
  const call = getCallData(payload);

  return firstRecord(call.number, call.aircall_number, getPath(payload, ["data", "number"]));
}

export function extractAircallEventType(payload: unknown) {
  return (
    firstString(payload, [
      ["event"],
      ["event_type"],
      ["type"],
      ["name"],
    ]) ?? "unknown"
  );
}

export function extractAircallCallId(payload: unknown) {
  const call = getCallData(payload);

  return firstString(call, [["id"], ["call_id"], ["uuid"], ["aircall_call_id"]]);
}

export function extractAircallUserId(payload: unknown) {
  const user = getUserData(payload);
  const call = getCallData(payload);

  return (
    firstString(user, [["id"], ["user_id"], ["aircall_user_id"]]) ??
    firstString(call, [["user_id"], ["aircall_user_id"]])
  );
}

export function extractAircallUserName(payload: unknown) {
  const user = getUserData(payload);

  const fullName = firstString(user, [["name"], ["full_name"]]);
  if (fullName) return fullName;

  const firstName = firstString(user, [["first_name"], ["firstname"]]);
  const lastName = firstString(user, [["last_name"], ["lastname"]]);

  return [firstName, lastName].filter(Boolean).join(" ") || null;
}

export function extractAircallUserEmail(payload: unknown) {
  const user = getUserData(payload);

  return firstString(user, [["email"], ["mail"]]);
}

export function extractAircallCustomerPhone(payload: unknown) {
  const call = getCallData(payload);
  const customer = getCustomerData(payload);
  const direction = extractAircallDirection(payload);
  const from = firstString(call, [["from"], ["raw_digits_from"]]);
  const to = firstString(call, [["to"], ["raw_digits_to"]]);

  const phone =
    firstString(customer, [["phone"], ["phone_number"], ["number"], ["raw_digits"]]) ??
    firstString(call, [
      ["customer_phone"],
      ["phone_number"],
      ["raw_digits"],
      ["contact_phone"],
    ]) ??
    (direction === "outbound" ? to : from) ??
    from ??
    to;

  return phone ? normalizeAircallPhone(phone) : null;
}

export function extractAircallNumber(payload: unknown) {
  const number = getNumberData(payload);
  const call = getCallData(payload);

  const value =
    firstString(number, [["digits"], ["phone_number"], ["number"], ["name"]]) ??
    firstString(call, [["aircall_number"], ["number"]]);

  return value ? normalizeAircallPhone(value) : null;
}

export function extractAircallNumberId(payload: unknown) {
  const number = getNumberData(payload);
  const call = getCallData(payload);

  return (
    firstString(number, [["id"], ["number_id"], ["aircall_number_id"]]) ??
    firstString(call, [["number_id"], ["aircall_number_id"]])
  );
}

export function extractAircallDirection(payload: unknown) {
  const call = getCallData(payload);
  const direction = firstString(call, [["direction"], ["call_direction"]]);

  if (!direction) return null;
  return direction.toLowerCase();
}

export function extractAircallRecordingUrl(payload: unknown) {
  const call = getCallData(payload);

  return firstString(call, [
    ["recording"],
    ["recording_url"],
    ["recording", "url"],
  ]);
}

export function extractAircallAssetUrl(payload: unknown) {
  const call = getCallData(payload);

  return firstString(call, [["asset"], ["asset_url"], ["asset", "url"], ["direct_link"]]);
}

export function extractAircallVoicemailUrl(payload: unknown) {
  const call = getCallData(payload);

  return firstString(call, [
    ["voicemail"],
    ["voicemail_url"],
    ["voicemail", "url"],
  ]);
}

export function extractAircallDuration(payload: unknown) {
  const call = getCallData(payload);

  return firstNumber(call, [["duration"], ["duration_seconds"], ["recording_duration"]]);
}

export function extractAircallTags(payload: unknown) {
  const call = getCallData(payload);
  const tags = call.tags ?? call.tag_list;

  return Array.isArray(tags) ? tags : null;
}

export function extractAircallNotes(payload: unknown) {
  const call = getCallData(payload);
  const comments = call.comments;

  if (typeof call.notes === "string") return call.notes;
  if (typeof call.comment === "string") return call.comment;
  if (isRecord(call.comment) && typeof call.comment.content === "string") {
    return call.comment.content;
  }
  if (Array.isArray(comments)) {
    return comments
      .map((comment) => {
        if (typeof comment === "string") return comment;
        if (isRecord(comment) && typeof comment.content === "string") return comment.content;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return null;
}

export function mapAircallPayloadToCallPatch(payload: unknown) {
  const call = getCallData(payload);
  const eventType = extractAircallEventType(payload);
  const startedAt = asIsoTimestamp(
    call.started_at ?? call.startedAt ?? call.created_at ?? call.createdAt,
  );
  const answeredAt = asIsoTimestamp(call.answered_at ?? call.answeredAt);
  const endedAt = asIsoTimestamp(call.ended_at ?? call.endedAt ?? call.hungup_at);

  return {
    aircall_call_id: extractAircallCallId(payload),
    aircall_user_id: extractAircallUserId(payload),
    aircall_user_name: extractAircallUserName(payload),
    aircall_user_email: extractAircallUserEmail(payload),
    direction: extractAircallDirection(payload),
    phone_number: extractAircallCustomerPhone(payload),
    customer_phone: extractAircallCustomerPhone(payload),
    aircall_number_id: extractAircallNumberId(payload),
    aircall_number: extractAircallNumber(payload),
    status:
      firstString(call, [["status"], ["state"]]) ??
      eventType.replace(/^call\./, ""),
    result: firstString(call, [["result"], ["answered_status"], ["missed_call_reason"]]),
    started_at: startedAt,
    answered_at: answeredAt,
    ended_at: endedAt,
    duration_seconds: extractAircallDuration(payload),
    recording_url: extractAircallRecordingUrl(payload),
    asset_url: extractAircallAssetUrl(payload),
    voicemail_url: extractAircallVoicemailUrl(payload),
    tags: extractAircallTags(payload),
    notes: extractAircallNotes(payload),
    raw_payload: payload,
  };
}
