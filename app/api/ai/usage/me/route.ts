import { getCurrentAiUser } from "@/lib/ai-current-user";
import { getAiUsageProfile } from "@/lib/ai-usage-control-service";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentAiUser();
    const params = request.nextUrl.searchParams;
    const profile = await getAiUsageProfile(user.id, {
      featureKey: params.get("featureKey") || undefined,
      status: params.get("status") || undefined,
      topic: params.get("topic") || undefined,
      dateFrom: params.get("dateFrom") || undefined,
      dateTo: params.get("dateTo") || undefined,
      search: params.get("search") || undefined,
      page: Number(params.get("page") || 1),
      pageSize: Number(params.get("pageSize") || 10),
    });
    return Response.json({ ok: true, user, ...profile });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo cargar Mi perfil IA." }, { status: 500 });
  }
}

