import { getCurrentCrmUser } from "@/lib/current-crm-user";
import { getRelatedCases } from "@/lib/case-related-cases-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getCurrentCrmUser();
    const { id } = await params;
    const searchParams = new URL(request.url).searchParams;
    const page = positiveInteger(searchParams.get("page"), 1, 10_000);
    const requestedPageSize = searchParams.get("pageSize") ?? searchParams.get("limit");
    const pageSize = positiveInteger(requestedPageSize, 5, 100);
    const result = await getRelatedCases({ caseId: id, page, pageSize });

    return Response.json(result);
  } catch (error) {
    console.error("[api/cases/id/related-cases] Error loading related cases", error);
    const message = error instanceof Error ? error.message : "No se pudieron cargar los casos del cliente.";
    const status = message === "El caso no existe." ? 404 : 500;

    return Response.json({ error: message }, { status });
  }
}
