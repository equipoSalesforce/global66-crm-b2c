import { getCurrentCrmUser } from "@/lib/current-crm-user";
import {
  createQuickMessage,
  listQuickMessages,
} from "@/lib/whatsapp-chat-server-service";
import type { QuickMessageInput } from "@/lib/whatsapp-chat-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentCrmUser();
    const includeInactive =
      new URL(request.url).searchParams.get("includeInactive") === "true";

    if (includeInactive && user.role !== "ADMIN") {
      return Response.json({ error: "Acceso no autorizado." }, { status: 403 });
    }

    const messages = await listQuickMessages(includeInactive);
    return Response.json({ messages });
  } catch (error) {
    console.error("[api/chat/quick-messages] Error loading messages", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los mensajes rápidos." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentCrmUser();
    if (user.role !== "ADMIN") {
      return Response.json({ error: "Acceso no autorizado." }, { status: 403 });
    }

    const input = (await request.json()) as QuickMessageInput;
    const message = await createQuickMessage(input, user.id);
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    console.error("[api/chat/quick-messages] Error creating message", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el mensaje rápido." },
      { status: 400 },
    );
  }
}
