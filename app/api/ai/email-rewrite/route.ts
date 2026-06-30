import {
  rewriteEmailMessage,
  type EmailRewriteAction,
  type EmailRewriteContext,
} from "@/lib/ai-email-assistant";

export const runtime = "nodejs";

const allowedActions = new Set(["formalize", "clarify", "shorten", "empathetic"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      rawMessage?: string;
      action?: string;
      context?: EmailRewriteContext;
    };
    const action = body.action as EmailRewriteAction;

    if (!body.rawMessage?.trim()) {
      return Response.json(
        { ok: false, error: "rawMessage es requerido." },
        { status: 400 },
      );
    }

    if (!allowedActions.has(action)) {
      return Response.json(
        { ok: false, error: "Acción IA inválida." },
        { status: 400 },
      );
    }

    const result = await rewriteEmailMessage({
      rawMessage: body.rawMessage,
      action,
      context: body.context || {},
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/ai/email-rewrite] Error rewriting email", {
      message: error instanceof Error ? error.message : String(error),
      error,
    });

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo mejorar el texto.",
      },
      { status: 500 },
    );
  }
}
