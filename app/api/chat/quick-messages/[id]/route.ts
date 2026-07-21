import { getCurrentCrmUser } from "@/lib/current-crm-user";
import {
  softDeleteQuickMessage,
  updateQuickMessage,
} from "@/lib/whatsapp-chat-server-service";
import type { QuickMessageInput } from "@/lib/whatsapp-chat-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getCurrentCrmUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const input = (await request.json()) as QuickMessageInput;
    const message = await updateQuickMessage(id, input);
    return Response.json({ message });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    console.error("[api/chat/quick-messages/id] Error updating message", error);
    return Response.json(
      { error: forbidden ? "Acceso no autorizado." : error instanceof Error ? error.message : "No se pudo actualizar el mensaje rápido." },
      { status: forbidden ? 403 : 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    await softDeleteQuickMessage(id);
    return Response.json({ ok: true });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    console.error("[api/chat/quick-messages/id] Error deleting message", error);
    return Response.json(
      { error: forbidden ? "Acceso no autorizado." : error instanceof Error ? error.message : "No se pudo eliminar el mensaje rápido." },
      { status: forbidden ? 403 : 400 },
    );
  }
}
