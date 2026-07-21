import { aircallPhoneMatches, normalizeAircallPhone } from "@/lib/aircall";
import {
  extractAircallCallId,
  extractAircallCaseId,
  extractAircallCustomerPhone,
  extractAircallEventType,
  mapAircallPayloadToCallPatch,
} from "@/lib/aircall-webhook";
import { supabase } from "@/lib/supabase";

type OpenCaseCandidate = {
  id: string;
  customer_id: string | null;
  contact_phone: string | null;
  status: string | null;
  lifecycle_status: string | null;
  customer: { phone: string | null } | null;
};

type PendingCallContext = {
  id: string;
  case_id: string;
  crm_user_id: string | null;
  aircall_user_id: string | null;
  phone_number: string;
  expires_at: string;
  created_at: string;
};

type StoredCallAssociation = {
  case_id: string | null;
  customer_id: string | null;
  crm_user_id: string | null;
  aircall_user_id: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
};

function identifiersMatch(left: string | null, right: string | null) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function callReferenceTime(
  callPatch: ReturnType<typeof mapAircallPayloadToCallPatch>,
  existingCall: StoredCallAssociation | null,
  receivedAt: string,
) {
  return (
    callPatch.started_at ??
    existingCall?.started_at ??
    callPatch.answered_at ??
    existingCall?.answered_at ??
    callPatch.ended_at ??
    existingCall?.ended_at ??
    receivedAt
  );
}

async function findPendingContext({
  aircallUserId,
  crmUserId,
  phoneNumber,
  referenceTime,
}: {
  aircallUserId: string | null;
  crmUserId: string | null;
  phoneNumber: string | null;
  referenceTime: string;
}) {
  if (!phoneNumber) return null;

  const { data, error } = await supabase
    .from("pending_aircall_call_contexts")
    .select("id, case_id, crm_user_id, aircall_user_id, phone_number, expires_at, created_at")
    .lte("created_at", referenceTime)
    .gte("expires_at", referenceTime)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<PendingCallContext[]>();

  if (error) {
    console.error("[aircall-webhook] pending context lookup error", error);
    return null;
  }

  const candidates = (data ?? []).filter((context) =>
    aircallPhoneMatches(context.phone_number, phoneNumber),
  );

  if (aircallUserId && crmUserId) {
    const exactUserContext = candidates.find(
      (context) =>
        identifiersMatch(context.aircall_user_id, aircallUserId) &&
        identifiersMatch(context.crm_user_id, crmUserId),
    );
    if (exactUserContext) return exactUserContext;
  }

  if (aircallUserId) {
    const aircallUserContext = candidates.find((context) =>
      identifiersMatch(context.aircall_user_id, aircallUserId),
    );
    if (aircallUserContext) return aircallUserContext;
  }

  if (crmUserId) {
    const crmUserContext = candidates.find((context) =>
      identifiersMatch(context.crm_user_id, crmUserId),
    );
    if (crmUserContext) return crmUserContext;
  }

  return candidates[0] ?? null;
}

async function findStoredCall(aircallCallId: string) {
  const { data, error } = await supabase
    .from("aircall_calls")
    .select("case_id, customer_id, crm_user_id, aircall_user_id, started_at, answered_at, ended_at")
    .eq("aircall_call_id", aircallCallId)
    .maybeSingle<StoredCallAssociation>();

  if (error) {
    console.error("[aircall-webhook] stored call lookup error", error);
    return null;
  }

  return data;
}

async function findCaseById(caseId: string | null) {
  if (!caseId) return null;

  const { data, error } = await supabase
    .from("cases")
    .select("id, customer_id")
    .eq("id", caseId)
    .maybeSingle<{ id: string; customer_id: string | null }>();

  if (error) {
    console.error("[aircall-webhook] explicit case lookup error", error);
    return null;
  }

  return data;
}

async function findOpenCaseByPhone(phoneNumber: string | null) {
  if (!phoneNumber) return null;

  const { data, error } = await supabase
    .from("cases")
    .select("id, customer_id, contact_phone, status, lifecycle_status, customer:customers(phone)")
    .neq("status", "CLOSED")
    .limit(200)
    .returns<OpenCaseCandidate[]>();

  if (error) {
    console.error("[aircall-webhook] case phone lookup error", error);
    return null;
  }

  return (
    (data ?? []).find((caseItem) => {
      const lifecycle = String(caseItem.lifecycle_status ?? "").toUpperCase();
      if (lifecycle === "CLOSED") return false;

      return (
        aircallPhoneMatches(caseItem.contact_phone, phoneNumber) ||
        aircallPhoneMatches(caseItem.customer?.phone, phoneNumber)
      );
    }) ?? null
  );
}

