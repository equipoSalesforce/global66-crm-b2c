export type SmartSupervisionJson = Record<string, unknown>;

export type SmartSupervisionEventType =
  | "MOMENTO_1_IMPORT"
  | "MOMENTO_1_ACK"
  | "MOMENTO_2_SENT"
  | "MOMENTO_3_SENT";

export type SmartSupervisionEventStatus =
  | "PENDING"
  | "SUCCESS"
  | "ERROR"
  | "SKIPPED";

export type SmartSupervisionComplaintPayload = SmartSupervisionJson & {
  Smart_Code__c?: unknown;
};

export type SmartSupervisionHttpResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T;
};

export type SmartSupervisionCustomFieldValue = {
  fieldDefinitionId: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  picklistValues: string[];
  value: unknown;
};

export type SmartSupervisionCaseSnapshot = {
  case: SmartSupervisionJson & { id: string };
  customer: SmartSupervisionJson | null;
  customerOperationalProfile: SmartSupervisionJson | null;
  externalReference: SmartSupervisionJson & {
    external_reference: string;
  };
  smartsupervisionComplaint: SmartSupervisionJson & {
    smart_code: string;
    source_payload: SmartSupervisionJson;
  };
  caseCustomFieldValues: SmartSupervisionCustomFieldValue[];
  lastOutboundEmailHtml: {
    html: string;
    source: "email_html_body" | "body_html" | "plain_text_fallback";
    messageId: string;
    createdAt: string | null;
  } | null;
};

export type SmartSupervisionPayloadBuildResult =
  | { ok: true; payload: SmartSupervisionJson }
  | { ok: false; missingFields: string[]; message: string };

export type SmartSupervisionFlowResult = {
  ok: boolean;
  skipped?: boolean;
  message: string;
  eventId?: string;
  response?: unknown;
};

