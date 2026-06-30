import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  inReplyTo?: string | null;
  references?: string | null;
  attachments?: {
    filename: string;
    contentType?: string;
    contentBase64: string;
  }[];
};

export type SendEmailResult = {
  provider_message_id: string | null;
  accepted: string[];
  rejected: string[];
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} no está configurada.`);
  }

  return value;
}

function getSmtpPort() {
  const port = Number(process.env.GMAIL_SMTP_PORT ?? 465);

  return Number.isFinite(port) ? port : 465;
}

function splitAddressList(value?: string) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const senderEmail = getRequiredEnv("GMAIL_EMAIL");
  const transporter = nodemailer.createTransport({
    host: process.env.GMAIL_SMTP_HOST?.trim() || "smtp.gmail.com",
    port: getSmtpPort(),
    secure: getSmtpPort() === 465,
    auth: {
      user: senderEmail,
      pass: getRequiredEnv("GMAIL_APP_PASSWORD"),
    },
  });

  const info = await transporter.sendMail({
    from: senderEmail,
    to: splitAddressList(input.to),
    cc: splitAddressList(input.cc),
    bcc: splitAddressList(input.bcc),
    subject: input.subject,
    text: input.body,
    html: input.htmlBody || undefined,
    inReplyTo: input.inReplyTo || undefined,
    references: input.references || undefined,
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      content: Buffer.from(attachment.contentBase64, "base64"),
    })),
  });

  return {
    provider_message_id: info.messageId ?? null,
    accepted: info.accepted.map(String),
    rejected: info.rejected.map(String),
  };
}
