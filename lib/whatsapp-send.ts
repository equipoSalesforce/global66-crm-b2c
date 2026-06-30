type SendWhatsappMessageResult =
  | {
      ok: true;
      response: unknown;
      messageId: string;
    }
  | {
      ok: false;
      error: string;
      response?: unknown;
    };

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logWhatsappSend(stage: string, details?: Record<string, unknown>) {
  console.info("[whatsapp-send]", {
    stage,
    ...details,
  });
}

function getMetaMessageId(response: unknown) {
  if (!response || typeof response !== "object") return null;

  const responseObject = response as {
    messages?: Array<{
      id?: unknown;
    }>;
  };
  const messageId = responseObject.messages?.[0]?.id;

  return typeof messageId === "string" && messageId.trim()
    ? messageId.trim()
    : null;
}

export async function sendWhatsappMessage(
  phoneNumber: string,
  message: string,
): Promise<SendWhatsappMessageResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const phone = phoneNumber.trim();
  const body = message.trim();

  logWhatsappSend("preparando envío", {
    phone,
    body,
    hasAccessToken: Boolean(accessToken),
    hasPhoneNumberId: Boolean(phoneNumberId),
  });

  if (!accessToken || !phoneNumberId) {
    const error = "WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID no está configurada.";

    console.error("[whatsapp-send]", {
      error,
      phone,
      body,
    });

    return {
      ok: false,
      error,
    };
  }

  if (!phone || !body) {
    const error = "phoneNumber y message son requeridos para enviar WhatsApp.";

    console.error("[whatsapp-send]", {
      error,
      phone,
      body,
    });

    return {
      ok: false,
      error,
    };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: {
            body,
          },
        }),
      },
    );
    const responseBody = (await response.json().catch(() => null)) as unknown;

    logWhatsappSend("meta response", {
      phone,
      body,
      status: response.status,
      ok: response.ok,
      response: responseBody,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Meta respondió con status ${response.status}.`,
        response: responseBody,
      };
    }

    const messageId = getMetaMessageId(responseBody);

    if (!messageId) {
      return {
        ok: false,
        error: "Meta no devolvió message_id válido.",
        response: responseBody,
      };
    }

    return {
      ok: true,
      response: responseBody,
      messageId,
    };
  } catch (error) {
    console.error("[whatsapp-send]", {
      phone,
      body,
      error: getErrorMessage(error),
      rawError: error,
    });

    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}
