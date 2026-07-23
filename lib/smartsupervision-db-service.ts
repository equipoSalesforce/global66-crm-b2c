import "server-only";

import { createHash } from "node:crypto";
import {
  createSmartSupervisionCaseReference,
  findCaseBySmartCode,
} from "@/lib/case-external-reference-service";
import { generateNextCaseNumber } from "@/lib/case-number";
import {
  findOrCreateSmartSupervisionCustomer,
  upsertSmartSupervisionCustomerProfile,
} from "@/lib/customer-operational-profile-service";
import {
  getSmartCode,
  mapSmartSupervisionComplaintToCase,
} from "@/lib/smartsupervision-case-mapper";
import { serializeSmartSupervisionError } from "@/lib/smartsupervision-errors";
import { populateSmartSupervisionCaseFields } from "@/lib/smartsupervision-field-value-service";
import type {
  SmartSupervisionComplaintPayload,
  SmartSupervisionEventStatus,
  SmartSupervisionEventType,
  SmartSupervisionJson,
} from "@/lib/smartsupervision-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ComplaintRecord = {
  id: string;
  smart_code: string;
  case_id: string | null;
  source_payload: SmartSupervisionComplaintPayload;
  import_status: "PENDING" | "IMPORTED" | "ERROR" | "SKIPPED";
  ack_status: "PENDING" | "ACKED" | "ERROR" | "NOT_REQUIRED";
};

export type SmartSupervisionEventRecord = {
  id: string;
  case_id: string;
  smart_code: string;
  event_type: SmartSupervisionEventType;
  status: SmartSupervisionEventStatus;
  request_payload: SmartSupervisionJson | null;
  response_payload: SmartSupervisionJson | null;
  error_message: string | null;
};

