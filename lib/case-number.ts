import { supabase } from "./supabase";

type CaseNumberRecord = {
  case_number: string | null;
};

export async function generateNextCaseNumber() {
  const { count, error } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("[case-number] Error counting cases", {
      message: error.message,
      supabaseError: error,
    });
  }

  const baseNumber = (count ?? 0) + 1;
  const { data, error: latestError } = await supabase
    .from("cases")
    .select("case_number")
    .not("case_number", "is", null)
    .order("case_number", { ascending: false })
    .limit(1)
    .returns<CaseNumberRecord[]>();

  if (latestError) {
    console.error("[case-number] Error loading latest case number", {
      message: latestError.message,
      supabaseError: latestError,
    });
  }

  const latestNumber = Number(data?.[0]?.case_number ?? 0);
  const nextNumber = Math.max(
    baseNumber,
    Number.isFinite(latestNumber) ? latestNumber + 1 : 1,
  );

  return String(nextNumber).padStart(6, "0");
}