async function findAircallMapping(aircallUserId: string | null) {
  if (!aircallUserId) return null;

  const { data, error } = await supabase
    .from("crm_aircall_users")
    .select("crm_user_id, aircall_user_id, aircall_email, aircall_name, is_active")
    .eq("aircall_user_id", aircallUserId)
    .eq("is_active", true)
    .maybeSingle<{
      crm_user_id: string;
      aircall_user_id: string;
      aircall_email: string | null;
      aircall_name: string | null;
      is_active: boolean;
    }>();

  if (error) {
    console.error("[aircall-webhook] mapping lookup error", error);
    return null;
  }

  return data;
}

export async function POST(request: Request) {
  let payload: unknown;
  const receivedAt = new Date().toISOString();

  try {
    payload = await request.json();
  } catch (error) {
    console.error("[aircall-webhook] invalid json", error);
    return Response.json({ ok: true, ignored: true, reason: "invalid_json" });
  }

  const eventType = extractAircallEventType(payload);
  const aircallCallId = extractAircallCallId(payload);

  console.info("[aircall-webhook] received", {
    eventType,
    aircallCallId,
  });

  const { error: eventError } = await supabase.from("aircall_call_events").insert({
    aircall_call_id: aircallCallId,
    event_type: eventType,
    payload,
  });

  if (eventError) {
    console.error("[aircall-webhook] raw event insert error", eventError);
  }

  if (!aircallCallId) {
    return Response.json({ ok: true, ignored: true, reason: "missing_call_id" });
  }

  try {
    const callPatch = mapAircallPayloadToCallPatch(payload);
    const customerPhone = normalizeAircallPhone(extractAircallCustomerPhone(payload));
    const existingCall = await findStoredCall(aircallCallId);
    const effectiveAircallUserId = callPatch.aircall_user_id ?? existingCall?.aircall_user_id ?? null;
    const mapping = await findAircallMapping(effectiveAircallUserId);
    const referenceTime = callReferenceTime(callPatch, existingCall, receivedAt);
    const pendingContext = await findPendingContext({
      aircallUserId: effectiveAircallUserId,
      crmUserId: mapping?.crm_user_id ?? existingCall?.crm_user_id ?? null,
      phoneNumber: customerPhone,
      referenceTime,
    });
    const explicitCase = pendingContext
      ? null
      : await findCaseById(extractAircallCaseId(payload));
    const preservedCaseId = pendingContext || explicitCase ? null : existingCall?.case_id ?? null;
    const contextualCaseId = pendingContext?.case_id ?? explicitCase?.id ?? preservedCaseId;
    const openCase = contextualCaseId ? null : await findOpenCaseByPhone(customerPhone);
    const caseId = contextualCaseId ?? openCase?.id ?? null;
    const contextualCase = pendingContext
      ? await findCaseById(pendingContext.case_id)
      : explicitCase;
    const customerId =
      contextualCase?.customer_id ?? existingCall?.customer_id ?? openCase?.customer_id ?? null;
    const crmUserId =
      pendingContext?.crm_user_id ?? mapping?.crm_user_id ?? existingCall?.crm_user_id ?? null;
    const associationSource = pendingContext
      ? "pending_context"
      : explicitCase
        ? "explicit_case"
        : preservedCaseId
          ? "existing_call"
          : openCase
            ? "phone_fallback"
            : "unmatched";

    const upsertPayload = {
      ...callPatch,
      aircall_call_id: aircallCallId,
      aircall_user_id: effectiveAircallUserId,
      case_id: caseId,
      customer_id: customerId,
      crm_user_id: crmUserId,
      phone_number: customerPhone,
      customer_phone: customerPhone,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("aircall_calls")
      .upsert(upsertPayload, { onConflict: "aircall_call_id" });

    if (upsertError) {
      console.error("[aircall-webhook] call upsert error", upsertError);
      return Response.json({ ok: true, stored_event: true, call_upserted: false });
    }

    console.info("[aircall-webhook] call upserted", {
      aircallCallId,
      eventType,
      caseId,
      crmUserId,
      associationSource,
      referenceTime,
    });

    return Response.json({
      ok: true,
      stored_event: !eventError,
      call_upserted: true,
      case_id: caseId,
    });
  } catch (error) {
    console.error("[aircall-webhook] processing error", error);

    return Response.json({ ok: true, stored_event: !eventError, call_upserted: false });
  }
}
