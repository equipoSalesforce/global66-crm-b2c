import { canConfigureCaseDetailSections } from "@/lib/case-detail-section-authorization";
import {
  CaseDetailSectionConfigError,
  createCaseDetailAreaConfiguration,
  restoreCaseDetailAreaInheritance,
} from "@/lib/case-detail-section-config-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function areaFromRequest(request: Request) {
  const payload = (await request.json()) as { area?: string };
  if (!payload.area?.trim()) throw new CaseDetailSectionConfigError("El área es obligatoria.");
  return payload.area;
}

export async function POST(request: Request) {
  try {
    if (!(await canConfigureCaseDetailSections())) {
      return Response.json({ error: "No tienes permiso para editar esta configuración." }, { status: 403 });
    }
    return Response.json(await createCaseDetailAreaConfiguration(await areaFromRequest(request)));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la configuración." },
      { status: error instanceof CaseDetailSectionConfigError ? 400 : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await canConfigureCaseDetailSections())) {
      return Response.json({ error: "No tienes permiso para editar esta configuración." }, { status: 403 });
    }
    return Response.json(await restoreCaseDetailAreaInheritance(await areaFromRequest(request)));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo restaurar la herencia." },
      { status: error instanceof CaseDetailSectionConfigError ? 400 : 500 },
    );
  }
}
