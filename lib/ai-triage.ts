import { GoogleGenAI } from "@google/genai";
import {
  GLOBAL66_SUPPORT_SYSTEM_PROMPT,
  buildGlobal66SupportReply,
  classifyGlobal66Intent,
  getGlobal66IntentCaseOverrides,
  shouldEscalateGlobal66Intent,
  type Global66SupportIntent,
} from "./ai/global66-support-agent";
import { assignCaseAutomatically } from "./assignment";
import { getCaseWhatsappTarget, isWhatsappCase } from "./case-whatsapp";
import { supabase } from "./supabase";
import { sendWhatsappMessage } from "./whatsapp-send";
import { retrieveKnowledge } from "./ai-knowledge-retrieval-service";
import { generateKnowledgeGroundedResponse } from "./ai/knowledge-grounded-response";

type CaseForTriage = {
  id: string | number;
  case_number: string | null;
  subject: string | null;
  area: string | null;
  category: string | null;
  product: string | null;
  subproduct: string | null;
  priority: string | null;
  status: string | null;
  lifecycle_status: string | null;
  routing_status: string | null;
  channel: string | null;
  contact_type: string | null;
  assigned_agent_id: string | null;
  assigned_to: string | null;
  customer:
    | {
        name: string | null;
        email: string | null;
        phone: string | null;
      }
    | {
        name: string | null;
        email: string | null;
        phone: string | null;
      }[]
    | null;
};

type CustomerMessage = {
  body: string | null;
  created_at: string | null;
};

type ConversationMessage = {
  body: string | null;
  created_at: string | null;
  sender_type: string | null;
  direction: string | null;
};

type KnowledgeArticle = {
  id: string | number | null;
  title: string | null;
  content: string | null;
  category: string | null;
};

type AiSettings = {
  auto_reply_enabled?: boolean | null;
  reply_when_assigned?: boolean | null;
  max_ai_replies_per_case?: number | null;
  escalation_message?: string | null;
};

type NormalizedAiSettings = {
  auto_reply_enabled: boolean;
  reply_when_assigned: boolean;
  max_ai_replies_per_case: number;
  escalation_message: string;
};

export type AiTriageResult =
  | {
      status: "completed";
      caseId: string;
      aiResolution: "AUTO_RESOLVED" | "HUMAN_REQUIRED";
      response: string;
      classification: {
        area: string;
        category: string;
        priority: string;
        aiSentiment: string;
        aiConfidence: number;
      };
    }
  | {
      status: "skipped";
      caseId: string;
      reason: string;
    }
  | {
      status: "error";
      reason: string;
      error: unknown;
    };

type RawTriageOutput = {
  area?: unknown;
  category?: unknown;
  priority?: unknown;
  ai_sentiment?: unknown;
  ai_confidence?: unknown;
  ai_resolution?: unknown;
  suggested_response?: unknown;
  summary?: unknown;
  used_articles?: unknown;
};

type UsedArticle = {
  articleId: string | number;
  articleTitle: string;
  relevanceScore: number;
};

type AiMessageInsert = {
  id: string | number;
};

type DemoIntent = Global66SupportIntent;

function logTriage(stage: string, details?: Record<string, unknown>) {
  console.info("[ai-triage]", {
    stage,
    ...details,
  });
}

const allowedAreas = [
  "GENERAL",
  "SOPORTE",
  "FACTURACION",
  "OPERACIONES",
  "COMPLIANCE",
  "VENTAS",
];
const allowedCategories = [
  "CONSULTA",
  "ACCESO",
  "INCIDENCIA",
  "PAGO",
  "DOCUMENTACION",
  "FACTURACION",
  "RECLAMO",
  "OTRO",
];
const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const allowedSentiments = ["POSITIVE", "NEUTRAL", "NEGATIVE"];
const allowedResolutions = ["AUTO_RESOLVED", "HUMAN_REQUIRED"] as const;
const fallbackGeminiModel = "gemini-2.5-flash-lite";
const humanHandoffMessage =
  "Un ejecutivo revisará el caso y te ayudará con el siguiente paso.";
const sentimentAliases: Record<string, string> = {
  POSITIVO: "POSITIVE",
  NEUTRO: "NEUTRAL",
  NEGATIVO: "NEGATIVE",
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || fallbackGeminiModel;
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const errorObject = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
  };
  const status = errorObject.status ?? errorObject.statusCode ?? errorObject.code;
  const numericStatus = Number(status);

  return Number.isFinite(numericStatus) ? numericStatus : null;
}

function isGeminiFallbackError(error: unknown) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    status === 429 ||
    message.includes("429") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("abort") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("econn") ||
    message.includes("socket") ||
    message.includes("etimedout")
  );
}

function logNormalizedValue(field: string, originalValue: unknown, normalizedValue: string) {
  const printableOriginal =
    typeof originalValue === "string" && originalValue.trim()
      ? originalValue.trim()
      : String(originalValue);

  console.info(
    `AI value normalized: ${field} ${printableOriginal} -> ${normalizedValue}`,
  );
}

function normalizeCatalogValue({
  field,
  value,
  allowedValues,
  fallback,
  aliases = {},
}: {
  field: string;
  value: unknown;
  allowedValues: readonly string[];
  fallback: string;
  aliases?: Record<string, string>;
}) {
  if (typeof value !== "string") {
    logNormalizedValue(field, value, fallback);
    return fallback;
  }

  const rawValue = value.trim();
  const normalized = rawValue.toUpperCase();
  const aliasedValue = aliases[normalized] ?? normalized;

  if (allowedValues.includes(aliasedValue)) {
    if (aliasedValue !== normalized) {
      logNormalizedValue(field, rawValue, aliasedValue);
    }

    return aliasedValue;
  }

  logNormalizedValue(field, rawValue, fallback);

  return fallback;
}

function normalizeConfidence(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, numericValue));
}

