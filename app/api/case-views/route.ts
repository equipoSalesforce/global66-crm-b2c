import {
  createCaseViewForUser,
  listCaseViews,
  type CaseViewPayload,
} from "@/lib/case-views-server-service";
import { getCurrentDemoUser } from "@/lib/demo-users";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentDemoUser();
    const views = await listCaseViews(supabase, user);

    return Response.json({ views, currentUser: user });
  } catch (error) {
    console.error("[api/case-views] Error loading views", error);

    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las vistas." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentDemoUser();
    const payload = (await request.json()) as CaseViewPayload;
    const view = await createCaseViewForUser(supabase, user, payload);

    return Response.json({ view }, { status: 201 });
  } catch (error) {
    console.error("[api/case-views] Error creating view", error);

    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la vista." },
      { status: 500 },
    );
  }
}
