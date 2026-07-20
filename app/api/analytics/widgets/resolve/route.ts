import { getCurrentAiUser } from "@/lib/ai-current-user";
import { resolveDashboardWidgets } from "@/lib/analytics/dashboard-query-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await getCurrentAiUser();
    const body = (await request.json()) as { definition?: unknown };
    if (!body.definition) return Response.json({ ok: false, error: "La definición es requerida." }, { status: 400 });
    return Response.json({ ok: true, ...(await resolveDashboardWidgets(body.definition)) });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "No se pudieron resolver los widgets." }, { status: 400 });
  }
}

