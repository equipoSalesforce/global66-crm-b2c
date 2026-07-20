import { getCurrentAiUser } from "@/lib/ai-current-user";
import { AiUsageLimitError, runAiFeature } from "@/lib/ai-feature-runner";
import { runAiTriage } from "@/lib/ai-triage";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const [user, caseResult] = await Promise.all([
      getCurrentAiUser(),
      supabase
        .from("cases")
        .select("id, case_number, category, area")
        .eq("id", id)
        .maybeSingle<{ id: string; case_number: string | null; category: string | null; area: string | null }>(),
    ]);
    if (caseResult.error || !caseResult.data) {
      return Response.json({ ok: false, error: "Caso no encontrado." }, { status: 404 });
    }
    const result = await runAiFeature({
      featureKey: "CASE_ANALYSIS",
      user,
      caseId: id,
      caseNumber: caseResult.data.case_number,
      channel: "CASE",
      topic: caseResult.data.category ?? caseResult.data.area,
      requestMetadata: { source: "case_workspace_manual_triage" },
      execute: async () => {
        const triage = await runAiTriage(id);
        if (triage.status === "error") throw new Error(triage.reason || "No se pudo reevaluar el caso con IA.");
        return triage;
      },
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo reevaluar el caso con IA.";
    return Response.json(
      { ok: false, error: message },
      { status: error instanceof AiUsageLimitError ? error.status : 500 },
    );
  }
}
