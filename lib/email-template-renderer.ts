import {
  buildEmailTemplateVariables,
  type EmailTemplateVariableContext,
} from "@/lib/email-template-variables";

export function escapeEmailHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function textToEmailHtml(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((line) => escapeEmailHtml(line))
        .join("<br />");

      return `<p>${lines}</p>`;
    })
    .join("");
}

export function sanitizeEmailHtml(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

export function stripEditorOnlyMarkup(html: string) {
  return sanitizeEmailHtml(html)
    .replace(/<hr\b[^>]*>/gi, "")
    .replace(/\scontenteditable\s*=\s*"[^"]*"/gi, "")
    .replace(/\scontenteditable\s*=\s*'[^']*'/gi, "")
    .replace(/\sdata-editor-only\s*=\s*"[^"]*"/gi, "")
    .replace(/\sdata-editor-only\s*=\s*'[^']*'/gi, "")
    .replace(/\sdata-editable\s*=\s*"[^"]*"/gi, "")
    .replace(/\sdata-editable\s*=\s*'[^']*'/gi, "")
    .replace(/\srole\s*=\s*"textbox"/gi, "")
    .replace(/\saria-label\s*=\s*"Cuerpo editable del correo"/gi, "")
    .replace(/\sid\s*=\s*"g66-email-editable-body"/gi, "")
    .replace(/\sstyle\s*=\s*"([^"]*)"/gi, (match, styleValue: string) => {
      const cleanedStyle = styleValue
        .split(";")
        .map((rule) => rule.trim())
        .filter(Boolean)
        .filter((rule) => {
          const normalized = rule.toLowerCase();

          if (normalized.includes("border") && normalized.includes("dashed")) return false;
          if (normalized.startsWith("border-top") && normalized.includes("solid")) return false;
          if (normalized.startsWith("outline")) return false;
          if (normalized.startsWith("resize")) return false;
          if (normalized.startsWith("cursor")) return false;
          if (normalized.startsWith("min-height")) return false;

          return true;
        })
        .join(";");

      return cleanedStyle ? ` style="${cleanedStyle}"` : "";
    });
}

export function renderEmailTemplate({
  htmlTemplate,
  subject,
  body,
  context,
}: {
  htmlTemplate: string;
  subject: string;
  body: string;
  context: EmailTemplateVariableContext;
}) {
  const variables = buildEmailTemplateVariables({ context, subject, body });
  const missingVariables = new Set<string>();

  function replaceVariable(_: string, key: string) {
    const normalizedKey = key.trim();
    if (normalizedKey === "email.body") {
      return textToEmailHtml(variables["email.body"]);
    }

    const value = variables[normalizedKey as keyof typeof variables];
    if (value === undefined) {
      missingVariables.add(normalizedKey);
      return "";
    }

    return escapeEmailHtml(value);
  }

  const renderedSubject = subject.replace(
    /\{\{\s*([^}]+?)\s*\}\}/g,
    (_, key: string) => {
      const normalizedKey = key.trim();
      const value = variables[normalizedKey as keyof typeof variables];

      if (value === undefined) {
        missingVariables.add(normalizedKey);
        return "";
      }

      return value;
    },
  );

  const rendered = htmlTemplate.replace(/\{\{\s*([^}]+?)\s*\}\}/g, replaceVariable);

  return {
    subject: renderedSubject,
    html: sanitizeEmailHtml(rendered),
    missingVariables: [...missingVariables],
  };
}

export function renderEmailTemplateWithBodyHtml({
  htmlTemplate,
  subject,
  body,
  bodyHtml,
  context,
}: {
  htmlTemplate: string;
  subject: string;
  body: string;
  bodyHtml: string;
  context: EmailTemplateVariableContext;
}) {
  const variables = buildEmailTemplateVariables({ context, subject, body });
  const missingVariables = new Set<string>();

  function replaceVariable(_: string, key: string) {
    const normalizedKey = key.trim();
    if (normalizedKey === "email.body") {
      return bodyHtml;
    }

    const value = variables[normalizedKey as keyof typeof variables];
    if (value === undefined) {
      missingVariables.add(normalizedKey);
      return "";
    }

    return escapeEmailHtml(value);
  }

  const renderedSubject = subject.replace(
    /\{\{\s*([^}]+?)\s*\}\}/g,
    (_, key: string) => {
      const normalizedKey = key.trim();
      const value = variables[normalizedKey as keyof typeof variables];

      if (value === undefined) {
        missingVariables.add(normalizedKey);
        return "";
      }

      return value;
    },
  );

  const rendered = htmlTemplate.replace(/\{\{\s*([^}]+?)\s*\}\}/g, replaceVariable);

  return {
    subject: renderedSubject,
    html: sanitizeEmailHtml(rendered),
    missingVariables: [...missingVariables],
  };
}
