import {
  CaseAreaLayoutServiceError,
  createCaseAreaLayout,
  listCaseAreaLayouts,
  type CaseAreaLayoutInput,
} from "@/lib/case-area-layout-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listCaseAreaLayouts());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error cargando layouts.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CaseAreaLayoutInput;
    return Response.json(await createCaseAreaLayout(input), { status: 201 });
  } catch (error) {
    const status = error instanceof CaseAreaLayoutServiceError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Error guardando layout.";
    return Response.json({ error: message }, { status });
  }
}
