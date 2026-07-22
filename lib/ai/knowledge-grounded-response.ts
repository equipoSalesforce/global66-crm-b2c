import "server-only";

import { GoogleGenAI } from "@google/genai";
import type {
  KnowledgeSearchResult,
  KnowledgeSuggestionPayload,
} from "@/lib/ai-knowledge-types";

export const GLOBAL66_KNOWLEDGE_RESPONSE_PROMPT = `Eres un asistente de soporte de Global66.
Usa únicamente el conocimiento entregado. No inventes beneficios, montos, plazos, coberturas, países ni restricciones.
No mezcles países, planes ni productos. Si falta país, plan u otro dato clave, solicítalo antes de responder algo específico.
CUSTOMER_ALLOWED puede usarse en customerReply. AGENT_GUIDANCE se usa sólo como guía interna. INTERNAL_ONLY nunca puede aparecer en customerReply.
Mantén un tono claro, empático y profesional. No uses emojis ni signos de exclamación. No digas que Global66 es un banco.
Si las fuentes no son suficientes, indica que falta información y recomienda revisión manual.
No expongas razonamiento interno. Devuelve sólo un resumen operativo y el JSON solicitado.`;

function parseJsonResponse(value: string) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as Partial<KnowledgeSuggestionPayload>;
}

function fallbackPayload(results: KnowledgeSearchResult[]): KnowledgeSuggestionPayload {
  const customer = results.filter((result) => result.visibility === "CUSTOMER_ALLOWED");
  const guidance = results.filter((result) => result.visibility !== "CUSTOMER_ALLOWED");
  return {
    customerReply: customer.length
      ? "Encontré información relacionada, pero la sugerencia automática no está disponible. Revisa las fuentes antes de responder al cliente."
      : "No encuentro información publicada suficiente para responder con precisión. ¿Podrías compartir el país, producto o plan asociado a tu consulta?",
    agentSummary: customer.length ? "Hay conocimiento publicado relacionado que requiere revisión del ejecutivo." : "No hay conocimiento publicado suficiente.",
    nextActions: ["Revisar las fuentes asociadas antes de enviar una respuesta."],
    sources: results.map((result) => ({
      title: result.title,
      source: result.source,
      version: result.version,
      metadata: { product: result.product, country: result.country, plan: result.plan, category: result.category },
    })),
    confidence: customer.length ? "LOW" : "LOW",
    missingInfo: customer.length ? [] : ["País, producto o plan según corresponda"],
    warnings: guidance.map((result) => result.snippet),
  };
}

export async function generateKnowledgeGroundedResponse({
  query,
  conversation,
  caseMetadata,
  results,
}: {
  query: string;
  conversation: string;
  caseMetadata: Record<string, string | null | undefined>;
  results: KnowledgeSearchResult[];
}): Promise<KnowledgeSuggestionPayload> {
  if (!results.length || !process.env.GEMINI_API_KEY) return fallbackPayload(results);
  const customerKnowledge = results.filter((result) => result.visibility === "CUSTOMER_ALLOWED");
  const internalGuidance = results.filter((result) => result.visibility !== "CUSTOMER_ALLOWED");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite",
      contents: `${GLOBAL66_KNOWLEDGE_RESPONSE_PROMPT}

Consulta actual:
${query}

Metadata del caso:
${JSON.stringify(caseMetadata)}

Conversación reciente:
${conversation}

Conocimiento CUSTOMER_ALLOWED:
${JSON.stringify(customerKnowledge)}

Guía interna AGENT_GUIDANCE/INTERNAL_ONLY (nunca copiar en customerReply):
${JSON.stringify(internalGuidance)}

Devuelve SOLO JSON válido con esta forma:
{"customerReply":"","agentSummary":"","nextActions":[],"sources":[],"confidence":"HIGH|MEDIUM|LOW","missingInfo":[],"warnings":[]}`,
      config: { systemInstruction: GLOBAL66_KNOWLEDGE_RESPONSE_PROMPT },
    });
    const parsed = parseJsonResponse(response.text ?? "");
    return {
      customerReply: String(parsed.customerReply ?? "").trim() || fallbackPayload(results).customerReply,
      agentSummary: String(parsed.agentSummary ?? "").trim(),
      nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions.map(String).slice(0, 6) : [],
      sources: results.map((result) => ({
        title: result.title,
        source: result.source,
        version: result.version,
        metadata: { product: result.product, country: result.country, plan: result.plan, category: result.category },
      })),
      confidence: ["HIGH", "MEDIUM", "LOW"].includes(String(parsed.confidence)) ? parsed.confidence as "HIGH" | "MEDIUM" | "LOW" : "LOW",
      missingInfo: Array.isArray(parsed.missingInfo) ? parsed.missingInfo.map(String).slice(0, 8) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String).slice(0, 8) : [],
    };
  } catch (error) {
    console.error("[knowledge-grounded-response] Falling back to safe response", {
      message: error instanceof Error ? error.message : String(error),
    });
    return fallbackPayload(results);
  }
}
