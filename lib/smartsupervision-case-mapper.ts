import "server-only";

import {
  readSmartSupervisionValue,
  smartSupervisionString,
} from "@/lib/smartsupervision-payload";
import type { SmartSupervisionComplaintPayload } from "@/lib/smartsupervision-types";

export function getSmartCode(payload: SmartSupervisionComplaintPayload) {
  const smartCode = smartSupervisionString(
    readSmartSupervisionValue(payload, "Smart_Code__c"),
  );
  if (!smartCode) throw new Error("La queja no contiene Smart_Code__c.");
  return smartCode;
}

function validCreatedAt(value: unknown) {
  const raw = smartSupervisionString(value);
  if (!raw) return new Date().toISOString();
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function mapSmartSupervisionComplaintToCase(
  payload: SmartSupervisionComplaintPayload,
  customerId: string,
  caseNumber: string,
) {
  const smartCode = getSmartCode(payload);
  const sourceChannel = smartSupervisionString(
    readSmartSupervisionValue(payload, "canal__c"),
  );
  const channel = sourceChannel?.toLowerCase() === "internet" ? "WEB" : "MANUAL";
  const product = smartSupervisionString(
    readSmartSupervisionValue(payload, "Product__c", "smart_Producto_nombre__c"),
  );

  return {
    case_number: caseNumber,
    customer_id: customerId,
    category: "RECLAMO",
    channel,
    contact_type: channel,
    area: "COMPLIANCE",
    priority: "MEDIUM",
    status: "HUMAN_REQUIRED",
    lifecycle_status: "NEW",
    routing_status: "UNASSIGNED",
    response_status: "NO_AGENT_ACTIVITY",
    subject: `Reclamo SmartSupervisión - ${smartCode}`,
    description: smartSupervisionString(readSmartSupervisionValue(payload, "Description")),
    contact_name: smartSupervisionString(readSmartSupervisionValue(payload, "SuppliedName")),
    contact_email: smartSupervisionString(readSmartSupervisionValue(payload, "SuppliedEmail")),
    contact_phone: smartSupervisionString(readSmartSupervisionValue(payload, "SuppliedPhone")),
    product,
    created_at: validCreatedAt(readSmartSupervisionValue(payload, "CreatedDate")),
    updated_at: new Date().toISOString(),
  };
}

