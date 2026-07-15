import { listCaseAssignmentNotifications } from "@/lib/case-assignment-notifications-server-service";
import { getCurrentDemoUser } from "@/lib/demo-users";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentDemoUser();
    const result = await listCaseAssignmentNotifications(supabase, user.id, 20);

    return Response.json(result);
  } catch (error) {
    console.error("[api/notifications] Error loading notifications", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las notificaciones.",
      },
      { status: 500 },
    );
  }
}

