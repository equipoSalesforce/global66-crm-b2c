import { getCurrentCrmUser } from "@/lib/current-crm-user";
import {
  getChatSettings,
  updateChatSettings,
} from "@/lib/whatsapp-chat-server-service";
import type { CrmUserChatSettings } from "@/lib/whatsapp-chat-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentCrmUser();
    const settings = await getChatSettings(user.id);
    return Response.json({ settings });
  } catch (error) {
    console.error("[api/chat/settings] Error loading settings", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la configuración." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentCrmUser();
    const input = (await request.json()) as Partial<CrmUserChatSettings>;
    const settings = await updateChatSettings(user.id, input);
    return Response.json({ settings });
  } catch (error) {
    console.error("[api/chat/settings] Error updating settings", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la configuración." },
      { status: 400 },
    );
  }
}
