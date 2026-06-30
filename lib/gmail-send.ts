type GmailSendInput = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
};

type GmailSendResult =
  | {
      ok: true;
      response: unknown;
    }
  | {
      ok: false;
      status: number;
      error: string;
      response?: unknown;
    };

type OAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

const gmailSendUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const oauthTokenUrl = "https://oauth2.googleapis.com/token";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} no está configurada.`);
  }

  return value;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildRawEmail({ to, cc, bcc, subject, body }: GmailSendInput) {
  const senderEmail = getRequiredEnv("GOOGLE_SENDER_EMAIL");
  const headers = [
    `From: ${sanitizeHeader(senderEmail)}`,
    `To: ${sanitizeHeader(to)}`,
    cc ? `Cc: ${sanitizeHeader(cc)}` : null,
    bcc ? `Bcc: ${sanitizeHeader(bcc)}` : null,
    `Subject: ${sanitizeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ].filter(Boolean);

  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    refresh_token: getRequiredEnv("GOOGLE_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });

  const response = await fetch(oauthTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as OAuthTokenResponse;

  if (!response.ok || !payload.access_token) {
    return {
      ok: false as const,
      status: response.status,
      error:
        payload.error_description ||
        payload.error ||
        `Google OAuth respondió con estado ${response.status}.`,
      response: payload,
    };
  }

  return {
    ok: true as const,
    accessToken: payload.access_token,
  };
}

export async function sendGmailMessage(
  input: GmailSendInput,
): Promise<GmailSendResult> {
  let tokenResult;

  try {
    tokenResult = await getAccessToken();
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: getErrorMessage(error),
    };
  }

  if (!tokenResult.ok) {
    return tokenResult;
  }

  const raw = encodeBase64Url(buildRawEmail(input));

  try {
    const response = await fetch(gmailSendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    const payload = (await response.json().catch(() => ({}))) as unknown;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Gmail API respondió con estado ${response.status}.`,
        response: payload,
      };
    }

    return {
      ok: true,
      response: payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: getErrorMessage(error),
    };
  }
}
