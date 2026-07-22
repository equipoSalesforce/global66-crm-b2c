import {
  CaseAreaLayoutServiceError,
  getCaseAreaLayout,
  deactivateCaseAreaLayout,
  updateCaseAreaLayout,
  type CaseAreaLayoutInput,
} from "@/lib/case-area-layout-service";
import { canConfigureCaseDetailSections } from "@/lib/case-detail-section-authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ area: string }> },
) {
  try {
    const { area } = await params;
    const layout = await getCaseAreaLayout(area);
    if (!layout) return Response.json({ error: "Layout no encontrado." }, { status: 404 });
    return Response.json(layout);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error cargando layout.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ area: string }> },
) {
  try {
    if (!(await canConfigureCaseDetailSections())) {
      return Response.json({ error: "No tienes permiso para editar esta configuración." }, { status: 403 });
    }
    const { area: id } = await params;
    await deactivateCaseAreaLayout(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    const status = error instanceof CaseAreaLayoutServiceError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Error restaurando el layout.";
    return Response.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ area: string }> },
) {
  try {
    const { area: id } = await params;
    const input = (await request.json()) as CaseAreaLayoutInput;
    return Response.json(await updateCaseAreaLayout(id, input));
  } catch (error) {
    const status = error instanceof CaseAreaLayoutServiceError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Error actualizando layout.";
    return Response.json({ error: message }, { status });
  }
}
