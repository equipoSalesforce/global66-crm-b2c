import "server-only";

import {
  fetchMomento1Complaints,
  sendMomento1Ack,
  sendSmartSupervisionDispatch,
  SmartSupervisionClientError,
} from "@/lib/smartsupervision-client";
import { getSmartSupervisionCaseSnapshot } from "@/lib/smartsupervision-case-snapshot";
import {
  buildSmartSupervisionMoment2Payload,
  buildSmartSupervisionMoment3Payload,
} from "@/lib/smartsupervision-dispatch-mapper";
import {
  createCaseFromSmartSupervisionComplaint,
  createSmartSupervisionSyncRun,
  finishSmartSupervisionSyncRun,
  hasSuccessfulSmartSupervisionEvent,
  markSmartSupervisionAckError,
  markSmartSupervisionAckSuccess,
  recordSmartSupervisionEvent,
  upsertSmartSupervisionComplaint,
} from "@/lib/smartsupervision-db-service";
import { serializeSmartSupervisionError } from "@/lib/smartsupervision-errors";
import { isSmartSupervisionEligibleCase } from "@/lib/smartsupervision-eligibility";
import type {
  SmartSupervisionEventType,
  SmartSupervisionFlowResult,
  SmartSupervisionJson,
  SmartSupervisionPayloadBuildResult,
} from "@/lib/smartsupervision-types";

export async function runSmartSupervisionMoment1Import({
  mode,
}: {
  mode: "MOMENTO_1_DAILY" | "MANUAL_TEST";
}) {
  const runId = await createSmartSupervisionSyncRun(mode);
  let totalReceived = 0;
  let totalImported = 0;
  let totalAcknowledged = 0;
  let totalErrors = 0;
  const importedCodes: string[] = [];
  const errors: Array<{ smartCode?: string; error: string }> = [];

  try {
    const response = await fetchMomento1Complaints();
    totalReceived = response.data.length;

    for (const payload of response.data) {
      let complaint;
      try {
        if (process.env.NODE_ENV === "development") {
          console.info({
            tag: "[SmartSupervision Import Step]",
            smartCode: payload.Smart_Code__c ?? null,
            step: "upsert_complaint",
          });
        }
        complaint = await upsertSmartSupervisionComplaint(payload, runId);
        const imported = await createCaseFromSmartSupervisionComplaint(complaint);
        if (complaint.ack_status !== "ACKED") importedCodes.push(imported.smartCode);
        totalImported += 1;
      } catch (error) {
        totalErrors += 1;
        errors.push({
          smartCode: complaint?.smart_code,
          error: serializeSmartSupervisionError(error),
        });
      }
    }

    if (importedCodes.length > 0) {
      try {
        await sendMomento1Ack(importedCodes);
        await markSmartSupervisionAckSuccess(importedCodes);
        totalAcknowledged = importedCodes.length;
      } catch (error) {
        const message = serializeSmartSupervisionError(error);
        await markSmartSupervisionAckError(importedCodes, message);
        totalErrors += importedCodes.length;
        errors.push({ error: `ACK: ${message}` });
      }
    }

    const status = totalErrors === 0
      ? "SUCCESS"
      : totalImported > 0
        ? "PARTIAL_SUCCESS"
        : "ERROR";
    await finishSmartSupervisionSyncRun({
      runId,
      status,
      totalReceived,
      totalImported,
      totalAcknowledged,
      totalErrors,
      responsePayload: { complaints: response.data, importedCodes, errors },
    });
    return {
      ok: status !== "ERROR",
      runId,
      status,
      total_received: totalReceived,
      total_imported: totalImported,
      total_acknowledged: totalAcknowledged,
      total_errors: totalErrors,
      errors,
    };
  } catch (error) {
    const message = serializeSmartSupervisionError(error);
    await finishSmartSupervisionSyncRun({
      runId,
      status: "ERROR",
      totalReceived,
      totalImported,
      totalAcknowledged,
      totalErrors: Math.max(totalErrors, 1),
      errorMessage: message,
      responsePayload: {
        errors,
        upstream: error instanceof SmartSupervisionClientError
          ? error.response
          : null,
      },
    });
    throw error;
  }
}

async function sendMomentForCase(input: {
  caseId: string;
  eventType: Extract<SmartSupervisionEventType, "MOMENTO_2_SENT" | "MOMENTO_3_SENT">;
  triggeredBy?: string;
  buildPayload: (
    snapshot: Awaited<ReturnType<typeof getSmartSupervisionCaseSnapshot>>,
  ) => SmartSupervisionPayloadBuildResult;
}): Promise<SmartSupervisionFlowResult> {
  const snapshot = await getSmartSupervisionCaseSnapshot(input.caseId);
  const smartCode = snapshot.externalReference.external_reference;
  if (!isSmartSupervisionEligibleCase(snapshot)) {
    const event = await recordSmartSupervisionEvent({
      caseId: input.caseId,
      smartCode,
      eventType: input.eventType,
      status: "SKIPPED",
      triggeredBy: input.triggeredBy,
      errorMessage: "El caso no cumple la elegibilidad SmartSupervisión.",
    });
    return { ok: false, skipped: true, eventId: event.id, message: event.error_message ?? "Caso no elegible." };
  }
  if (await hasSuccessfulSmartSupervisionEvent(input.caseId, input.eventType)) {
    return { ok: true, skipped: true, message: `${input.eventType} ya fue enviado correctamente.` };
  }

  const built = input.buildPayload(snapshot);
  if (!built.ok) {
    const event = await recordSmartSupervisionEvent({
      caseId: input.caseId,
      smartCode,
      eventType: input.eventType,
      status: "ERROR",
      triggeredBy: input.triggeredBy,
      responsePayload: { missingFields: built.missingFields },
      errorMessage: built.message,
    });
    return { ok: false, eventId: event.id, message: built.message };
  }

  try {
    const response = await sendSmartSupervisionDispatch(built.payload);
    const event = await recordSmartSupervisionEvent({
      caseId: input.caseId,
      smartCode,
      eventType: input.eventType,
      status: "SUCCESS",
      triggeredBy: input.triggeredBy,
      requestPayload: built.payload,
      responsePayload: { httpStatus: response.status, data: response.data },
    });
    return {
      ok: true,
      eventId: event.id,
      message: `${input.eventType} enviado correctamente.`,
      response: response.data,
    };
  } catch (error) {
    const message = serializeSmartSupervisionError(error);
    const responsePayload: SmartSupervisionJson = error instanceof SmartSupervisionClientError
      ? { httpStatus: error.status, data: error.response }
      : {};
    const event = await recordSmartSupervisionEvent({
      caseId: input.caseId,
      smartCode,
      eventType: input.eventType,
      status: "ERROR",
      triggeredBy: input.triggeredBy,
      requestPayload: built.payload,
      responsePayload,
      errorMessage: message,
    });
    return { ok: false, eventId: event.id, message };
  }
}

export function sendSmartSupervisionMoment2ForCase(caseId: string, triggeredBy?: string) {
  return sendMomentForCase({
    caseId,
    eventType: "MOMENTO_2_SENT",
    triggeredBy,
    buildPayload: buildSmartSupervisionMoment2Payload,
  });
}

export function sendSmartSupervisionMoment3ForCase(caseId: string, triggeredBy?: string) {
  return sendMomentForCase({
    caseId,
    eventType: "MOMENTO_3_SENT",
    triggeredBy,
    buildPayload: buildSmartSupervisionMoment3Payload,
  });
}
