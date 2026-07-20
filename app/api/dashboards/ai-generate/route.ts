import { getCurrentAiUser } from "@/lib/ai-current-user";
import { AiUsageLimitError, runAiFeature } from "@/lib/ai-feature-runner";
import { promptContainsSql } from "@/lib/analytics/semantic-layer";
import { resolveDashboardWidgets } from "@/lib/analytics/dashboard-query-service";
import { generateDashboardProposal } from "@/lib/ai/dashboard-builder-ai-service";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let prompt = "";
  let user: Awaited<ReturnType<typeof getCurrentAiUser>> | null = null;
  try {
    const body = (await request.json()) as { prompt?: string };
    prompt = body.prompt?.trim() ?? "";
    if (prompt.length < 10 || prompt.length > 1500) {
      return Response.json({ ok: false, error: "Describe el dashboard usando entre 10 y 1500 caracteres." }, { status: 400 });
    }
    user = await getCurrentAiUser();
    if (promptContainsSql(prompt)) {
      await supabase.from("dashboard_ai_requests").insert({
        user_id: user.id,
        user_name: user.name,
        prompt,
        status: "ERROR",
        error_message: "La solicitud contiene SQL o consultas arbitrarias no permitidas.",
      });
      return Response.json({ ok: false, error: "No se acepta SQL. Describe las métricas y visualizaciones que necesitas." }, { status: 400 });
    }
    const result = await runAiFeature({
      featureKey: "AI_DASHBOARD_BUILDER",
      user,
      channel: "ANALYTICS",
      topic: "dashboard_builder",
      requestMetadata: { promptLength: prompt.length },
      execute: async () => {
        const proposal = await generateDashboardProposal(prompt);
        const resolved = await resolveDashboardWidgets(proposal.definition);
        const { error } = await supabase.from("dashboard_ai_requests").insert({
          user_id: user!.id,
          user_name: user!.name,
          prompt,
          generated_definition: resolved.definition,
          status: "SUCCESS",
        });
        if (error) throw new Error(error.message);
        return { ...proposal, definition: resolved.definition, data: resolved.widgets, resolvedAt: resolved.resolvedAt };
      },
      getUsageMetadata: (value) => ({ model: value.model }),
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el dashboard.";
    if (user) {
      await supabase.from("dashboard_ai_requests").insert({
        user_id: user.id,
        user_name: user.name,
        prompt,
        status: error instanceof AiUsageLimitError ? "BLOCKED_LIMIT" : "ERROR",
        error_message: message,
      });
    }
    return Response.json({ ok: false, error: message }, { status: error instanceof AiUsageLimitError ? error.status : 500 });
  }
}

