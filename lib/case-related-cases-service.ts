import "server-only";

import { supabase } from "@/lib/supabase";
import type {
  RelatedCaseRecord,
  RelatedCasesResponse,
} from "@/lib/case-info-links-types";

const relatedCaseSelect = [
  "id",
  "assigned_to",
  "case_number",
  "numero_caso_seguimiento",
  "contact_type",
  "product",
  "subproduct",
  "category",
  "cat_secundaria",
  "ai_category",
  "subject",
  "description",
  "status",
  "lifecycle_status",
  "area",
  "channel",
  "created_at",
].join(",");

export async function getRelatedCases({
  caseId,
  page,
  pageSize,
}: {
  caseId: string;
  page: number;
  pageSize: number;
}): Promise<RelatedCasesResponse> {
  const { data: currentCase, error: caseError } = await supabase
    .from("cases")
    .select("customer_id")
    .eq("id", caseId)
    .maybeSingle<{ customer_id: string | null }>();

  if (caseError) throw new Error(caseError.message);
  if (!currentCase) throw new Error("El caso no existe.");
  if (!currentCase.customer_id) return { items: [], total: 0, page, pageSize };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("cases")
    .select(relatedCaseSelect, { count: "exact" })
    .eq("customer_id", currentCase.customer_id)
    .order("created_at", { ascending: false, nullsFirst: false })
    .range(from, to)
    .returns<RelatedCaseRecord[]>();

  if (error) throw new Error(error.message);

  return {
    items: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  };
}
