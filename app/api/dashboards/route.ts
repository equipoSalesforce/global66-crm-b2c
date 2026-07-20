import { getCurrentAiUser } from "@/lib/ai-current-user";
import { createDashboard, listVisibleDashboards, type DashboardVisibility } from "@/lib/analytics/dashboard-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentAiUser();
    return Response.json({ ok: true, dashboards: await listVisibleDashboards(user) });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "No se pudieron cargar los dashboards." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentAiUser();
    const body = (await request.json()) as { definition?: unknown; prompt?: string; visibility?: DashboardVisibility };
    if (!body.definition) return Response.json({ ok: false, error: "La definición es requerida." }, { status: 400 });
    const dashboard = await createDashboard({ user, definition: body.definition, prompt: body.prompt, visibility: body.visibility });
    return Response.json({ ok: true, dashboard }, { status: 201 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo guardar el dashboard." }, { status: 400 });
  }
}

