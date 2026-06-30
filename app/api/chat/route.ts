import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const fallbackGeminiModel = "gemini-2.5-flash-lite";

type ChatRequest = {
  caseId?: unknown;
  message?: unknown;
};

type KnowledgeArticle = {
  title?: string | null;
  content?: string | null;
  category?: string | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || fallbackGeminiModel;
}

function logSupabaseError(scope: string, error: unknown) {
  console.error(`[api/chat] ${scope}`, {
    message: getErrorMessage(error),
    supabaseError: error,
  });
}

function logGeminiError(scope: string, error: unknown) {
  console.error(`[api/chat] ${scope}`, {
    message: getErrorMessage(error),
    geminiError: error,
  });
}

function isChatRequest(payload: ChatRequest): payload is {
  caseId: string;
  message: string;
} {
  return (
    typeof payload.caseId === "string" &&
    payload.caseId.trim().length > 0 &&
    typeof payload.message === "string" &&
    payload.message.trim().length > 0
  );
}

function getArticleTitle(article: KnowledgeArticle, index: number) {
  return article.title ?? `Artículo ${index + 1}`;
}

function getArticleBody(article: KnowledgeArticle) {
  return article.content ?? "Sin contenido disponible.";
}

function buildKnowledgeContext(articles: KnowledgeArticle[]) {
  if (articles.length === 0) {
    return "No hay artículos disponibles en la base de conocimiento.";
  }

  return articles
    .map((article, index) => {
      const title = getArticleTitle(article, index);
      const body = getArticleBody(article);
      const category = article.category ?? "Sin categoría";

      return `Artículo ${index + 1}: ${title}\nCategoría: ${category}\nContenido: ${body}`;
    })
    .join("\n\n---\n\n");
}

export async function POST(request: Request) {
  let payload: ChatRequest;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("[api/chat] Error parsing request JSON", {
      message: getErrorMessage(error),
      error,
    });

    return Response.json(
      { error: getErrorMessage(error) || "JSON inválido." },
      { status: 400 },
    );
  }

  if (!isChatRequest(payload)) {
    return Response.json(
      { error: "caseId y message son requeridos." },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "GEMINI_API_KEY no está configurada." },
      { status: 500 },
    );
  }

  const { data: articles, error: articlesError } = await supabase
    .from("knowledge_articles")
    .select("title, content, category")
    .eq("is_active", true)
    .returns<KnowledgeArticle[]>();

  if (articlesError) {
    logSupabaseError("Error loading knowledge_articles", articlesError);

    return Response.json(
      { error: articlesError.message },
      { status: 500 },
    );
  }

  const context = buildKnowledgeContext(articles ?? []);
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const model = getGeminiModel();

  console.info("[api/chat] Gemini model", {
    model,
  });

  let response;

  try {
    response = await ai.models.generateContent({
      model,
      contents: `Contexto de base de conocimiento:\n${context}\n\nMensaje del caso:\n${payload.message.trim()}`,
      config: {
        systemInstruction:
          "Eres Global66 CRM, un asistente de soporte omnicanal. Responde en español, de forma clara y útil. Usa el contexto de la base de conocimiento cuando sea relevante. Si no hay información suficiente, dilo y sugiere el siguiente paso.",
      },
    });
  } catch (error) {
    logGeminiError("Error creating Gemini response", error);

    return Response.json({ error: getErrorMessage(error) }, { status: 500 });
  }

  const responseText = response.text?.trim() ?? "";

  if (!responseText) {
    return Response.json(
      { error: "Gemini no devolvió una respuesta." },
      { status: 502 },
    );
  }

  const { error: insertError } = await supabase.from("messages").insert({
    case_id: payload.caseId,
    direction: "OUTBOUND",
    sender_type: "AI",
    body: responseText,
  });

  if (insertError) {
    logSupabaseError("Error inserting AI message", insertError);

    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ response: responseText });
}
