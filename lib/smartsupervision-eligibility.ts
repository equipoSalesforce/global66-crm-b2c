import type { SmartSupervisionCaseSnapshot } from "@/lib/smartsupervision-types";
import {
  readSmartSupervisionValue,
  smartSupervisionString,
} from "@/lib/smartsupervision-payload";

export function isSmartSupervisionEligibleCase(
  snapshot: SmartSupervisionCaseSnapshot,
) {
  const category = smartSupervisionString(snapshot.case.category)?.toUpperCase();
  const channel = smartSupervisionString(snapshot.case.channel)?.toUpperCase();
  const profileCountry = smartSupervisionString(
    snapshot.customerOperationalProfile?.country_code ??
      snapshot.customerOperationalProfile?.country,
  );
  const sourceCountry = smartSupervisionString(
    readSmartSupervisionValue(
      snapshot.smartsupervisionComplaint.source_payload,
      "codigo_pais__c",
      "Country__c",
    ),
  );
  const country = (profileCountry || sourceCountry || "").toUpperCase();

  return category === "RECLAMO" &&
    channel !== "WHATSAPP" &&
    ["COL", "COLOMBIA"].includes(country) &&
    snapshot.externalReference.external_reference.length > 0 &&
    snapshot.smartsupervisionComplaint.smart_code.length > 0;
}

