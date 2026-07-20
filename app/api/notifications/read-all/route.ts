import { markAllCaseAssignmentNotificationsRead } from "@/lib/case-assignment-notifications-server-service";
import { getCurrentDemoUser } from "@/lib/demo-users";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH() {
  try {
    const user = await getCurrentDemoUser();
    const updated = await markAllCaseAssignmentNotificationsRead(
      supabase,
      user.id,
    );

    return Response.json({ ok: true, updated });
  } catch (error) {
    console.error("[api/notifications/read-all] Error updating notifications", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron actualizar las notificaciones.",
      },
      { status: 500 },
    );
  }
}
