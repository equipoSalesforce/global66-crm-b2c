import "server-only";

import { getCustomerOperationalProfile } from "@/lib/customer-operational-profile-service";
import { getCaseCustomFieldValues } from "@/lib/smartsupervision-field-value-service";
import type {
  SmartSupervisionCaseSnapshot,
  SmartSupervisionJson,
} from "@/lib/smartsupervision-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type MessageRecord = {
  id: string;
  body: string | null;
  email_html_body: string | null;
  email_text_body: string | null;
  created_at: string | null;
};

function looksLikeHtml(value: string) {
  return /<([a-z][^>]*)\b[^>]*>/i.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function getLastOutboundCaseEmailHtml(caseId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("messages")
    .select("id, body, email_html_body, email_text_body, created_at")
    .eq("case_id", caseId)
    .eq("direction", "OUTBOUND")
    .or("message_type.eq.EMAIL,channel.eq.GMAIL,email_html_body.not.is.null")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<MessageRecord>();
  if (error) throw error;
  if (!data) return null;

  if (data.email_html_body?.trim()) {
    return {
      html: data.email_html_body,
      source: "email_html_body" as const,
      messageId: data.id,
      createdAt: data.created_at,
    };
  }
  if (data.body?.trim() && looksLikeHtml(data.body)) {
    return {
      html: data.body,
      source: "body_html" as const,
      messageId: data.id,
      createdAt: data.created_at,
    };
  }
  const plainText = data.email_text_body?.trim() || data.body?.trim();
  if (!plainText) return null;
  return {
    html: `<!-- plain-text-fallback --><p>${escapeHtml(plainText).replaceAll("\n", "<br>")}</p>`,
    source: "plain_text_fallback" as const,
    messageId: data.id,
    createdAt: data.created_at,
  };
}

export async function getSmartSupervisionCaseSnapshot(
  caseId: string,
): Promise<SmartSupervisionCaseSnapshot> {
  const { data: caseItem, error: caseError } = await getSupabaseAdmin()
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle<SmartSupervisionJson & { id: string; customer_id?: string | null }>();
  if (caseError) throw caseError;
  if (!caseItem) throw new Error("Caso no encontrado.");

  const { data: externalReference, error: externalError } = await getSupabaseAdmin()
    .from("case_external_references")
    .select("*")
    .eq("case_id", caseId)
    .eq("external_source", "SMARTSUPERVISION")
    .maybeSingle<SmartSupervisionJson & { external_reference: string }>();
  if (externalError) throw externalError;
  if (!externalReference) throw new Error("El caso no tiene referencia SmartSupervisión.");

  const smartCode = externalReference.external_reference;
  const [customerResult, profile, complaintResult, customValues, lastOutboundEmailHtml] =
    await Promise.all([
      caseItem.customer_id
        ? getSupabaseAdmin().from("customers").select("*").eq("id", caseItem.customer_id)
            .maybeSingle<SmartSupervisionJson>()
        : Promise.resolve({ data: null, error: null }),
      caseItem.customer_id
        ? getCustomerOperationalProfile(caseItem.customer_id)
        : Promise.resolve(null),
      getSupabaseAdmin().from("smartsupervision_complaints").select("*")
        .eq("smart_code", smartCode)
        .maybeSingle<SmartSupervisionJson & {
          smart_code: string;
          source_payload: SmartSupervisionJson;
        }>(),
      getCaseCustomFieldValues(caseId),
      getLastOutboundCaseEmailHtml(caseId),
    ]);

  if (customerResult.error) throw customerResult.error;
  if (complaintResult.error) throw complaintResult.error;
  if (!complaintResult.data) throw new Error("No existe complaint SmartSupervisión para el caso.");

  return {
    case: caseItem,
    customer: customerResult.data,
    customerOperationalProfile: profile,
    externalReference,
    smartsupervisionComplaint: complaintResult.data,
    caseCustomFieldValues: customValues,
    lastOutboundEmailHtml,
  };
}
