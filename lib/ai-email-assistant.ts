import { GoogleGenAI } from "@google/genai";

export type EmailRewriteAction = "formalize" | "clarify" | "shorten" | "empathetic";

export type EmailRewriteContext = {
  case?: {
    case_number?: string | null;
    subject?: string | null;
    status?: string | null;
    priority?: string | null;
  } | null;
  customer?: {
    name?: string | null;
    email?: string | null;
  } | null;
  agent?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

const fallbackByAction: Record<EmailRewriteAction, string> = {
  formalize:
    "Hola {{customer.name}},\n\nEstamos revisando tu caso y te notificaremos por este mismo medio apenas tengamos novedades.\n\nQuedamos atentos a cualquier antecedente adicional que quieras compartir.",
  clarify:
    "Hola {{customer.name}},\n\nEstamos revisando tu caso. Te avisaremos por este mismo medio cuando tengamos una actualización.\n\nSi cuentas con más antecedentes, puedes responder este correo.",
  shorten:
    "Hola {{customer.name}}, estamos revisando tu caso y te avisaremos por este medio cuando tengamos novedades.",
  empathetic:
    "Hola {{customer.name}},\n\nEntendemos tu preocupación y ya estamos revisando tu caso con cuidado. Te notificaremos por este mismo medio apenas tengamos novedades.",
};

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
}

function resolveFallbackVariables(value: string, context: EmailRewriteContext) {
  return value
    .replaceAll("{{customer.name}}", context.customer?.name || "cliente")
    .replaceAll("{{case.case_number}}", context.case?.case_number || "tu caso")
    .replaceAll("{{agent.name}}", context.agent?.name || "Global66 Soporte");
}

function fallbackRewrite(rawMessage: string, action: EmailRewriteAction, context: EmailRewriteContext) {
  const trimmed = rawMessage.trim();
  const base = trimmed || fallbackByAction[action];

  if (action === "shorten" && trimmed) {
    return trimmed.length > 180 ? `${trimmed.slice(0, 177).trim()}...` : trimmed;
  }

  if (!trimmed) {
    return resolveFallbackVariables(fallbackByAction[action], context);
  }

  const prefixByAction: Record<EmailRewriteAction, string> = {
    formalize: "Hola {{customer.name}},\n\n",
    clarify: "Hola {{customer.name}},\n\nPara mayor claridad: ",
    shorten: "",
    empathetic: "Hola {{customer.name}},\n\nEntendemos tu preocupación. ",
  };

  return resolveFallbackVariables(`${prefixByAction[action]}${base}`, context);
}

export async function rewriteEmailMessage({
  rawMessage,
  action,
  context,
}: {
  rawMessage: string;
  action: EmailRewriteAction;
  context: EmailRewriteContext;
}) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      rewrittenText: fallbackRewrite(rawMessage, action, context),
      warnings: ["GEMINI_API_KEY no está configurada; se usó fallback local."],
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Reescribe el mensaje de un ejecutivo de soporte Global66.

Acción solicitada: ${action}

Contexto:
- Cliente: ${context.customer?.name || "Sin nombre"}
- Caso: ${context.case?.case_number || "Sin número"}
- Asunto: ${context.case?.subject || "Sin asunto"}
- Estado: ${context.case?.status || "Sin estado"}
- Prioridad: ${context.case?.priority || "Sin prioridad"}
- Agente: ${context.agent?.name || "Global66 Soporte"}

Mensaje bruto:
${rawMessage}

Reglas:
- Español latino.
- Tono profesional, claro y cercano.
- No inventes datos.
- No pidas claves, códigos ni contraseñas.
- Devuelve solo el texto final reescrito, sin markdown ni explicación.`;

  const response = await ai.models.generateContent({
    model: getGeminiModel(),
    contents: prompt,
  });

  return {
    rewrittenText:
      response.text?.trim() || fallbackRewrite(rawMessage, action, context),
    warnings: [],
  };
}
