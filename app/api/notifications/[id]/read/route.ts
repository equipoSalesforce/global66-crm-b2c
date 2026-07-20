import { markCaseAssignmentNotificationRead } from "@/lib/case-assignment-notifications-server-service";
import { getCurrentDemoUser } from "@/lib/demo-users";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, getCurrentDemoUser()]);
    const updated = await markCaseAssignmentNotificationRead(
      supabase,
      user.id,
      id,
    );

    if (!updated) {
      return Response.json(
        { error: "Notificación no encontrada." },
        { status: 404 },
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/notifications/read] Error updating notification", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la notificación.",
      },
      { status: 500 },
    );
  }
}