function deterministicCaseId(smartCode: string) {
  const bytes = Buffer.from(
    createHash("sha256").update(`SMARTSUPERVISION:${smartCode}`).digest().subarray(0, 16),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type SmartSupervisionImportStep =
  | "find_existing_case"
  | "resolve_or_create_customer"
  | "upsert_customer_operational_profile"
  | "insert_case"
  | "create_external_reference"
  | "upsert_case_custom_values"
  | "record_momento_1_event"
  | "mark_imported"
  | "mark_import_error";

function logImportStep(smartCode: string, step: SmartSupervisionImportStep) {
  if (process.env.NODE_ENV !== "development") return;
  console.info({
    tag: "[SmartSupervision Import Step]",
    smartCode,
    step,
  });
}

export async function upsertSmartSupervisionComplaint(
  payload: SmartSupervisionComplaintPayload,
  runId?: string | null,
) {
  const smartCode = getSmartCode(payload);
  const { data, error } = await getSupabaseAdmin()
    .from("smartsupervision_complaints")
    .upsert({
      smart_code: smartCode,
      source_payload: payload,
      sync_run_id: runId ?? null,
      received_at: new Date().toISOString(),
    }, { onConflict: "smart_code" })
    .select("id, smart_code, case_id, source_payload, import_status, ack_status")
    .single<ComplaintRecord>();
  if (error) throw error;
  return data;
}

export async function hasSuccessfulSmartSupervisionEvent(
  caseId: string,
  eventType: SmartSupervisionEventType,
) {
  const { data, error } = await getSupabaseAdmin()
    .from("smartsupervision_case_events")
    .select("id")
    .eq("case_id", caseId)
    .eq("event_type", eventType)
    .eq("status", "SUCCESS")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return Boolean(data);
}

export async function recordSmartSupervisionEvent(input: {
  caseId: string;
  smartCode: string;
  eventType: SmartSupervisionEventType;
  status: SmartSupervisionEventStatus;
  requestPayload?: SmartSupervisionJson | null;
  responsePayload?: SmartSupervisionJson | null;
  errorMessage?: string | null;
  triggeredBy?: string | null;
}) {
  if (
    input.status === "SUCCESS" &&
    await hasSuccessfulSmartSupervisionEvent(input.caseId, input.eventType)
  ) {
    const { data, error } = await getSupabaseAdmin()
      .from("smartsupervision_case_events")
      .select("*")
      .eq("case_id", input.caseId)
      .eq("event_type", input.eventType)
      .eq("status", "SUCCESS")
      .single<SmartSupervisionEventRecord>();
    if (error) throw error;
    return data;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("smartsupervision_case_events")
    .insert({
      case_id: input.caseId,
      smart_code: input.smartCode,
      event_type: input.eventType,
      status: input.status,
      request_payload: input.requestPayload ?? null,
      response_payload: input.responsePayload ?? null,
      error_message: input.errorMessage ?? null,
      triggered_by: input.triggeredBy ?? null,
      sent_at: input.status === "SUCCESS" ? new Date().toISOString() : null,
    })
    .select("*")
    .single<SmartSupervisionEventRecord>();
  if (error?.code === "23505" && input.status === "SUCCESS") {
    const { data: existing, error: existingError } = await getSupabaseAdmin()
      .from("smartsupervision_case_events")
      .select("*")
      .eq("case_id", input.caseId)
      .eq("event_type", input.eventType)
      .eq("status", "SUCCESS")
      .single<SmartSupervisionEventRecord>();
    if (existingError) throw existingError;
    return existing;
  }
  if (error) throw error;
  return data;
}

async function markComplaintImport(input: {
  smartCode: string;
  caseId?: string | null;
  status: "IMPORTED" | "ERROR" | "SKIPPED";
  error?: string | null;
}) {
  const { error } = await getSupabaseAdmin()
    .from("smartsupervision_complaints")
    .update({
      case_id: input.caseId ?? null,
      import_status: input.status,
      import_error: input.error ?? null,
      imported_at: input.status === "IMPORTED" ? new Date().toISOString() : null,
    })
    .eq("smart_code", input.smartCode);
  if (error) throw error;
}

export async function createCaseFromSmartSupervisionComplaint(
  complaint: ComplaintRecord,
) {
  const smartCode = complaint.smart_code;
  let step: SmartSupervisionImportStep = "find_existing_case";
  let caseIdForError: string | null = null;

  try {
    logImportStep(smartCode, step);
    const existingReference = await findCaseBySmartCode(smartCode);
    if (existingReference) {
      caseIdForError = existingReference.case_id;
      const { data: existingCase, error: caseLookupError } = await getSupabaseAdmin()
        .from("cases")
        .select("customer_id")
        .eq("id", existingReference.case_id)
        .maybeSingle<{ customer_id: string | null }>();
      if (caseLookupError) throw caseLookupError;
      if (existingCase?.customer_id) {
        const { data: customer, error: customerError } = await getSupabaseAdmin()
          .from("customers")
          .select("id, customer_id, name, email, phone")
          .eq("id", existingCase.customer_id)
          .single<{
            id: string;
            customer_id: string | null;
            name: string | null;
            email: string | null;
            phone: string | null;
          }>();
        if (customerError) throw customerError;
        step = "upsert_customer_operational_profile";
        logImportStep(smartCode, step);
        await upsertSmartSupervisionCustomerProfile(customer, complaint.source_payload);
      }
      step = "upsert_case_custom_values";
      logImportStep(smartCode, step);
      const warnings = await populateSmartSupervisionCaseFields(
        existingReference.case_id,
        complaint.source_payload,
      );
      step = "mark_imported";
      logImportStep(smartCode, step);
      await markComplaintImport({
        smartCode,
        caseId: existingReference.case_id,
        status: "IMPORTED",
      });
      step = "record_momento_1_event";
      logImportStep(smartCode, step);
      await recordSmartSupervisionEvent({
        caseId: existingReference.case_id,
        smartCode,
        eventType: "MOMENTO_1_IMPORT",
        status: "SUCCESS",
        requestPayload: complaint.source_payload,
        responsePayload: { warnings, reusedCase: true },
      });
      return { caseId: existingReference.case_id, smartCode, reused: true, warnings };
    }

    const caseId = deterministicCaseId(smartCode);
    caseIdForError = caseId;
    step = "resolve_or_create_customer";
    logImportStep(smartCode, step);
    const customer = await findOrCreateSmartSupervisionCustomer(complaint.source_payload);
    step = "upsert_customer_operational_profile";
    logImportStep(smartCode, step);
    await upsertSmartSupervisionCustomerProfile(customer, complaint.source_payload);
    step = "insert_case";
    logImportStep(smartCode, step);
    const caseNumber = await generateNextCaseNumber();
    const mappedCase = mapSmartSupervisionComplaintToCase(
      complaint.source_payload,
      customer.id,
      caseNumber,
    );

    const { error: caseError } = await getSupabaseAdmin()
      .from("cases")
      .insert({ id: caseId, ...mappedCase });
    if (caseError && caseError.code !== "23505") throw caseError;

    step = "create_external_reference";
    logImportStep(smartCode, step);
    let reference = await findCaseBySmartCode(smartCode);
    if (!reference) {
      try {
        reference = await createSmartSupervisionCaseReference({
          caseId,
          smartCode,
          externalSystemId: typeof complaint.source_payload.Case_id === "string"
            ? complaint.source_payload.Case_id
            : null,
          metadata: { importedFrom: "MOMENTO_1" },
        });
      } catch (referenceError) {
        reference = await findCaseBySmartCode(smartCode);
        if (!reference) throw referenceError;
      }
    }

    step = "upsert_case_custom_values";
    logImportStep(smartCode, step);
    const warnings = await populateSmartSupervisionCaseFields(
      reference.case_id,
      complaint.source_payload,
    );
    step = "mark_imported";
    logImportStep(smartCode, step);
    await markComplaintImport({ smartCode, caseId: reference.case_id, status: "IMPORTED" });
    step = "record_momento_1_event";
    logImportStep(smartCode, step);
    await recordSmartSupervisionEvent({
      caseId: reference.case_id,
      smartCode,
      eventType: "MOMENTO_1_IMPORT",
      status: "SUCCESS",
      requestPayload: complaint.source_payload,
      responsePayload: { warnings, reusedCase: caseError?.code === "23505" },
    });
    return { caseId: reference.case_id, smartCode, reused: Boolean(caseError), warnings };
  } catch (error) {
    const message = serializeSmartSupervisionError(error);
    if (process.env.NODE_ENV === "development") {
      console.error({
        tag: "[SmartSupervision Import Error]",
        smartCode,
        step,
        error: message,
      });
    }

    try {
      let persistedCaseId: string | null = null;
      if (caseIdForError) {
        const { data: caseRow, error: caseLookupError } = await getSupabaseAdmin()
          .from("cases")
          .select("id")
          .eq("id", caseIdForError)
          .maybeSingle<{ id: string }>();
        if (caseLookupError) throw caseLookupError;
        persistedCaseId = caseRow?.id ?? null;
      }

      logImportStep(smartCode, "mark_import_error");
      await markComplaintImport({
        smartCode,
        caseId: persistedCaseId,
        status: "ERROR",
        error: message,
      });
      if (persistedCaseId) {
        await recordSmartSupervisionEvent({
          caseId: persistedCaseId,
          smartCode,
          eventType: "MOMENTO_1_IMPORT",
          status: "ERROR",
          requestPayload: complaint.source_payload,
          errorMessage: message,
        });
      }
    } catch (persistenceError) {
      if (process.env.NODE_ENV === "development") {
        console.error({
          tag: "[SmartSupervision Import Error]",
          smartCode,
          step: "mark_import_error",
          error: serializeSmartSupervisionError(persistenceError),
        });
      }
    }
    throw error;
  }
}

export async function markSmartSupervisionAckSuccess(ids: string[]) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("smartsupervision_complaints")
    .update({ ack_status: "ACKED", ack_error: null, acked_at: now })
    .in("smart_code", ids)
    .select("smart_code, case_id")
    .returns<Array<{ smart_code: string; case_id: string | null }>>();
  if (error) throw error;
  for (const complaint of data ?? []) {
    if (!complaint.case_id) continue;
    await recordSmartSupervisionEvent({
      caseId: complaint.case_id,
      smartCode: complaint.smart_code,
      eventType: "MOMENTO_1_ACK",
      status: "SUCCESS",
      responsePayload: { acknowledgedAt: now },
    });
  }
}

export async function markSmartSupervisionAckError(ids: string[], ackError: string) {
  const { error } = await getSupabaseAdmin()
    .from("smartsupervision_complaints")
    .update({ ack_status: "ERROR", ack_error: ackError })
    .in("smart_code", ids);
  if (error) throw error;
}

export async function createSmartSupervisionSyncRun(
  runType: "MOMENTO_1_DAILY" | "MANUAL_TEST",
) {
  const { data, error } = await getSupabaseAdmin()
    .from("smartsupervision_sync_runs")
    .insert({
      run_type: runType,
      status: "RUNNING",
      request_payload: { mode: runType },
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function finishSmartSupervisionSyncRun(input: {
  runId: string;
  status: "SUCCESS" | "ERROR" | "PARTIAL_SUCCESS";
  totalReceived: number;
  totalImported: number;
  totalAcknowledged: number;
  totalErrors: number;
  responsePayload?: SmartSupervisionJson | null;
  errorMessage?: string | null;
}) {
  const { error } = await getSupabaseAdmin()
    .from("smartsupervision_sync_runs")
    .update({
      status: input.status,
      finished_at: new Date().toISOString(),
      total_received: input.totalReceived,
      total_imported: input.totalImported,
      total_acknowledged: input.totalAcknowledged,
      total_errors: input.totalErrors,
      response_payload: input.responsePayload ?? null,
      error_message: input.errorMessage ?? null,
    })
    .eq("id", input.runId);
  if (error) throw error;
}
