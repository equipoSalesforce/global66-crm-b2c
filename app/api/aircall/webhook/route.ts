import { aircallPhoneMatches, normalizeAircallPhone } from "@/lib/aircall";
import {
  extractAircallCallId,
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

async function findPendingContext(aircallUserId: string | null, phoneNumber: string | null) {
  if (!aircallUserId || !phoneNumber) return null;

  const { data, error } = await supabase
    .from("pending_aircall_call_contexts")
    .select("id, case_id, crm_user_id, aircall_user_id, phone_number, expires_at")
    .eq("aircall_user_id", aircallUserId)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<
      {
        id: string;
        case_id: string;
        crm_user_id: string | null;
        aircall_user_id: string | null;
        phone_number: string;
        expires_at: string;
      }[]
    >();

  if (error) {
    console.error("[aircall-webhook] pending context lookup error", error);
    return null;
  }

  return (data ?? []).find((context) =>
    aircallPhoneMatches(context.phone_number, phoneNumber),
  ) ?? null;
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
    const mapping = await findAircallMapping(callPatch.aircall_user_id);
    const pendingContext = await findPendingContext(
      callPatch.aircall_user_id,
      customerPhone,
    );
    const openCase = pendingContext ? null : await findOpenCaseByPhone(customerPhone);

    const caseId = pendingContext?.case_id ?? openCase?.id ?? null;
    const customerId = openCase?.customer_id ?? null;
    const crmUserId = pendingContext?.crm_user_id ?? mapping?.crm_user_id ?? null;

    const upsertPayload = {
      ...callPatch,
      aircall_call_id: aircallCallId,
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
