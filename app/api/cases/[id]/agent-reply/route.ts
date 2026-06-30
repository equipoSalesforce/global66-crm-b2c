import { getCaseWhatsappTarget } from "@/lib/case-whatsapp";
import { supabase } from "@/lib/supabase";
import { sendWhatsappMessage } from "@/lib/whatsapp-send";

export const runtime = "nodejs";

type AgentReplyPayload = {
  body?: unknown;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logAgentWhatsappSend(details: Record<string, unknown>) {
  console.info("[agent-whatsapp-send]", details);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let payload: AgentReplyPayload;

  try {
    payload = (await request.json()) as AgentReplyPayload;
  } catch (error) {
    console.error("[api/cases/agent-reply] Error parsing JSON", {
      message: getErrorMessage(error),
      error,
    });

    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (!body) {
    return Response.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });
  }

  const target = await getCaseWhatsappTarget(id);
  const isWhatsappMessage = target.ok && target.isWhatsapp;
  const { data: insertedMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      case_id: id,
      direction: "OUTBOUND",
      sender_type: "AGENT",
      channel: isWhatsappMessage ? "WHATSAPP" : null,
      message_type: isWhatsappMessage ? "TEXT" : null,
      body,
      delivery_status: isWhatsappMessage ? "PENDING" : null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[api/cases/agent-reply] Error inserting agent message", {
      message: insertError.message,
      supabaseError: insertError,
    });

    return Response.json({ error: insertError.message }, { status: 500 });
  }

  if (!target.ok) {
    console.error("[agent-whatsapp-send]", {
      caseId: id,
      phone: null,
      bodyPreview: body.slice(0, 160),
      result: "target_error",
      error: target.error,
      supabaseError: target.supabaseError ?? null,
    });

    return Response.json({
      ok: true,
      whatsappSent: false,
      whatsappError: target.error,
    });
  }

  if (!target.isWhatsapp || !target.phone) {
    logAgentWhatsappSend({
      caseId: id,
      phone: target.phone,
      bodyPreview: body.slice(0, 160),
      result: !target.isWhatsapp ? "not_whatsapp_case" : "missing_phone",
    });

    return Response.json({
      ok: true,
      whatsappSent: false,
      whatsappSkipped: !target.isWhatsapp ? "not_whatsapp_case" : "missing_phone",
    });
  }

  const sendResult = await sendWhatsappMessage(target.phone, body);

  if (!sendResult.ok) {
    if (insertedMessage?.id) {
      await supabase
        .from("messages")
        .update({
          delivery_status: "FAILED",
          failed_at: new Date().toISOString(),
          failure_reason: sendResult.error,
        })
        .eq("id", insertedMessage.id);
    }

    console.error("[agent-whatsapp-send]", {
      caseId: id,
      phone: target.phone,
      bodyPreview: body.slice(0, 160),
      result: "meta_error",
      error: sendResult.error,
      metaResponse: sendResult.response ?? null,
    });

    return Response.json({
      ok: true,
      whatsappSent: false,
      whatsappError: sendResult.error,
    });
  }

  if (insertedMessage?.id) {
    await supabase
      .from("messages")
      .update({
        external_message_id: sendResult.messageId,
        delivery_status: "SENT",
      })
      .eq("id", insertedMessage.id);
  }

  logAgentWhatsappSend({
    caseId: id,
    phone: target.phone,
    bodyPreview: body.slice(0, 160),
    result: "sent",
    metaResponse: sendResult.response,
  });

  return Response.json({
    ok: true,
    whatsappSent: true,
  });
}
