import { listCaseDetailSectionConfiguration } from "@/lib/case-detail-section-config-service";
import { canConfigureCaseDetailSections } from "@/lib/case-detail-section-authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!(await canConfigureCaseDetailSections())) {
      return Response.json({ error: "No tienes permiso para ver esta configuración." }, { status: 403 });
    }
    const area = new URL(request.url).searchParams.get("area") ?? "GENERAL";
    return Response.json(await listCaseDetailSectionConfiguration(area));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error cargando configuración.";
    return Response.json({ error: message }, { status: 500 });
  }
}
