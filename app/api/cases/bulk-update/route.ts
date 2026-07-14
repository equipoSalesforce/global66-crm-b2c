import { updateCasesBulkInSupabase } from "@/lib/case-operations-server-service";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BulkUpdateRequest = {
  updates?: Array<{
    caseId?: string;
    changes?: Record<string, unknown>;
  }>;
  actorUser?: {
    userId?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
};

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as BulkUpdateRequest;
    const updates =
      body.updates?.map((update) => ({
        caseId: String(update.caseId ?? ""),
        changes: update.changes ?? {},
      })) ?? [];

    if (updates.length === 0 || updates.some((update) => !update.caseId)) {
      return Response.json(
        { error: "Debes enviar al menos un caso para actualizar." },
        { status: 400 },
      );
    }

    const result = await updateCasesBulkInSupabase({
      supabase,
      updates,
      actorUser: body.actorUser,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/cases/bulk-update] Error updating cases", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron actualizar los casos.",
      },
      { status: 500 },
    );
  }
}
