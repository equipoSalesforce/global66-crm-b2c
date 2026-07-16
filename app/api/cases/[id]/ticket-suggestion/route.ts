import { getCurrentAiUser } from "@/lib/ai-current-user";
import { AiUsageLimitError, runAiFeature } from "@/lib/ai-feature-runner";
import { generateAgentAiSuggestion } from "@/lib/ai-triage";
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
      featureKey: "TICKET_SUGGESTION",
      user,
      caseId: id,
      caseNumber: caseResult.data.case_number,
      channel: "TICKET",
      topic: caseResult.data.category ?? caseResult.data.area,
      requestMetadata: { source: "case_ticket_composer" },
      execute: () => generateAgentAiSuggestion(id),
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/cases/ticket-suggestion] Error generating suggestion", { caseId: id, message });
    return Response.json(
      { ok: false, error: message },
      { status: error instanceof AiUsageLimitError ? error.status : 500 },
    );
  }
}
