import {
  deleteCaseViewForUser,
  updateCaseViewForUser,
  type CaseViewPayload,
} from "@/lib/case-views-server-service";
import { getCurrentDemoUser } from "@/lib/demo-users";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentDemoUser();
    const payload = (await request.json()) as CaseViewPayload;
    const result = await updateCaseViewForUser(supabase, user, id, payload);

    if (result.status !== 200) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ view: result.view });
  } catch (error) {
    console.error("[api/case-views/id] Error updating view", error);

    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la vista." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentDemoUser();
    const result = await deleteCaseViewForUser(supabase, user, id);

    if (result.status !== 200) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/case-views/id] Error deleting view", error);

    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar la vista." },
      { status: 500 },
    );
  }
}
