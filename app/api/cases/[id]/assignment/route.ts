import { assignCaseOwner, getCaseAssignmentOptions } from "@/lib/case-ownership-server-service";
import type { CaseOwnerType } from "@/lib/case-ownership-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return Response.json({ ok: true, ...(await getCaseAssignmentOptions(id)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar los owners.";
    return Response.json({ ok: false, error: message }, { status: message.includes("permiso") ? 403 : 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, body] = await Promise.all([
      params,
      request.json() as Promise<{
        ownerType?: CaseOwnerType;
        assignedAgentId?: string | null;
        assignedQueueId?: string | null;
        notify?: boolean;
      }>,
    ]);
    if (body.ownerType !== "USER" && body.ownerType !== "QUEUE") {
      return Response.json({ ok: false, error: "ownerType debe ser USER o QUEUE." }, { status: 400 });
    }
    const assignment = await assignCaseOwner({
      caseId: id,
      ownerType: body.ownerType,
      assignedAgentId: body.assignedAgentId,
      assignedQueueId: body.assignedQueueId,
      notify: body.notify === true,
    });
    return Response.json({ ok: true, assignment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo asignar el caso.";
    return Response.json({ ok: false, error: message }, { status: message.includes("permiso") ? 403 : 400 });
  }
}
