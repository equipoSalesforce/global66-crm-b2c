import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const SMARTSUPERVISION_EXTERNAL_SOURCE = "SMARTSUPERVISION";

export type CaseExternalReferenceRecord = {
  id: string;
  case_id: string;
  external_source: string;
  external_reference: string;
  external_system_id: string | null;
  external_url: string | null;
  metadata: Record<string, unknown>;
};

export async function findCaseBySmartCode(smartCode: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("case_external_references")
    .select("id, case_id, external_source, external_reference, external_system_id, external_url, metadata")
    .eq("external_source", SMARTSUPERVISION_EXTERNAL_SOURCE)
    .eq("external_reference", smartCode)
    .maybeSingle<CaseExternalReferenceRecord>();
  if (error) throw error;
  return data;
}

export async function createSmartSupervisionCaseReference(input: {
  caseId: string;
  smartCode: string;
  externalSystemId?: string | null;
  externalUrl?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await getSupabaseAdmin()
    .from("case_external_references")
    .insert({
      case_id: input.caseId,
      external_source: SMARTSUPERVISION_EXTERNAL_SOURCE,
      external_reference: input.smartCode,
      external_system_id: input.externalSystemId ?? null,
      external_url: input.externalUrl ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id, case_id, external_source, external_reference, external_system_id, external_url, metadata")
    .single<CaseExternalReferenceRecord>();
  if (error) throw error;
  return data;
}
