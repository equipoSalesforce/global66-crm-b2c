import {
  caseFieldDefinitions,
  type CaseEditableFieldKey,
} from "@/lib/case-field-definitions";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetadataRow = {
  field_key: string;
  picklist_values: string[] | null;
};

const metadataKeyMap: Record<string, CaseEditableFieldKey> = {
  channel: "channel",
  contact_type: "contactType",
  product: "product",
  subproduct: "subproduct",
  area: "catPrincipal",
  category: "catSecondary",
  ai_category: "catExtra",
  lifecycle_status: "status",
  resolution_type: "containmentContext",
  priority: "priority",
  is_edge_case: "isEdgeCase",
};

export async function GET() {
  const fields = { ...caseFieldDefinitions };
  const { data, error } = await supabase
    .from("case_field_definitions")
    .select("field_key, picklist_values")
    .eq("is_active", true)
    .returns<MetadataRow[]>();

  if (!error) {
    (data ?? []).forEach((row) => {
      const key = metadataKeyMap[row.field_key];

      if (!key || !Array.isArray(row.picklist_values)) return;

      fields[key] = {
        ...fields[key],
        options:
          row.field_key === "lifecycle_status"
            ? Array.from(new Set([...row.picklist_values, "MERGED"])).map((value) =>
                value.replaceAll("_", " "),
              )
            : row.picklist_values,
      };
    });
  }

  return Response.json({ fields });
}
