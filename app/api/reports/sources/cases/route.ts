import { buildCasesReportSourceAdapter, type CaseReportRecord } from "@/lib/report-sources/cases-report-source";
import type { CaseCustomValue, CaseFieldDefinition } from "@/lib/case-metadata";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const [casesResult, definitionsResult] = await Promise.all([
    supabase.from("cases").select("id, case_number, customer_id, subject, status, lifecycle_status, routing_status, priority, channel, assigned_agent_id, assigned_to, created_at, updated_at, closed_at, area, category, contact_name, contact_email, contact_phone, contact_type").order("created_at", { ascending: false }).limit(200).returns<CaseReportRecord[]>(),
    supabase.from("case_field_definitions").select("id, field_key, label, field_type, description, is_required, is_active, is_standard, picklist_values, default_value, created_at, updated_at").eq("is_active", true).order("field_key", { ascending: true }).returns<CaseFieldDefinition[]>(),
  ]);

  if (casesResult.error || definitionsResult.error) {
    return Response.json({ error: "Case report source is unavailable" }, { status: 503 });
  }

  const cases = casesResult.data ?? [];
  const caseIds = cases.map((item) => String(item.id)).filter(Boolean);
  const customValuesResult = caseIds.length
    ? await supabase.from("case_custom_values").select("id, case_id, field_definition_id, value_text, value_number, value_boolean, value_date, value_datetime, value_json, updated_at").in("case_id", caseIds).returns<CaseCustomValue[]>()
    : { data: [] as CaseCustomValue[], error: null };

  if (customValuesResult.error) {
    return Response.json({ error: "Case custom values are unavailable" }, { status: 503 });
  }

  const adapter = buildCasesReportSourceAdapter(cases, definitionsResult.data ?? [], customValuesResult.data ?? []);
  return Response.json({ fields: adapter.source.fields, rows: adapter.dataset, defaultColumns: adapter.defaultColumns, dataSource: "supabase" });
}
