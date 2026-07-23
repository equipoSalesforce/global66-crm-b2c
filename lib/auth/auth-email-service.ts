import "server-only";

import nodemailer from "nodemailer";
import { AuthOtpError } from "@/lib/auth/auth-types";

function smtpBoolean(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function getSmtpConfig() {
  const provider = process.env.AUTH_EMAIL_PROVIDER?.trim().toLowerCase() || "smtp";
  const host = process.env.AUTH_SMTP_HOST?.trim();
  const port = Number.parseInt(process.env.AUTH_SMTP_PORT?.trim() || "465", 10);
  const secure = smtpBoolean(process.env.AUTH_SMTP_SECURE ?? "true");
  const user = process.env.AUTH_SMTP_USER?.trim();
  const password = process.env.AUTH_SMTP_PASSWORD?.trim();
  const from = process.env.AUTH_SMTP_FROM?.trim();

  if (
    provider !== "smtp" ||
    !host ||
    !Number.isSafeInteger(port) ||
    port <= 0 ||
    !user ||
    !password ||
    !from
  ) {
    throw new AuthOtpError(
      "SMTP_NOT_CONFIGURED",
      "No pudimos enviar el código. Intenta nuevamente.",
      503,
    );
  }

  return { host, port, secure, user, password, from };
}

export async function sendAuthOtpEmail(input: {
  email: string;
  code: string;
  expiresMinutes: number;
}) {
  const config = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to: input.email,
    subject: "Tu código de acceso al CRM Global66",
    text: [
      `Tu código de acceso es: ${input.code}`,
      `Expira en ${input.expiresMinutes} minutos.`,
      "Ambiente: DEV.",
      "Si no solicitaste este código, ignora este correo.",
    ].join("\n\n"),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
        <h1 style="font-size:20px">Acceso al CRM Global66</h1>
        <p>Tu código de acceso es:</p>
        <p style="font-size:30px;font-weight:700;letter-spacing:8px">${input.code}</p>
        <p>Expira en ${input.expiresMinutes} minutos.</p>
        <p style="color:#6b7280">Ambiente: DEV. Si no solicitaste este código, ignora este correo.</p>
      </div>
    `,
  });
}
