import {
  WhatsAppInboundPayload,
  processWhatsAppInbound,
} from "@/lib/whatsapp-inbound";

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request) {
  let payload: WhatsAppInboundPayload;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("[api/integrations/whatsapp/inbound] Error parsing JSON", {
      message: getErrorMessage(error),
      error,
    });

    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const result = await processWhatsAppInbound(payload);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    ok: true,
    caseId: result.caseId,
    customerId: result.customerId,
  });
}
