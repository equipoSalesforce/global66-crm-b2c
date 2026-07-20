import "server-only";

import { GoogleGenAI } from "@google/genai";
import {
  allowedDimensionKeys,
  allowedFilterTypes,
  allowedMetricKeys,
  allowedWidgetTypes,
  validateDashboardDefinition,
  type AnalyticsDimensionKey,
  type AnalyticsMetricKey,
  type DashboardFilters,
  type DashboardWidgetType,
  type SafeDashboardDefinition,
  type SafeDashboardWidget,
} from "@/lib/analytics/semantic-layer";

type PromptContext = {
  metric: AnalyticsMetricKey;
  filters: DashboardFilters;
  label: string;
};

type DimensionRequest = {
  dimension: AnalyticsDimensionKey;
  label: string;
  type: Exclude<DashboardWidgetType, "kpi">;
  index: number;
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function periodFilters(text: string, dateField: DashboardFilters["dateField"]) {
  return /este mes|mes actual/.test(text) ? { period: "THIS_MONTH" as const, dateField } : {};
}

export function detectGlobalPromptContext(prompt: string): PromptContext | null {
  const text = normalize(prompt);
  if (/casos? cerrad/.test(text)) {
    const month = /este mes|mes actual/.test(text);
    return {
      metric: "closed_cases",
      filters: { lifecycle_status: "CLOSED", ...periodFilters(text, "closed_at") },
      label: month ? "Casos cerrados este mes" : "Casos cerrados",
    };
  }
  if (/casos? resuelt/.test(text)) {
    const month = /este mes|mes actual/.test(text);
    return {
      metric: "resolved_cases",
      filters: { lifecycle_status: "RESOLVED", ...periodFilters(text, "closed_at") },
      label: month ? "Casos resueltos este mes" : "Casos resueltos",
    };
  }
  if (/casos? (?:que )?esperando respuesta|casos? en espera de respuesta/.test(text)) {
    return {
      metric: "waiting_agent_response",
      filters: { response_status: "WAITING_AGENT_RESPONSE", ...periodFilters(text, "created_at") },
      label: /este mes|mes actual/.test(text) ? "Casos esperando respuesta este mes" : "Casos esperando respuesta",
    };
  }
  if (/casos? en riesgo/.test(text)) {
    return {
      metric: "cases_in_risk",
      filters: periodFilters(text, "created_at"),
      label: /este mes|mes actual/.test(text) ? "Casos en riesgo este mes" : "Casos en riesgo",
    };
  }
  if (/casos? (?:en )?stand.?by/.test(text)) {
    return {
      metric: "stand_by_cases",
      filters: { lifecycle_status: "STAND_BY", ...periodFilters(text, "created_at") },
      label: /este mes|mes actual/.test(text) ? "Casos en stand by este mes" : "Casos en stand by",
    };
  }
  if (/casos? (?:de|por canal) whatsapp/.test(text)) {
    return {
      metric: "total_cases",
      filters: { channel: "WHATSAPP", ...periodFilters(text, "created_at") },
      label: /este mes|mes actual/.test(text) ? "Casos de WhatsApp este mes" : "Casos de WhatsApp",
    };
  }
  const areaMatch = text.match(/casos? (?:del|de la) area ([a-z0-9 _-]+?)(?=,| por | y casos|$)/);
  const area = areaMatch?.[1]?.trim();
  if (area && !/especifica|determinada/.test(area)) {
    return {
      metric: "total_cases",
      filters: { area, ...periodFilters(text, "created_at") },
      label: /este mes|mes actual/.test(text) ? `Casos de ${area} este mes` : `Casos de ${area}`,
    };
  }
  return null;
}

function findDimensionRequests(prompt: string) {
  const text = normalize(prompt);
  const definitions: Array<Omit<DimensionRequest, "index"> & { pattern: RegExp }> = [
    { dimension: "customer", label: "cliente", type: "table", pattern: /por cliente(?:s)?/ },
    { dimension: "owner", label: "ejecutivo", type: "bar", pattern: /por ejecutivo|por agente|por owner|por asignado/ },
    { dimension: "area", label: "área", type: "bar", pattern: /por area/ },
    { dimension: "channel", label: "canal", type: "donut", pattern: /por canal/ },
    { dimension: "priority", label: "prioridad", type: "bar", pattern: /por prioridad/ },
    { dimension: "created_day", label: "fecha de creación", type: "line", pattern: /por fecha(?: de creacion)?|por dia(?: de creacion)?/ },
  ];
  return definitions.flatMap((definition) => {
    const match = definition.pattern.exec(text);
    return match ? [{ ...definition, index: match.index }] : [];
  }).sort((left, right) => left.index - right.index);
}

function buildRequestedWidgets(prompt: string, context: PromptContext | null) {
  const text = normalize(prompt);
  const dimensions = findDimensionRequests(prompt);
  const metric = context?.metric ?? "total_cases";
  const filters = context?.filters ?? {};
  const baseLabel = context?.label ?? "Casos";
  const dividedIntoCharts = /dividid[oa] en \d+ grafic/.test(text);
  const explicitlyRequestsSummary = /(?:muestre|mostrar|incluya|incluir).*casos? (?:cerrad|resuelt|en riesgo|esperando|stand)/.test(text);
  const includeKpi = Boolean(context && (!dimensions.length || (explicitlyRequestsSummary && !dividedIntoCharts)));
  const widgets: SafeDashboardWidget[] = includeKpi ? [{
    id: `${metric}_summary`,
    type: "kpi",
    title: baseLabel,
    metric,
    filters,
  }] : [];
  dimensions.forEach((request) => {
    widgets.push({
      id: `${metric}_by_${request.dimension}`,
      type: request.type,
      title: `${baseLabel} por ${request.label}`,
      metric,
      dimension: request.dimension,
      filters,
    });
  });
  return widgets;
}

function enforcePromptSemantics(prompt: string, input: SafeDashboardDefinition) {
  const context = detectGlobalPromptContext(prompt);
  const required = buildRequestedWidgets(prompt, context);
  const widgets = required.length ? required.map((requiredWidget) => {
    const generated = input.widgets.find((widget) => widget.id === requiredWidget.id
      || (requiredWidget.dimension ? widget.dimension === requiredWidget.dimension : widget.type === "kpi"));
    const generatedType = generated?.type === "kpi" && requiredWidget.dimension ? requiredWidget.type : generated?.type;
    return {
      ...requiredWidget,
      type: requiredWidget.type === "kpi" ? "kpi" : generatedType ?? requiredWidget.type,
      ...(requiredWidget.type === "kpi" ? { dimension: undefined } : {}),
    };
  }) : input.widgets.map((widget) => widget.type === "kpi" ? { ...widget, dimension: undefined } : widget);
  return validateDashboardDefinition({
    ...input,
    title: context ? `Dashboard de ${context.label.toLowerCase()}` : input.title,
    filters: context?.filters ?? input.filters,
    widgets: widgets.slice(0, 8),
  });
}

export function buildRuleBasedDashboard(prompt: string): SafeDashboardDefinition {
  const context = detectGlobalPromptContext(prompt);
  const widgets = buildRequestedWidgets(prompt, context);
  if (!widgets.length) {
    widgets.push(
      { id: "total_cases", type: "kpi", title: "Total de casos", metric: "total_cases", filters: {} },
      { id: "cases_by_channel", type: "donut", title: "Casos por canal", metric: "total_cases", dimension: "channel", filters: {} },
      { id: "monthly_trend", type: "line", title: "Evolución mensual", metric: "total_cases", dimension: "created_month", filters: {} },
    );
  }
  return validateDashboardDefinition({
    title: context ? `Dashboard de ${context.label.toLowerCase()}` : "Dashboard operativo de casos",
    description: "Panel operativo generado sobre métricas y dimensiones autorizadas del CRM.",
    filters: context?.filters ?? { period: "ALL_TIME", dateField: "created_at" },
    widgets: widgets.slice(0, 8),
  });
}

function parseJson(text: string) {
  const normalized = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(normalized) as unknown;
}

export async function generateDashboardProposal(prompt: string) {
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
  if (!process.env.GEMINI_API_KEY) {
    return { definition: buildRuleBasedDashboard(prompt), mode: "SEMANTIC_FALLBACK" as const, model: null };
  }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model,
      contents: `Convierte la solicitud en una definición JSON de dashboard. No generes SQL, nombres de tablas ni columnas.

Primero identifica la intención global de la solicitud. Si el usuario pide casos cerrados, resueltos, esperando respuesta, en riesgo, stand by, de WhatsApp o de un área, propaga esa métrica y sus filtros a todos los desgloses posteriores. Un widget KPI nunca debe incluir dimensión.

Métricas permitidas: ${allowedMetricKeys.join(", ")}
Dimensiones permitidas: ${allowedDimensionKeys.join(", ")}
Widgets permitidos: ${allowedWidgetTypes.join(", ")}
Filtros semánticos permitidos: ${allowedFilterTypes.join(", ")}
Claves JSON permitidas dentro de filters: period, dateField, lifecycle_status, response_status, owner, customer, channel, priority, area y product. Usa period para rangos relativos; no uses date_range como clave JSON.
Períodos permitidos: ALL_TIME, THIS_MONTH, LAST_7_DAYS, LAST_30_DAYS.
Máximo 8 widgets. Usa sólo las claves title, description, filters y widgets. Cada widget sólo puede incluir id, type, title, metric, dimension y filters.

Solicitud: ${prompt}

Devuelve exclusivamente JSON válido.`,
    });
    const definition = enforcePromptSemantics(prompt, validateDashboardDefinition(parseJson(response.text ?? "")));
    return { definition, mode: "GEMINI" as const, model };
  } catch (error) {
    return {
      definition: buildRuleBasedDashboard(prompt),
      mode: "SEMANTIC_FALLBACK" as const,
      model: null,
      fallbackReason: error instanceof Error ? error.message : "Respuesta IA inválida.",
    };
  }
}