function normalizeRelevanceScore(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0.5;
  }

  if (numericValue > 1) {
    return Math.max(0, Math.min(100, numericValue)) / 100;
  }

  return Math.max(0, Math.min(1, numericValue));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function getSimilarity(left: string, right: string) {
  const leftTokens = new Set(getTokens(left));
  const rightTokens = new Set(getTokens(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return normalizeText(left) === normalizeText(right) ? 1 : 0;
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token));
  const union = new Set([...leftTokens, ...rightTokens]);

  return intersection.length / union.size;
}

function isRepeatedResponse(response: string, lastAiMessage: string | null) {
  if (!lastAiMessage?.trim()) return false;

  const normalizedResponse = normalizeText(response);
  const normalizedPrevious = normalizeText(lastAiMessage);

  return (
    normalizedResponse === normalizedPrevious ||
    getSimilarity(normalizedResponse, normalizedPrevious) >= 0.82
  );
}

function classifyDemoIntent(message: string | null | undefined): DemoIntent {
  return classifyGlobal66Intent(message);
}

function getArticleScore(article: KnowledgeArticle, message: string, intent: DemoIntent) {
  const messageTokens = new Set(getTokens(message));
  const articleText = `${article.title ?? ""} ${article.category ?? ""} ${
    article.content ?? ""
  }`;
  const articleTokens = new Set(getTokens(articleText));
  const overlap = [...messageTokens].filter((token) => articleTokens.has(token));
  let score = overlap.length;
  const normalizedTitle = normalizeText(article.title ?? "");

  if (intent === "HORARIO" && normalizedTitle.includes("horario")) score += 10;
  if (
    intent === "TRANSFERENCIA_NO_RECIBIDA" &&
    normalizedTitle.includes("transferencia")
  ) {
    score += 8;
  }
  if (
    intent === "TRANSFERENCIA_INTERNACIONAL" &&
    /\b(enviar|transferencia|internacional)\b/.test(normalizedTitle)
  ) {
    score += 10;
  }
  if (intent === "COMISIONES" && normalizedTitle.includes("comision")) score += 8;
  if (intent === "ACCESO_CUENTA" && /\b(acceso|bloque|cuenta)\b/.test(normalizedTitle)) {
    score += 8;
  }
  if (
    intent === "REVISION_MANUAL" &&
    /\b(bloque|identidad|rechaz|revision|cuenta)\b/.test(normalizedTitle)
  ) {
    score += 8;
  }
  if (
    intent === "MOVIMIENTO_DESCONOCIDO" &&
    /\b(movimiento|seguridad|transaccion)\b/.test(normalizedTitle)
  ) {
    score += 10;
  }
  if (
    intent === "COMPROBANTE_ADJUNTO" &&
    /\b(comprobante|archivo|adjunto|document)\b/.test(normalizedTitle)
  ) {
    score += 8;
  }

  return score;
}

function getIntentCaseOverrides(intent: DemoIntent) {
  return getGlobal66IntentCaseOverrides(intent);
}

