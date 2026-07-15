import {
  CaseAreaLayoutServiceError,
  getCaseAreaLayout,
  updateCaseAreaLayout,
  type CaseAreaLayoutInput,
} from "@/lib/case-area-layout-service";

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
