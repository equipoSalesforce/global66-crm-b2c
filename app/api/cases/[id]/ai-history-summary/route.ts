import { getCurrentAiUser } from "@/lib/ai-current-user";
import { AiUsageLimitError, runAiFeature } from "@/lib/ai-feature-runner";
import { generateCaseAiHistorySummary, loadCaseAiHistoryData } from "@/lib/case-ai-history";
import { hasPermission, type CrmRolePermissionRecord } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

async function getRolePermissions() {
  const { data } = await supabase
    .from("crm_role_permissions")
    .select("role, permission_key, enabled")
    .returns<CrmRolePermissionRecord[]>();
  return data ?? [];
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const [user, rolePermissions] = await Promise.all([getCurrentAiUser(), getRolePermissions()]);
    if (!hasPermission(user.role, "view_ai_case_summary", rolePermissions)) {
      return Response.json({ ok: false, error: "No tienes permiso para ver resumen IA." }, { status: 403 });
    }
    return Response.json({
      ok: true,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      ...(await loadCaseAiHistoryData(id)),
    });
  } catch (error) {
    console.error("[case-ai-history] Error loading data", { caseId: id, message: message(error) });
    return Response.json({ ok: false, error: message(error) }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const [user, rolePermissions, caseResult] = await Promise.all([
      getCurrentAiUser(),
      getRolePermissions(),
      supabase.from("cases").select("id, case_number, channel, category, area").eq("id", id).maybeSingle<{ id: string; case_number: string | null; channel: string | null; category: string | null; area: string | null }>(),
    ]);
    if (!hasPermission(user.role, "generate_ai_case_summary", rolePermissions) || !hasPermission(user.role, "use_ai", rolePermissions)) {
      return Response.json({ ok: false, error: "No tienes permiso para generar resumen IA." }, { status: 403 });
    }
    if (caseResult.error || !caseResult.data) return Response.json({ ok: false, error: "Caso no encontrado." }, { status: 404 });

    const result = await runAiFeature({
      featureKey: "HISTORICAL_CASE_AI_SUMMARY",
      user,
      caseId: id,
      caseNumber: caseResult.data.case_number,
      channel: "CASE",
      topic: caseResult.data.category ?? caseResult.data.area,
      requestMetadata: { source: "case_detail_history_tab" },
      execute: () => generateCaseAiHistorySummary({ caseId: id, actorUserId: user.id }),
      getUsageMetadata: (value) => ({ model: value.cachedSummary?.model ?? null }),
    });
    return Response.json(result);
  } catch (error) {
    const status = error instanceof AiUsageLimitError ? error.status : 500;
    console.error("[case-ai-history] Error generating summary", { caseId: id, message: message(error) });
    return Response.json({ ok: false, error: message(error) }, { status });
  }
}