function selectRelevantArticles({
  articles,
  latestMessage,
  intent,
}: {
  articles: KnowledgeArticle[];
  latestMessage: string;
  intent: DemoIntent;
}) {
  if (intent === "DESCONOCIDO") return [];

  return articles
    .map((article) => ({
      article,
      score: getArticleScore(article, latestMessage, intent),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.article);
}

function getCustomer(caseItem: CaseForTriage) {
  return Array.isArray(caseItem.customer)
    ? caseItem.customer[0] ?? null
    : caseItem.customer;
}

function normalizeAiSettings(settings: AiSettings | null): NormalizedAiSettings {
  return {
    auto_reply_enabled: settings?.auto_reply_enabled ?? true,
    reply_when_assigned: settings?.reply_when_assigned ?? false,
    max_ai_replies_per_case: settings?.max_ai_replies_per_case ?? 6,
    escalation_message:
      settings?.escalation_message?.trim() || humanHandoffMessage,
  };
}

function extractJson(text: string) {
  const fencedJson = text.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedJson?.[1]) {
    return fencedJson[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function parseTriageOutput(text: string): RawTriageOutput {
  try {
    return JSON.parse(extractJson(text)) as RawTriageOutput;
  } catch (error) {
    console.error("[ai-triage] Error parsing Gemini JSON", {
      message: getErrorMessage(error),
      rawText: text,
      error,
    });

    return {};
  }
}

function buildKnowledgeContext(articles: KnowledgeArticle[]) {
  if (articles.length === 0) {
    return "No hay artículos activos disponibles.";
  }

  return articles
    .map(
      (article, index) =>
        `Artículo ${index + 1}\nID: ${article.id ?? "sin-id"}\nTítulo: ${
          article.title || "Sin título"
        }\nCategoría: ${
          article.category || "Sin categoría"
        }\nContenido: ${article.content || "Sin contenido"}`,
    )
    .join("\n\n---\n\n");
}

function buildPreviousCustomerMessages(messages: CustomerMessage[]) {
  if (messages.length === 0) {
    return "No hay mensajes CUSTOMER previos.";
  }

  return messages
    .map(
      (message, index) =>
        `${index + 1}. ${message.created_at || "Sin fecha"}: ${
          message.body || "Sin contenido"
        }`,
    )
    .join("\n");
}

function buildConversationContext(messages: ConversationMessage[]) {
  if (messages.length === 0) {
    return "No hay historial de conversación.";
  }

  return messages
    .map((message, index) => {
      const sender = message.sender_type?.toUpperCase() || "UNKNOWN";
      const direction = message.direction?.toUpperCase() || "UNKNOWN";

      return `${index + 1}. ${message.created_at || "Sin fecha"} · ${sender}/${direction}: ${
        message.body || "Sin contenido"
      }`;
    })
    .join("\n");
}

function getLatestCustomerMessage(messages: CustomerMessage[]) {
  return [...messages].reverse().find((message) => message.body?.trim()) ?? null;
}

function getPreviousCustomerMessages(
  messages: CustomerMessage[],
  latestCustomerMessage: CustomerMessage | null,
) {
  const previousMessages = latestCustomerMessage
    ? messages.filter((message) => message !== latestCustomerMessage)
    : messages;

  return previousMessages.slice(-5);
}

async function loadTriageContext(caseId: string) {
  logTriage("inicio triage", { caseId });

  const [
    caseResult,
    messagesResult,
    conversationResult,
    articlesResult,
    settingsResult,
  ] = await Promise.all([
    supabase
      .from("cases")
      .select(
        "id, case_number, subject, area, category, product, subproduct, priority, status, lifecycle_status, routing_status, channel, contact_type, assigned_agent_id, assigned_to, customer:customers(name, email, phone)",
      )
      .eq("id", caseId)
      .limit(1)
      .returns<CaseForTriage[]>(),
    supabase
      .from("messages")
      .select("body, created_at")
      .eq("case_id", caseId)
      .eq("sender_type", "CUSTOMER")
      .order("created_at", { ascending: true })
      .returns<CustomerMessage[]>(),
    supabase
      .from("messages")
      .select("body, created_at, sender_type, direction")
      .eq("case_id", caseId)
      .in("sender_type", ["CUSTOMER", "AI", "AGENT"])
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<ConversationMessage[]>(),
    supabase
      .from("knowledge_articles")
      .select("id, title, content, category")
      .eq("is_active", true)
      .returns<KnowledgeArticle[]>(),
    supabase.from("ai_settings").select("*").limit(1).returns<AiSettings[]>(),
  ]);

  if (caseResult.error || !caseResult.data?.[0]) {
    throw caseResult.error ?? new Error("Caso no encontrado.");
  }

  if (messagesResult.error) {
    throw messagesResult.error;
  }

  if (conversationResult.error) {
    throw conversationResult.error;
  }

  if (articlesResult.error) {
    throw articlesResult.error;
  }

  return {
    caseItem: caseResult.data[0],
    messages: messagesResult.data ?? [],
    conversationMessages: [...(conversationResult.data ?? [])].reverse(),
    articles: articlesResult.data ?? [],
    settings: normalizeAiSettings(settingsResult.data?.[0] ?? null),
  };
}

async function callGeminiTriage({
  caseItem,
  latestCustomerMessage,
  previousCustomerMessages,
  conversationMessages,
  articles,
  intent,
}: {
  caseItem: CaseForTriage;
  latestCustomerMessage: CustomerMessage | null;
  previousCustomerMessages: CustomerMessage[];
  conversationMessages: ConversationMessage[];
  articles: KnowledgeArticle[];
  intent: DemoIntent;
}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no está configurada.");
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const model = getGeminiModel();
  const customer = getCustomer(caseItem);
const prompt = `Clasifica y decide el tratamiento del caso.

${GLOBAL66_SUPPORT_SYSTEM_PROMPT}

Datos del caso:
- case_number: ${caseItem.case_number || "Sin número"}
- subject: ${caseItem.subject || "Sin asunto"}
- channel: ${caseItem.channel || "Sin canal"}
- contact_type: ${caseItem.contact_type || "Sin tipo"}
- area: ${caseItem.area || "Sin área"}
- category: ${caseItem.category || "Sin categoría"}
- priority: ${caseItem.priority || "Sin prioridad"}
- lifecycle_status: ${caseItem.lifecycle_status || "Sin lifecycle_status"}
- routing_status: ${caseItem.routing_status || "Sin routing_status"}

Datos cliente:
- name: ${customer?.name || "Sin nombre"}
- email: ${customer?.email || "Sin email"}
- phone: ${customer?.phone || "Sin teléfono"}

Intención demo detectada:
${intent}

ÚLTIMO MENSAJE CUSTOMER - intención principal obligatoria:
${latestCustomerMessage?.body?.trim() || "No hay último mensaje CUSTOMER."}

Historial CUSTOMER previo - contexto secundario:
${buildPreviousCustomerMessages(previousCustomerMessages)}

Últimos 10 mensajes del caso en orden cronológico:
${buildConversationContext(conversationMessages)}

Base de conocimiento relevante disponible, máximo 3 artículos:
${buildKnowledgeContext(articles)}

Devuelve SOLO JSON válido con esta forma:
{
  "area": "GENERAL|SOPORTE|FACTURACION|OPERACIONES|COMPLIANCE|VENTAS",
  "category": "CONSULTA|ACCESO|INCIDENCIA|PAGO|DOCUMENTACION|FACTURACION|RECLAMO|OTRO",
  "priority": "LOW|MEDIUM|HIGH|URGENT",
  "ai_sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "ai_confidence": 0.0,
  "ai_resolution": "AUTO_RESOLVED|HUMAN_REQUIRED",
  "suggested_response": "respuesta breve y útil en español",
  "summary": "resumen operativo breve",
  "used_articles": [
    {
      "article_id": "id exacto del artículo usado",
      "relevance_score": 0.95
    }
  ]
}

No uses valores traducidos ni sinónimos en area, category, priority, ai_sentiment o ai_resolution. Usa exclusivamente uno de los valores exactos indicados.
Determina qué artículos son relevantes para responder la última pregunta del cliente. Usa únicamente artículos relevantes y suficientes para construir la respuesta.
En used_articles incluye SOLO article_id de artículos de la base de conocimiento que hayas usado de forma real para clasificar o responder. Si ningún artículo es suficiente, devuelve [].
Responde únicamente la última pregunta del cliente. Usa el historial solo para entender referencias. No mezcles temas anteriores.
No uses mensajes AGENT ni mensajes AI para decidir intención. La intención principal SIEMPRE es el último mensaje CUSTOMER.
Puedes usar mensajes AGENT y AI solo como contexto histórico para evitar repetir respuestas o entender referencias, pero no para decidir la intención principal.
No mezcles artículos ni temas de preguntas anteriores.
Si ningún artículo relevante es suficiente pero la consulta es normal o inicial, conversa primero y pide un dato concreto. No derives inmediatamente.
No repitas la misma respuesta anterior. Si ya respondiste horario y el cliente pregunta otra cosa, no repitas horario salvo que pregunte por horario.
Responde breve, claro y útil. No inventes datos. Si el cliente pregunta algo ambiguo, pide un dato concreto.
Mantén tono cercano y profesional. No digas que eres una IA salvo que sea necesario.

Reglas demo:
- Si intención SALUDO_GENERICO, saluda y pregunta qué necesita, dando ejemplos de temas. No derives.
- Si intención HORARIO, responde horario solo si el último mensaje pregunta por horario y hay artículo suficiente.
- Si intención TRANSFERENCIA_INTERNACIONAL, explica pasos generales seguros para enviar dinero: iniciar transferencia, elegir país destino, ingresar destinatario, revisar monto/tipo de cambio/comisión y confirmar. Cierra preguntando desde qué país hará el envío. No derives.
- Si intención TRANSFERENCIA_NO_RECIBIDA, pide primero cuándo realizó la transferencia y si tiene comprobante. No pidas todo de golpe.
- Si intención COMISIONES, explica que comisión y tipo de cambio se muestran antes de confirmar. Si hay cobro desconocido, deriva a revisión.
- Si intención ACCESO_CUENTA, pide correo o teléfono asociado y el mensaje de error. Nunca pidas claves, códigos ni contraseñas.
- Si intención REVISION_MANUAL, usa HUMAN_REQUIRED y explica que un ejecutivo debe revisar el caso.
- Si intención MOVIMIENTO_DESCONOCIDO, prioridad HIGH, pide fecha, monto, moneda y referencia visible, y deriva a ejecutivo.
- Si intención COMPROBANTE_ADJUNTO, confirma recepción del archivo y deriva si requiere validación manual.
- Si intención DESCONOCIDO, usa HUMAN_REQUIRED y responde que no lograste identificar con seguridad la consulta.

Usa AUTO_RESOLVED solo si puedes responder con confianza usando el contexto y no hay señales de reclamo grave, riesgo legal, pagos no conciliados, seguridad, escalación o urgencia humana.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction:
        `${GLOBAL66_SUPPORT_SYSTEM_PROMPT}\n\nClasificas casos de soporte omnicanal, generas respuesta sugerida y decides si la IA puede resolver o requiere humano. Responde exclusivamente JSON válido. Responde únicamente la última pregunta del cliente; el historial previo solo sirve para referencias.`,
    },
  });

  const responseText = response.text?.trim() ?? "";

  logTriage("respuesta Gemini", {
    caseId: String(caseItem.id),
    model,
    responsePreview: responseText.slice(0, 1200),
  });

  return responseText;
}

async function insertAiMessage({
  caseId,
  body,
  channel = "AI",
  externalMessageId = null,
  deliveryStatus = null,
}: {
  caseId: string;
  body: string;
  channel?: "AI" | "WHATSAPP";
  externalMessageId?: string | null;
  deliveryStatus?: "SENT" | "DELIVERED" | "READ" | null;
}) {
  logTriage("inserción mensaje AI", {
    caseId,
    channel,
    externalMessageId,
    deliveryStatus,
    bodyPreview: body.slice(0, 240),
  });

  const { data, error } = await supabase
    .from("messages")
    .insert({
      case_id: caseId,
      direction: "OUTBOUND",
      sender_type: "AI",
      body,
      channel,
      message_type: "TEXT",
      external_message_id: externalMessageId,
      delivery_status: deliveryStatus,
    })
    .select("id")
    .single<AiMessageInsert>();

  if (error || !data?.id) {
    throw error ?? new Error("No se pudo obtener message_id de la respuesta AI.");
  }

  logTriage("mensaje AI insertado", {
    caseId,
    messageId: data.id,
  });

  return data.id;
}

function getUsedArticles(
  rawUsedArticles: unknown,
  articles: KnowledgeArticle[],
): UsedArticle[] {
  if (!Array.isArray(rawUsedArticles)) {
    return [];
  }

  const usedArticles = new Map<string, UsedArticle>();

  rawUsedArticles.forEach((rawArticle) => {
    if (!rawArticle || typeof rawArticle !== "object") {
      return;
    }

    const articlePayload = rawArticle as {
      article_id?: unknown;
      relevance_score?: unknown;
    };
    const articleId =
      typeof articlePayload.article_id === "string" ||
      typeof articlePayload.article_id === "number"
        ? String(articlePayload.article_id)
        : "";
    const article = articles.find((item) => String(item.id) === articleId);

    if (!article?.id) {
      return;
    }

    usedArticles.set(String(article.id), {
      articleId: article.id,
      articleTitle: article.title || "Artículo sin título",
      relevanceScore: normalizeRelevanceScore(articlePayload.relevance_score),
    });
  });

  return [...usedArticles.values()];
}

async function saveMessageArticles({
  caseId,
  messageId,
  usedArticles,
}: {
  caseId: string;
  messageId: string | number;
  usedArticles: UsedArticle[];
}) {
  logTriage("inserción en ai_message_articles", {
    caseId,
    messageId,
    articleCount: usedArticles.length,
  });

  if (usedArticles.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("ai_message_articles").insert(
    usedArticles.map((article) => ({
      case_id: caseId,
      message_id: messageId,
      article_id: article.articleId,
      article_title: article.articleTitle,
      relevance_score: article.relevanceScore,
    })),
  );

  if (insertError) {
    console.error("[ai-triage] Error inserting ai_message_articles", {
      message: getErrorMessage(insertError),
      supabaseError: insertError,
      articleCount: usedArticles.length,
    });
  }
}

async function insertInternalAiWhatsappFailureNote({
  caseId,
  error,
}: {
  caseId: string;
  error: string;
}) {
  const body = `IA generó respuesta pero falló envío WhatsApp: ${error}`;

  const { error: insertError } = await supabase.from("messages").insert({
    case_id: caseId,
    direction: "INTERNAL",
    sender_type: "SYSTEM",
    channel: "INTERNAL",
    message_type: "NOTE",
    delivery_status: "FAILED",
    body,
  });

  if (insertError) {
    console.error("[ai-whatsapp] failed to insert internal failure note", {
      caseId,
      message: insertError.message,
      supabaseError: insertError,
    });
  }
}

async function sendAiWhatsappMessage({
  caseId,
  body,
}: {
  caseId: string;
  body: string;
}): Promise<
  | {
      ok: true;
      metaMessageId: string;
    }
  | {
      ok: false;
      error: string;
    }
> {
  console.info("[ai-whatsapp] generated reply", {
    caseId,
    bodyPreview: body.slice(0, 240),
  });

  const target = await getCaseWhatsappTarget(caseId);

  if (!target.ok) {
    const error = target.error;

    console.error("[ai-whatsapp] send failed", {
      caseId,
      error,
      supabaseError: target.supabaseError ?? null,
    });

    return {
      ok: false,
      error,
    };
  }

  if (!target.isWhatsapp) {
    const error = "Caso no es WhatsApp; no se envía respuesta automática.";

    console.info("[ai-whatsapp] send skipped", {
      caseId,
      phone: target.phone,
      error,
    });

    return {
      ok: false,
      error,
    };
  }

  if (!target.phone) {
    const error = "No existe teléfono para enviar respuesta WhatsApp.";

    console.error("[ai-whatsapp] send failed", {
      caseId,
      phone: null,
      error,
    });

    return {
      ok: false,
      error,
    };
  }

  console.info("[ai-whatsapp] sending to Meta", {
    caseId,
    phone: target.phone,
    bodyPreview: body.slice(0, 240),
  });

  const result = await sendWhatsappMessage(target.phone, body);

  if (!result.ok) {
    console.error("[ai-whatsapp] send failed", {
      caseId,
      phone: target.phone,
      error: result.error,
      metaResponse: result.response ?? null,
    });

    return {
      ok: false,
      error: result.error,
    };
  }

  console.info("[ai-whatsapp] sent ok", {
    caseId,
    phone: target.phone,
    metaMessageId: result.messageId,
    metaResponse: result.response,
  });

  return {
    ok: true,
    metaMessageId: result.messageId,
  };
}

async function markHumanRequiredAndAssign({
  caseId,
  caseItem,
  body,
  usedArticles,
}: {
  caseId: string;
  caseItem: CaseForTriage;
  body: string;
  usedArticles: UsedArticle[];
}) {
  let messageId: string | number | null = null;
  const isWhatsappHandoff = isWhatsappCase({
    channel: caseItem.channel,
    contactType: caseItem.contact_type,
  });

  if (isWhatsappHandoff) {
    const whatsappResult = await sendAiWhatsappMessage({
      caseId,
      body,
    });

    if (whatsappResult.ok) {
      messageId = await insertAiMessage({
        caseId,
        body,
        channel: "WHATSAPP",
        externalMessageId: whatsappResult.metaMessageId,
        deliveryStatus: "SENT",
      });
    } else {
      await insertInternalAiWhatsappFailureNote({
        caseId,
        error: whatsappResult.error,
      });
    }
  } else {
    messageId = await insertAiMessage({
      caseId,
      body,
    });
  }

  logTriage("mensaje AI guardado", {
    caseId,
    messageId,
    aiResolution: "HUMAN_REQUIRED",
  });

  if (messageId !== null) {
    await saveMessageArticles({
      caseId,
      messageId,
      usedArticles,
    });
  }

  logTriage("marcando HUMAN_REQUIRED", { caseId });

  const { error: humanRequiredError } = await supabase
    .from("cases")
    .update({
      ai_resolution: "HUMAN_REQUIRED",
      status: "HUMAN_REQUIRED",
      routing_status: "HUMAN_REQUIRED",
      lifecycle_status: "IN_PROGRESS",
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId);

  if (humanRequiredError) {
    throw humanRequiredError;
  }

  logTriage("agente actual", {
    caseId,
    assignedAgentId: caseItem.assigned_agent_id,
    assignedTo: caseItem.assigned_to,
  });

  if (caseItem.assigned_agent_id) {
    logTriage("Case already assigned. Skipping auto assignment.", {
      caseId,
      assignedAgentId: caseItem.assigned_agent_id,
      assignedTo: caseItem.assigned_to,
      reason: "AI triage no reemplaza agentes existentes.",
    });
    return;
  }

  logTriage("asignación automática", {
    caseId,
    reason: "Caso sin assigned_agent_id.",
  });

  const assignmentResult = await assignCaseAutomatically(caseId);

  if (assignmentResult.status === "error") {
    console.error("[ai-triage] Assignment after triage failed", {
      message: assignmentResult.reason,
      assignmentError: assignmentResult.error,
    });
  } else {
    logTriage("resultado asignación automática", {
      caseId,
      assignmentStatus: assignmentResult.status,
      reason: assignmentResult.reason,
    });
  }
}

function isAssignedToHuman(caseItem: CaseForTriage) {
  return Boolean(
    caseItem.routing_status === "ASSIGNED" ||
      caseItem.assigned_agent_id ||
      caseItem.assigned_to ||
      caseItem.status === "ASSIGNED",
  );
}

function isClosedCase(caseItem: CaseForTriage) {
  return caseItem.lifecycle_status === "CLOSED" || caseItem.status === "CLOSED";
}

function canAutoReplyWithAi(caseItem: CaseForTriage) {
  if (isClosedCase(caseItem)) {
    return {
      ok: false,
      reason: "case closed",
    };
  }

  if (isAssignedToHuman(caseItem)) {
    return {
      ok: false,
      reason: "case assigned to human",
    };
  }

  if (caseItem.routing_status === "AI_HANDLING") {
    return {
      ok: true,
      reason: "routing_status AI_HANDLING",
    };
  }

  if (
    caseItem.routing_status === "UNASSIGNED" &&
    caseItem.status === "AI_HANDLING"
  ) {
    return {
      ok: true,
      reason: "UNASSIGNED with status AI_HANDLING",
    };
  }

  return {
    ok: false,
    reason: `routing/status not eligible: ${caseItem.routing_status || "null"}/${
      caseItem.status || "null"
    }`,
  };
}

function getLastAiMessage(messages: ConversationMessage[]) {
  return (
    [...messages]
      .reverse()
      .find((message) => message.sender_type?.toUpperCase() === "AI")?.body ?? null
  );
}

function countAiMessages(messages: ConversationMessage[]) {
  return messages.filter((message) => message.sender_type?.toUpperCase() === "AI")
    .length;
}

export async function generateAgentAiSuggestion(caseId: string) {
  const { caseItem, messages, conversationMessages } =
    await loadTriageContext(caseId);
  const latestCustomerMessage = getLatestCustomerMessage(messages);
  const intent = classifyDemoIntent(latestCustomerMessage?.body);
  const knowledgeResults = latestCustomerMessage?.body?.trim()
    ? await retrieveKnowledge({
        query: latestCustomerMessage.body,
        caseId,
        product: caseItem.product || caseItem.subproduct,
        category: caseItem.category,
        includeInternal: true,
        limit: 8,
      })
    : [];
  const groundedSuggestion = await generateKnowledgeGroundedResponse({
    query: latestCustomerMessage?.body?.trim() || "El cliente todavía no ha formulado una consulta.",
    conversation: conversationMessages
      .map((message) => `${message.sender_type || message.direction || "UNKNOWN"}: ${message.body || ""}`)
      .join("\n"),
    caseMetadata: {
      caseNumber: caseItem.case_number,
      product: caseItem.product,
      subproduct: caseItem.subproduct,
      category: caseItem.category,
      area: caseItem.area,
    },
    results: knowledgeResults,
  });
  const suggestion = groundedSuggestion.customerReply;

  logTriage("sugerencia IA ejecutivo generada", {
    caseId,
    caseNumber: caseItem.case_number,
    intent,
    relevantArticleCount: knowledgeResults.length,
    latestCustomerMessage: latestCustomerMessage?.body ?? null,
    suggestionPreview: suggestion.slice(0, 300),
  });

  return {
    suggestion,
    intent,
    usedArticles: knowledgeResults.map((result) => ({ id: result.articleId, title: result.title, category: result.category })),
    ...groundedSuggestion,
  };
}

export async function runAiTriage(caseId: string): Promise<AiTriageResult> {
  try {
    const { caseItem, messages, conversationMessages, articles, settings } =
      await loadTriageContext(caseId);
    const latestCustomerMessage = getLatestCustomerMessage(messages);
    const previousCustomerMessages = getPreviousCustomerMessages(
      messages,
      latestCustomerMessage,
    );
    const autoReplyDecision = canAutoReplyWithAi(caseItem);
    const aiMessageCount = countAiMessages(conversationMessages);
    const lastAiMessage = getLastAiMessage(conversationMessages);
    const intent = classifyDemoIntent(latestCustomerMessage?.body);
    console.info("[global66-ai] intent detected", {
      caseId,
      intent,
      latestCustomerMessage: latestCustomerMessage?.body ?? null,
    });
    const relevantArticles = selectRelevantArticles({
      articles,
      latestMessage: latestCustomerMessage?.body ?? "",
      intent,
    });

    if (!settings.auto_reply_enabled) {
      logTriage("auto reply disabled by settings", { caseId });

      return {
        status: "skipped",
        caseId,
        reason: "auto_reply_enabled=false",
      };
    }

    if (!autoReplyDecision.ok) {
      if (autoReplyDecision.reason === "case assigned to human") {
        console.info("[global66-ai] skipped assigned human", {
          caseId,
          routingStatus: caseItem.routing_status,
          status: caseItem.status,
          assignedAgentId: caseItem.assigned_agent_id,
          assignedTo: caseItem.assigned_to,
        });
        console.info("[ai-autoreply] skipped because case assigned to human", {
          caseId,
          routingStatus: caseItem.routing_status,
          status: caseItem.status,
          assignedAgentId: caseItem.assigned_agent_id,
          assignedTo: caseItem.assigned_to,
        });
      } else {
        logTriage("auto reply skipped", {
          caseId,
          reason: autoReplyDecision.reason,
        });
      }

      return {
        status: "skipped",
        caseId,
        reason: autoReplyDecision.reason,
      };
    }

    if (
      aiMessageCount >= settings.max_ai_replies_per_case &&
      shouldEscalateGlobal66Intent(intent)
    ) {
      const escalationResponse = buildGlobal66SupportReply({
        intent,
        latestMessage: latestCustomerMessage?.body,
      });

      console.info("[global66-ai] action escalate", {
        caseId,
        intent,
        reason: "max-ai-replies",
      });
      logTriage("max AI replies reached; escalating", {
        caseId,
        aiMessageCount,
        maxAiRepliesPerCase: settings.max_ai_replies_per_case,
      });

      await markHumanRequiredAndAssign({
        caseId,
        caseItem,
        body: escalationResponse,
        usedArticles: [],
      });

      return {
        status: "completed",
        caseId,
        aiResolution: "HUMAN_REQUIRED",
        response: escalationResponse,
        classification: {
          area: "GENERAL",
          category: "OTRO",
          priority: "MEDIUM",
          aiSentiment: "NEUTRAL",
          aiConfidence: 0,
        },
      };
    }

    if (aiMessageCount >= settings.max_ai_replies_per_case) {
      logTriage("max AI replies reached but intent is answerable; continuing", {
        caseId,
        intent,
        aiMessageCount,
        maxAiRepliesPerCase: settings.max_ai_replies_per_case,
      });
    }

    logTriage("artículos encontrados", {
      caseId,
      articleCount: articles.length,
      relevantArticleCount: relevantArticles.length,
      customerMessageCount: messages.length,
      conversationMessageCount: conversationMessages.length,
      aiMessageCount,
      intent,
    });
    logTriage("último mensaje CUSTOMER usado", {
      caseId,
      latestCustomerMessage: latestCustomerMessage?.body ?? null,
      latestCustomerMessageCreatedAt: latestCustomerMessage?.created_at ?? null,
    });
    logTriage("artículos enviados a Gemini", {
      caseId,
      articleCount: relevantArticles.length,
      articles: relevantArticles.map((article, index) => ({
        index: index + 1,
        id: article.id,
        title: article.title,
      })),
    });

    let rawResponse: string;

    try {
      rawResponse = await callGeminiTriage({
        caseItem,
        latestCustomerMessage,
        previousCustomerMessages,
        conversationMessages,
        articles: relevantArticles,
        intent,
      });
    } catch (error) {
      if (!isGeminiFallbackError(error)) {
        throw error;
      }

      console.error("[ai-triage] Gemini fallback triggered", {
        caseId,
        message: getErrorMessage(error),
        status: getErrorStatus(error),
        error,
      });

      rawResponse = JSON.stringify({
        area: getIntentCaseOverrides(intent)?.area ?? "GENERAL",
        category: getIntentCaseOverrides(intent)?.category ?? "OTRO",
        priority: getIntentCaseOverrides(intent)?.priority ?? "MEDIUM",
        ai_sentiment: "NEUTRAL",
        ai_confidence: shouldEscalateGlobal66Intent(intent) ? 0.45 : 0.7,
        ai_resolution: shouldEscalateGlobal66Intent(intent)
          ? "HUMAN_REQUIRED"
          : "AUTO_RESOLVED",
        suggested_response: buildGlobal66SupportReply({
          intent,
          latestMessage: latestCustomerMessage?.body,
        }),
        summary: "Respuesta generada con fallback local Global66.",
        used_articles: [],
      });
    }

    const parsed = parseTriageOutput(rawResponse);
    let area = normalizeCatalogValue({
      field: "area",
      value: parsed.area,
      allowedValues: allowedAreas,
      fallback: "GENERAL",
    });
    let category = normalizeCatalogValue({
      field: "category",
      value: parsed.category,
      allowedValues: allowedCategories,
      fallback: "OTRO",
    });
    let priority = normalizeCatalogValue({
      field: "priority",
      value: parsed.priority,
      allowedValues: allowedPriorities,
      fallback: "MEDIUM",
    });
    const aiSentiment = normalizeCatalogValue({
      field: "ai_sentiment",
      value: parsed.ai_sentiment,
      allowedValues: allowedSentiments,
      fallback: "NEUTRAL",
      aliases: sentimentAliases,
    });
    const aiConfidence = normalizeConfidence(parsed.ai_confidence);
    let aiResolution = normalizeCatalogValue({
      field: "ai_resolution",
      value: parsed.ai_resolution,
      allowedValues: allowedResolutions,
      fallback: "HUMAN_REQUIRED",
    }) as "AUTO_RESOLVED" | "HUMAN_REQUIRED";
    let suggestedResponse =
      typeof parsed.suggested_response === "string" &&
      parsed.suggested_response.trim()
        ? parsed.suggested_response.trim()
        : buildGlobal66SupportReply({
            intent,
            latestMessage: latestCustomerMessage?.body,
          });
    const intentOverrides = getIntentCaseOverrides(intent);

    if (intentOverrides) {
      area = intentOverrides.area;
      category = intentOverrides.category;
      priority = intentOverrides.priority;
    }

    if (
      normalizeText(suggestedResponse).includes(
        normalizeText("puedes enviarnos más antecedentes de la operación"),
      )
    ) {
      suggestedResponse = buildGlobal66SupportReply({
        intent,
        latestMessage: latestCustomerMessage?.body,
      });
      logTriage("respuesta genérica reemplazada por sugerencia específica", {
        caseId,
        intent,
      });
    }
    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "Triage IA ejecutado.";
    const usedArticles = getUsedArticles(parsed.used_articles, relevantArticles);
    const now = new Date().toISOString();

    logTriage("used_articles recibidos", {
      caseId,
      usedArticles: usedArticles.map((article) => ({
        articleId: article.articleId,
        articleTitle: article.articleTitle,
        relevanceScore: article.relevanceScore,
      })),
    });

    if (
      aiResolution === "AUTO_RESOLVED" &&
      usedArticles.length === 0 &&
      shouldEscalateGlobal66Intent(intent)
    ) {
      aiResolution = "HUMAN_REQUIRED";
      suggestedResponse = buildGlobal66SupportReply({
        intent,
        latestMessage: latestCustomerMessage?.body,
      });
      logTriage("AUTO_RESOLVED sin artículos suficientes; forzando HUMAN_REQUIRED", {
        caseId,
        forcedResolution: aiResolution,
      });
    } else if (aiResolution === "HUMAN_REQUIRED") {
      if (shouldEscalateGlobal66Intent(intent)) {
        suggestedResponse = buildGlobal66SupportReply({
          intent,
          latestMessage: latestCustomerMessage?.body,
        });
      } else {
        aiResolution = "AUTO_RESOLVED";
        suggestedResponse = buildGlobal66SupportReply({
          intent,
          latestMessage: latestCustomerMessage?.body,
        });
        logTriage("HUMAN_REQUIRED convertido a conversación IA", {
          caseId,
          intent,
        });
      }
    }

    if (shouldEscalateGlobal66Intent(intent)) {
      aiResolution = "HUMAN_REQUIRED";
      suggestedResponse = buildGlobal66SupportReply({
        intent,
        latestMessage: latestCustomerMessage?.body,
      });
      logTriage("intención requiere humano; forzando HUMAN_REQUIRED", {
        caseId,
        intent,
      });
    }

    if (aiConfidence < 0.55 && shouldEscalateGlobal66Intent(intent)) {
      aiResolution = "HUMAN_REQUIRED";
      suggestedResponse = buildGlobal66SupportReply({
        intent,
        latestMessage: latestCustomerMessage?.body,
      });
      logTriage("confianza baja; forzando HUMAN_REQUIRED", {
        caseId,
        aiConfidence,
      });
    } else if (aiConfidence < 0.55) {
      aiResolution = "AUTO_RESOLVED";
      suggestedResponse = buildGlobal66SupportReply({
        intent,
        latestMessage: latestCustomerMessage?.body,
      });
      logTriage("confianza baja pero consulta normal; conversación IA continúa", {
        caseId,
        intent,
        aiConfidence,
      });
    }

    if (isRepeatedResponse(suggestedResponse, lastAiMessage)) {
      if (shouldEscalateGlobal66Intent(intent)) {
        aiResolution = "HUMAN_REQUIRED";
      } else {
        aiResolution = "AUTO_RESOLVED";
      }
      suggestedResponse =
        intent === "TRANSFERENCIA_NO_RECIBIDA"
          ? "Para revisar esa transferencia, dime aproximadamente cuándo la realizaste y si tienes el comprobante. Con eso podemos validar el estado de la operación."
          : intent === "TRANSFERENCIA_INTERNACIONAL"
            ? "Puedes enviar dinero desde Global66 creando una transferencia, seleccionando el país destino y revisando el monto, comisión y tipo de cambio antes de confirmar. ¿Desde qué país harás el envío?"
            : buildGlobal66SupportReply({
                intent,
                latestMessage: `${latestCustomerMessage?.body ?? ""} alternativa`,
              });
      logTriage("respuesta repetida detectada; generando alternativa", {
        caseId,
        lastAiMessagePreview: lastAiMessage?.slice(0, 240) ?? null,
        suggestedResponsePreview: suggestedResponse.slice(0, 240),
      });
    }

    logTriage("respuesta generada", {
      caseId,
      suggestedResponsePreview: suggestedResponse.slice(0, 500),
    });

    logTriage("resultado normalizado", {
      caseId,
      area,
      category,
      priority,
      aiSentiment,
      aiConfidence,
      aiResolution,
      usedArticleCount: usedArticles.length,
    });

    logTriage("actualización de cases", {
      caseId,
      area,
      category,
      priority,
      aiResolution,
    });

    const { error: updateError } = await supabase
      .from("cases")
      .update({
        area,
        category,
        priority,
        ai_summary: summary,
        ai_category: category,
        ai_sentiment: aiSentiment,
        ai_confidence: aiConfidence,
        ai_resolution: aiResolution,
        updated_at: now,
      })
      .eq("id", caseId);

    if (updateError) {
      throw updateError;
    }

    if (aiResolution === "AUTO_RESOLVED") {
      console.info("[global66-ai] action respond", {
        caseId,
        intent,
        aiResolution,
      });
      const isWhatsappAutoResolved = isWhatsappCase({
        channel: caseItem.channel,
        contactType: caseItem.contact_type,
      });

      if (isWhatsappAutoResolved) {
        const whatsappResult = await sendAiWhatsappMessage({
          caseId,
          body: suggestedResponse,
        });

        if (!whatsappResult.ok) {
          console.info("[global66-ai] action escalate", {
            caseId,
            intent,
            reason: "whatsapp-send-failed",
          });
          await markHumanRequiredAndAssign({
            caseId,
            caseItem,
            body: settings.escalation_message,
            usedArticles,
          });

          return {
            status: "completed",
            caseId,
            aiResolution: "HUMAN_REQUIRED",
            response: settings.escalation_message,
            classification: {
              area,
              category,
              priority,
              aiSentiment,
              aiConfidence,
            },
          };
        }

        const messageId = await insertAiMessage({
          caseId,
          body: suggestedResponse,
          channel: "WHATSAPP",
          externalMessageId: whatsappResult.metaMessageId,
          deliveryStatus: "SENT",
        });

        logTriage("mensaje AI guardado", {
          caseId,
          messageId,
          aiResolution,
        });

        await saveMessageArticles({
          caseId,
          messageId,
          usedArticles,
        });

        logTriage("AUTO_RESOLVED WhatsApp sin cierre automático", {
          caseId,
          status: "AI_HANDLING",
          resolutionType: null,
        });

        const { error: keepOpenError } = await supabase
          .from("cases")
          .update({
            status: "AI_HANDLING",
            routing_status: "AI_HANDLING",
            resolution_type: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", caseId);

        if (keepOpenError) {
          throw keepOpenError;
        }
      } else {
        const messageId = await insertAiMessage({
          caseId,
          body: suggestedResponse,
        });

        logTriage("mensaje AI guardado", {
          caseId,
          messageId,
          aiResolution,
        });

        await saveMessageArticles({
          caseId,
          messageId,
          usedArticles,
        });

        logTriage("cierre automático", {
          caseId,
          resolutionType: "AI_RESOLVED",
        });

        const { error: closeError } = await supabase
          .from("cases")
          .update({
            status: "CLOSED",
            lifecycle_status: "CLOSED",
            closed_at: new Date().toISOString(),
            resolution_type: "AI_RESOLVED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", caseId);

        if (closeError) {
          throw closeError;
        }
      }
    } else {
      console.info("[global66-ai] action escalate", {
        caseId,
        intent,
        aiResolution,
      });
      await markHumanRequiredAndAssign({
        caseId,
        caseItem,
        body: suggestedResponse,
        usedArticles,
      });
    }

    return {
      status: "completed",
      caseId,
      aiResolution,
      response: suggestedResponse,
      classification: {
        area,
        category,
        priority,
        aiSentiment,
        aiConfidence,
      },
    };
  } catch (error) {
    console.error("[ai-triage] Error running triage", {
      message: getErrorMessage(error),
      error,
    });

    return {
      status: "error",
      reason: getErrorMessage(error),
      error,
    };
  }
}
