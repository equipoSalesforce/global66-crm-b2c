import {
  rewriteEmailMessage,
  type EmailRewriteAction,
  type EmailRewriteContext,
} from "@/lib/ai-email-assistant";
import { getCurrentAiUser } from "@/lib/ai-current-user";
import { AiUsageLimitError, runAiFeature } from "@/lib/ai-feature-runner";
import { supabase } from "@/lib/supabase";

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

    const user = await getCurrentAiUser();
    const caseId = body.context?.case?.id?.trim() || null;
    const { data: caseItem, error: caseError } = caseId
      ? await supabase
          .from("cases")
          .select("id, case_number, category, area")
          .eq("id", caseId)
          .maybeSingle<{ id: string; case_number: string | null; category: string | null; area: string | null }>()
      : { data: null, error: null };
    if (caseError || (caseId && !caseItem)) {
      return Response.json({ ok: false, error: "Caso no encontrado." }, { status: 404 });
    }
    const result = await runAiFeature({
      featureKey: "RESPONSE_TONE_REWRITE",
      user,
      caseId,
      caseNumber: caseItem?.case_number ?? body.context?.case?.case_number ?? null,
      channel: "TICKET",
      topic: caseItem?.category ?? caseItem?.area ?? null,
      requestMetadata: { source: "case_ticket_composer", action },
      execute: () =>
        rewriteEmailMessage({
          rawMessage: body.rawMessage!,
          action,
          context: body.context || {},
        }),
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
      { status: error instanceof AiUsageLimitError ? error.status : 500 },
    );
  }
}
