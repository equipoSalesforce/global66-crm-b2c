import {
  generateCaseAiHistorySummary,
  loadCaseAiHistoryData,
} from "@/lib/case-ai-history";
import { hasPermission, type CrmRolePermissionRecord } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type CrmUserRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

async function getActiveCrmUser(crmUserId: string | null) {
  if (!crmUserId) {
    return {
      user: null,
      rolePermissions: [] as CrmRolePermissionRecord[],
      error: "Usuario CRM no encontrado en sesión demo.",
      status: 401,
    };
  }

  const [userResult, permissionsResult] = await Promise.all([
    supabase
      .from("crm_users")
      .select("id, name, email, role, status")
      .eq("id", crmUserId)
      .maybeSingle<CrmUserRecord>(),
    supabase
      .from("crm_role_permissions")
      .select("role, permission_key, enabled")
      .returns<CrmRolePermissionRecord[]>(),
  ]);

  if (userResult.error || !userResult.data || userResult.data.status !== "ACTIVE") {
    return {
      user: null,
      rolePermissions: permissionsResult.data ?? [],
      error: "Usuario CRM inválido o inactivo.",
      status: 403,
    };
  }

  return {
    user: userResult.data,
    rolePermissions: permissionsResult.data ?? [],
    error: null,
    status: 200,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const crmUserId = url.searchParams.get("crmUserId");
  const session = await getActiveCrmUser(crmUserId);

  if (!session.user) {
    return Response.json({ ok: false, error: session.error }, { status: session.status });
  }

  if (
    !hasPermission(
      session.user.role,
      "view_ai_case_summary",
      session.rolePermissions,
    )
  ) {
    return Response.json(
      { ok: false, error: "No tienes permiso para ver resumen IA." },
      { status: 403 },
    );
  }

  try {
    const data = await loadCaseAiHistoryData(id);

    return Response.json({
      ok: true,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      ...data,
    });
  } catch (error) {
    console.error("[case-ai-history] Error loading data", {
      caseId: id,
      message: getErrorMessage(error),
      error,
    });

    return Response.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    crmUserId?: string;
  };
  const session = await getActiveCrmUser(body.crmUserId?.trim() || null);

  if (!session.user) {
    return Response.json({ ok: false, error: session.error }, { status: session.status });
  }

  const canGenerate =
    hasPermission(
      session.user.role,
      "generate_ai_case_summary",
      session.rolePermissions,
    ) && hasPermission(session.user.role, "use_ai", session.rolePermissions);

  if (!canGenerate) {
    return Response.json(
      { ok: false, error: "No tienes permiso para generar resumen IA." },
      { status: 403 },
    );
  }

  try {
    const result = await generateCaseAiHistorySummary({
      caseId: id,
      actorUserId: session.user.id,
    });

    return Response.json(result);
  } catch (error) {
    console.error("[case-ai-history] Error generating summary", {
      caseId: id,
      userId: session.user.id,
      message: getErrorMessage(error),
      error,
    });

    return Response.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
