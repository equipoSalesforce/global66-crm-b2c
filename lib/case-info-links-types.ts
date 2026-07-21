export type CaseInfoLinkView =
  | "cases"
  | "qa"
  | "email"
  | "ai"
  | "history"
  | "activity"
  | "sla"
  | "calls";

export type RelatedCaseRecord = {
  id: string;
  assigned_to: string | null;
  case_number: string | null;
  numero_caso_seguimiento: string | null;
  contact_type: string | null;
  product: string | null;
  subproduct: string | null;
  category: string | null;
  cat_secundaria: string | null;
  ai_category: string | null;
  subject: string | null;
  description: string | null;
  status: string | null;
  lifecycle_status: string | null;
  area: string | null;
  channel: string | null;
  created_at: string | null;
};

export type RelatedCasesResponse = {
  items: RelatedCaseRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type CaseCallRecord = {
  id: string;
  aircall_call_id: string;
  case_id: string | null;
  customer_id: string | null;
  crm_user_id: string | null;
  aircall_user_id: string | null;
  aircall_user_name: string | null;
  aircall_user_email: string | null;
  direction: string | null;
  phone_number: string | null;
  customer_phone: string | null;
  aircall_number_id: string | null;
  aircall_number: string | null;
  status: string | null;
  result: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  asset_url: string | null;
  voicemail_url: string | null;
  tags: unknown;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CaseInfoSlaSummary = {
  ftrSeconds: number | null;
  artSeconds: number | null;
  ahtSeconds: number | null;
  ttrSeconds: number | null;
  responsePairs: number;
};
