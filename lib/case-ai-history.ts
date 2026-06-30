import { GoogleGenAI } from "@google/genai";

import { supabase } from "@/lib/supabase";

export type CaseAiHistorySummaryRecord = {
  id: string;
  case_id: string;
  customer_id: string | null;
  summary: string | null;
  patterns: string[] | null;
  next_best_action: string | null;
  sentiment: string | null;
  metrics: CaseAiHistoryMetrics | null;
  source_case_ids: string[] | null;
  model: string | null;
  generated_by: string | null;
  generated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CaseAiHistoryMetrics = {
  total_cases: number;
  transfer_cases: number;
  repeated_cases: number;
  open_escalations: number;
  sentiment?: string;
};

export type CaseAiHistoryCaseRow = {
  id: string;
  case_number: string | null;
  date: string | null;
  priority: string | null;
  request: string;
  resolution: string;
  final_status: string;
  channel: string | null;
};

export type CaseAiHistoryData = {
  currentCase: AiHistoryCaseRecord;
  cachedSummary: CaseAiHistorySummaryRecord | null;
  historicalCases: CaseAiHistoryCaseRow[];
  metrics: CaseAiHistoryMetrics;
};

type AiHistoryCaseRecord = {
  id: string;
  case_number: string | null;
  customer_id: string | null;
  subject: string | null;
  channel: string | null;
  contact_type: string | null;
  status: string | null;
  lifecycle_status: string | null;
  routing_status: string | null;
  priority: string | null;
  area: string | null;
  category: string | null;
  resolution_type: string | null;
  ai_summary: string | null;
  ai_resolution: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type AiHistoryMessageRecord = {
  case_id: string | null;
  body: string | null;
  sender_type: string | null;
  direction: string | null;
  created_at: string | null;
};

type GeneratedAiHistorySummary = {
  summary: string;
  patterns: string[];
  next_best_action: string;
  sentiment: string;
  metrics: Partial<CaseAiHistoryMetrics>;
};

const fallbackGeminiModel = "gemini-2.5-flash-lite";
const maxHistoricalCases = 12;
const maxPromptCases = 8;

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || fallbackGeminiModel;
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function normalizePhone(value: string | null | undefined) {
  return value?.replace(/[^\d]/g, "") || "";
}

function normalizeName(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function getCaseEmail(caseItem: AiHistoryCaseRecord) {
  return caseItem.customer?.email ?? caseItem.contact_email ?? null;
}

function getCasePhone(caseItem: AiHistoryCaseRecord) {
  return caseItem.customer?.phone ?? caseItem.contact_phone ?? null;
}

function getCaseName(caseItem: AiHistoryCaseRecord) {
  return caseItem.customer?.name ?? caseItem.contact_name ?? null;
}

function getCaseIdentity(caseItem: AiHistoryCaseRecord) {
  return {
    customerId: caseItem.customer_id,
    email: normalizeEmail(getCaseEmail(caseItem)),
    phone: normalizePhone(getCasePhone(caseItem)),
    name: normalizeName(getCaseName(caseItem)),
  };
}

function isSameCustomer(
  candidate: AiHistoryCaseRecord,
  identity: ReturnType<typeof getCaseIdentity>,
) {
  if (identity.customerId && candidate.customer_id === identity.customerId) return true;

  const candidateEmail = normalizeEmail(getCaseEmail(candidate));
  if (identity.email && candidateEmail && identity.email === candidateEmail) return true;

  const candidatePhone = normalizePhone(getCasePhone(candidate));
  if (identity.phone && candidatePhone && identity.phone === candidatePhone) return true;

  const candidateName = normalizeName(getCaseName(candidate));
  return Boolean(identity.name && candidateName && identity.name === candidateName);
}

function getFirstCustomerMessage(messages: AiHistoryMessageRecord[]) {
  return messages.find(
    (message) =>
      message.sender_type?.toUpperCase() === "CUSTOMER" &&
      message.direction?.toUpperCase() === "INBOUND" &&
      message.body?.trim(),
  );
}

function getLastResolutionMessage(messages: AiHistoryMessageRecord[]) {
  return [...messages].reverse().find((message) => {
    const sender = message.sender_type?.toUpperCase();
    return (
      (sender === "AGENT" || sender === "AI") &&
      message.direction?.toUpperCase() === "OUTBOUND" &&
      message.body?.trim()
    );
  });
}

function truncateText(value: string | null | undefined, maxLength = 180) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function getCaseResolution(caseItem: AiHistoryCaseRecord, messages: AiHistoryMessageRecord[]) {
  const resolutionMessage = getLastResolutionMessage(messages);
  return (
    truncateText(resolutionMessage?.body, 220) ||
    caseItem.resolution_type ||
    caseItem.ai_resolution ||
    caseItem.ai_summary ||
    "Sin resolución registrada"
  );
}

function buildHistoryRows(
  cases: AiHistoryCaseRecord[],
  messagesByCase: Map<string, AiHistoryMessageRecord[]>,
) {
  return cases.map((caseItem) => {
    const caseMessages = messagesByCase.get(caseItem.id) ?? [];
    const request =
      truncateText(caseItem.subject, 180) ||
      truncateText(getFirstCustomerMessage(caseMessages)?.body, 180) ||
      "Sin detalle registrado";

    return {
      id: caseItem.id,
      case_number: caseItem.case_number,
      date: caseItem.closed_at ?? caseItem.updated_at ?? caseItem.created_at,
      priority: caseItem.priority,
      request,
      resolution: getCaseResolution(caseItem, caseMessages),
      final_status: caseItem.lifecycle_status || caseItem.status || "Sin estado",
      channel: caseItem.channel || caseItem.contact_type || null,
    };
  });
}

function isTransferCase(caseItem: CaseAiHistoryCaseRow | AiHistoryCaseRecord) {
  const text = [
    "request" in caseItem ? caseItem.request : caseItem.subject,
    "resolution" in caseItem ? caseItem.resolution : caseItem.ai_summary,
    "category" in caseItem ? caseItem.category : "",
    "area" in caseItem ? caseItem.area : "",
  ]
    .join(" ")
    .toLowerCase();

  return /transfer|transferencia|env[ií]o|abono|dinero/.test(text);
}

function computeMetrics(
  cases: AiHistoryCaseRecord[],
  rows: CaseAiHistoryCaseRow[],
): CaseAiHistoryMetrics {
  const transferCases = rows.filter(isTransferCase).length;
  const openEscalations = cases.filter((caseItem) => {
    const lifecycle = caseItem.lifecycle_status?.toUpperCase();
    const routing = caseItem.routing_status?.toUpperCase();
    return lifecycle !== "CLOSED" && (routing === "HUMAN_REQUIRED" || caseItem.priority === "HIGH");
  }).length;
  const categories = new Map<string, number>();

  cases.forEach((caseItem) => {
    const key = (caseItem.category || caseItem.area || caseItem.subject || "sin_categoria")
      .toLowerCase()
      .trim();
    categories.set(key, (categories.get(key) ?? 0) + 1);
  });

  const repeatedCases = [...categories.values()].filter((count) => count > 1).length;

  return {
    total_cases: rows.length,
    transfer_cases: transferCases,
    repeated_cases: repeatedCases,
    open_escalations: openEscalations,
  };
}

async function fetchMessagesByCase(caseIds: string[]) {
  const messagesByCase = new Map<string, AiHistoryMessageRecord[]>();
  if (caseIds.length === 0) return messagesByCase;

  const { data, error } = await supabase
    .from("messages")
    .select("case_id, body, sender_type, direction, created_at")
    .in("case_id", caseIds)
    .order("created_at", { ascending: true })
    .limit(160)
    .returns<AiHistoryMessageRecord[]>();

  if (error) {
    console.error("[case-ai-history] Error loading messages", {
      caseIds,
      message: error.message,
      error,
    });
    return messagesByCase;
  }

  (data ?? []).forEach((message) => {
    if (!message.case_id) return;
    const current = messagesByCase.get(message.case_id) ?? [];
    current.push(message);
    messagesByCase.set(message.case_id, current);
  });

  return messagesByCase;
}

function normalizeSummaryRecord(
  record: unknown,
): CaseAiHistorySummaryRecord | null {
  if (!record || typeof record !== "object") return null;

  const item = record as {
    id?: string;
    case_id?: string;
    customer_id?: string | null;
    summary?: string | null;
    patterns?: unknown;
    next_best_action?: string | null;
    sentiment?: string | null;
    metrics?: unknown;
    source_case_ids?: unknown;
    model?: string | null;
    generated_by?: string | null;
    generated_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };

  if (!item.id || !item.case_id) return null;

  return {
    id: item.id,
    case_id: item.case_id,
    customer_id: item.customer_id ?? null,
    summary: item.summary ?? null,
    patterns: Array.isArray(item.patterns)
      ? item.patterns.filter((pattern): pattern is string => typeof pattern === "string")
      : null,
    next_best_action: item.next_best_action ?? null,
    sentiment: item.sentiment ?? null,
    metrics:
      item.metrics && typeof item.metrics === "object"
        ? (item.metrics as CaseAiHistoryMetrics)
        : null,
    source_case_ids: Array.isArray(item.source_case_ids)
      ? item.source_case_ids.filter((id): id is string => typeof id === "string")
      : null,
    model: item.model ?? null,
    generated_by: item.generated_by ?? null,
    generated_at: item.generated_at ?? null,
    created_at: item.created_at ?? null,
    updated_at: item.updated_at ?? null,
  };
}

async function fetchCachedSummary(caseId: string) {
  const { data, error } = await supabase
    .from("case_ai_history_summaries")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();

  if (error) {
    console.error("[case-ai-history] Error loading cache", {
      caseId,
      message: error.message,
      error,
    });
    return null;
  }

  return normalizeSummaryRecord(data);
}

async function fetchCurrentCase(caseId: string) {
  const { data, error } = await supabase
    .from("cases")
    .select(
      "id, case_number, customer_id, subject, channel, contact_type, status, lifecycle_status, routing_status, priority, area, category, resolution_type, ai_summary, ai_resolution, contact_name, contact_email, contact_phone, created_at, updated_at, closed_at, customer:customers(name, email, phone)",
    )
    .eq("id", caseId)
    .single<AiHistoryCaseRecord>();

  if (error || !data) {
    throw new Error(error?.message || "Caso no encontrado.");
  }

  return data;
}

async function fetchRelatedCases(currentCase: AiHistoryCaseRecord) {
  const identity = getCaseIdentity(currentCase);

  const baseQuery = supabase
    .from("cases")
    .select(
      "id, case_number, customer_id, subject, channel, contact_type, status, lifecycle_status, routing_status, priority, area, category, resolution_type, ai_summary, ai_resolution, contact_name, contact_email, contact_phone, created_at, updated_at, closed_at, customer:customers(name, email, phone)",
    )
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(identity.customerId ? 60 : 220);

  const query = identity.customerId ? baseQuery.eq("customer_id", identity.customerId) : baseQuery;
  const { data, error } = await query.returns<AiHistoryCaseRecord[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((caseItem) => caseItem.id !== currentCase.id && isSameCustomer(caseItem, identity))
    .slice(0, maxHistoricalCases);
}

export async function loadCaseAiHistoryData(caseId: string): Promise<CaseAiHistoryData> {
  const currentCase = await fetchCurrentCase(caseId);
  const [cachedSummary, relatedCases] = await Promise.all([
    fetchCachedSummary(caseId),
    fetchRelatedCases(currentCase),
  ]);
  const messagesByCase = await fetchMessagesByCase(relatedCases.map((caseItem) => caseItem.id));
  const historicalCases = buildHistoryRows(relatedCases, messagesByCase);

  return {
    currentCase,
    cachedSummary,
    historicalCases,
    metrics: cachedSummary?.metrics ?? computeMetrics(relatedCases, historicalCases),
  };
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] ?? trimmed;
}

function parseGeneratedSummary(text: string): GeneratedAiHistorySummary {
  const parsed = JSON.parse(extractJson(text)) as Partial<GeneratedAiHistorySummary>;

  return {
    summary: String(parsed.summary ?? "").trim(),
    patterns: Array.isArray(parsed.patterns)
      ? parsed.patterns.map(String).filter(Boolean)
      : [],
    next_best_action: String(parsed.next_best_action ?? "").trim(),
    sentiment: String(parsed.sentiment ?? "").trim() || "NEUTRAL",
    metrics:
      parsed.metrics && typeof parsed.metrics === "object"
        ? parsed.metrics
        : {},
  };
}

function buildPrompt(data: CaseAiHistoryData) {
  const current = data.currentCase;
  const promptCases = data.historicalCases.slice(0, maxPromptCases);

  return `Eres un analista de soporte de Global66. Resume patrones del historial del cliente para ayudar a un ejecutivo dentro de un CRM.

Responde SOLO JSON válido con esta forma:
{
  "summary": "",
  "patterns": ["", ""],
  "next_best_action": "",
  "sentiment": "POSITIVO|NEUTRAL|NEGATIVO|RIESGO",
  "metrics": {
    "total_cases": 0,
    "transfer_cases": 0,
    "repeated_cases": 0,
    "open_escalations": 0
  }
}

No inventes datos. Si hay poco historial, dilo brevemente. Mantén español latino, tono operativo y concreto.

Caso actual:
- Caso: ${current.case_number || current.id}
- Cliente: ${getCaseName(current) || "Sin nombre"}
- Email: ${getCaseEmail(current) || "Sin email"}
- Teléfono: ${getCasePhone(current) || "Sin teléfono"}
- Asunto: ${current.subject || "Sin asunto"}
- Canal: ${current.channel || current.contact_type || "Sin canal"}
- Estado: ${current.lifecycle_status || current.status || "Sin estado"}
- Routing: ${current.routing_status || "Sin routing"}
- Prioridad: ${current.priority || "Sin prioridad"}

Métricas calculadas:
${JSON.stringify(data.metrics)}

Casos históricos recientes:
${JSON.stringify(promptCases, null, 2)}
`;
}

export async function generateCaseAiHistorySummary({
  caseId,
  actorUserId,
}: {
  caseId: string;
  actorUserId: string | null;
}) {
  const data = await loadCaseAiHistoryData(caseId);

  if (!process.env.GEMINI_API_KEY) {
    return {
      ok: false,
      reason: "IA no configurada.",
      aiConfigured: false,
      ...data,
    };
  }

  const model = getGeminiModel();
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const response = await ai.models.generateContent({
    model,
    contents: buildPrompt(data),
  });
  const generated = parseGeneratedSummary(response.text ?? "");
  const metrics: CaseAiHistoryMetrics = {
    ...data.metrics,
    ...generated.metrics,
    sentiment: generated.sentiment,
  };
  const now = new Date().toISOString();
  const { data: savedSummary, error } = await supabase
    .from("case_ai_history_summaries")
    .upsert(
      {
        case_id: caseId,
        customer_id: data.currentCase.customer_id,
        summary: generated.summary,
        patterns: generated.patterns,
        next_best_action: generated.next_best_action,
        sentiment: generated.sentiment,
        metrics,
        source_case_ids: data.historicalCases.map((caseItem) => caseItem.id),
        model,
        generated_by: actorUserId,
        generated_at: now,
        updated_at: now,
      },
      { onConflict: "case_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    ok: true,
    aiConfigured: true,
    ...data,
    cachedSummary: normalizeSummaryRecord(savedSummary),
  };
}
