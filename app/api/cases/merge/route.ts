import { mergeCasesInSupabase } from "@/lib/case-operations-server-service";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MergeCasesRequest = {
  masterCaseId?: string;
  mergedCaseIds?: string[];
  fieldResolution?: Record<string, unknown>;
  actorUser?: {
    userId?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MergeCasesRequest;
    const masterCaseId = String(body.masterCaseId ?? "");
    const mergedCaseIds = body.mergedCaseIds?.filter(Boolean) ?? [];

    if (!masterCaseId || mergedCaseIds.length < 2) {
      return Response.json(
        { error: "Selecciona un caso principal y al menos 2 casos." },
        { status: 400 },
      );
    }

    const result = await mergeCasesInSupabase({
      supabase,
      masterCaseId,
      mergedCaseIds,
      fieldResolution: body.fieldResolution ?? {},
      actorUser: body.actorUser,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/cases/merge] Error merging cases", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron fusionar los casos.",
      },
      { status: 500 },
    );
  }
}
