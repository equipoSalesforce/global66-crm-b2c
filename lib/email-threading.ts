export function normalizeEmailSubject(subject: string) {
  return subject
    .replace(/^(\s*(re|fw|fwd)\s*:\s*)+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeMessageId(messageId: string | null | undefined) {
  const normalized = messageId
    ?.trim()
    .replace(/^<+/, "")
    .replace(/>+$/, "")
    .trim()
    .toLowerCase();

  return normalized || null;
}

export function buildEmailMessageBody({
  to,
  cc,
  bcc,
  subject,
  body,
}: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}) {
  return [
    `Para: ${to}`,
    cc ? `CC: ${cc}` : null,
    bcc ? "CCO: [redacted]" : null,
    `Asunto: ${subject}`,
    "",
    body,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
