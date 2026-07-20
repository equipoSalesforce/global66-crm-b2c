"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";
import {
  allowedDimensionKeys,
  allowedMetricKeys,
  allowedWidgetTypes,
  metricDefinitions,
  type AnalyticsDimensionKey,
  type AnalyticsMetricKey,
  type DashboardWidgetType,
  type SafeDashboardDefinition,
  type WidgetData,
} from "@/lib/analytics/semantic-layer";
import { AiDashboardRenderer } from "@/components/ai-dashboards/ai-dashboard-renderer";

const examples = [
  "Casos cerrados este mes por ejecutivo y cliente",
  "Casos en riesgo por prioridad y canal",
  "Casos esperando respuesta por ejecutivo",
  "Resumen mensual de operación",
];

type GenerateResponse = {
  ok?: boolean;
  error?: string;
  definition?: SafeDashboardDefinition;
  data?: WidgetData[];
  mode?: "GEMINI" | "SEMANTIC_FALLBACK";
  fallbackReason?: string;
};

export function AiDashboardBuilder() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [definition, setDefinition] = useState<SafeDashboardDefinition | null>(null);
  const [data, setData] = useState<WidgetData[]>([]);
  const [mode, setMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!definition) return;
    const timeoutId = window.setTimeout(async () => {
      setIsResolving(true);
      try {
        const response = await fetch("/api/analytics/widgets/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ definition }),
        });
        const payload = (await response.json()) as { ok?: boolean; widgets?: WidgetData[] };
        if (response.ok && payload.ok) setData(payload.widgets ?? []);
      } finally {
        setIsResolving(false);
      }
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [definition]);

  async function generate() {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboards/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const payload = (await response.json()) as GenerateResponse;
      if (!response.ok || !payload.ok || !payload.definition) {
        throw new Error(payload.error || "No se pudo generar el dashboard.");
      }
      setDefinition(payload.definition);
      setData(payload.data ?? []);
      setMode(payload.mode ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo generar el dashboard.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function save() {
    if (!definition) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition, prompt, visibility: "PRIVATE" }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; dashboard?: { id: string } };
      if (!response.ok || !payload.ok || !payload.dashboard) throw new Error(payload.error || "No se pudo guardar el dashboard.");
      router.push(`/dashboards/${payload.dashboard.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el dashboard.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateWidget(index: number, patch: Partial<SafeDashboardDefinition["widgets"][number]>) {
    setDefinition((current) => current ? {
      ...current,
      widgets: current.widgets.map((widget, widgetIndex) => widgetIndex === index ? { ...widget, ...patch } : widget),
    } : current);
  }

  function cancel() {
    setDefinition(null);
    setData([]);
    setMode(null);
    setError(null);
  }

  return (
    <div className="space-y-4 pb-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-600"><Bot className="h-5 w-5" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">Analytics Studio</p><h1 className="text-2xl font-black text-slate-950">AI Dashboard Builder</h1><p className="mt-1 text-sm text-slate-500">Describe el panel que necesitas y la IA generará una propuesta editable.</p></div></div>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ej: Necesito un dashboard con casos cerrados este mes, casos por ejecutivo, casos por cliente y casos en riesgo." className="mt-5 min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
        <div className="mt-3 flex flex-wrap gap-2">{examples.map((example) => <button key={example} type="button" onClick={() => setPrompt(example)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:border-blue-300 hover:text-blue-600">{example}</button>)}</div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={isGenerating || prompt.trim().length < 10} onClick={() => void generate()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"><Sparkles className="h-4 w-4" />{isGenerating ? "Generando propuesta..." : "Generar dashboard"}</button><p className="text-[11px] text-slate-400">La IA sólo puede elegir métricas, dimensiones y widgets aprobados. Nunca ejecuta SQL.</p></div>
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

      {definition ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-wide text-blue-600">Preview editable</p><h2 className="text-lg font-black text-slate-950">Configura la propuesta antes de guardarla</h2>{mode ? <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[9px] font-black ${mode === "GEMINI" ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700"}`}>{mode === "GEMINI" ? "Propuesta generada con IA" : "Propuesta semántica segura"}</span> : null}</div><div className="flex gap-2"><button onClick={cancel} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold text-slate-600"><X className="h-3.5 w-3.5" />Cancelar</button><button disabled={isGenerating} onClick={() => void generate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-600"><RotateCcw className="h-3.5 w-3.5" />Regenerar</button><button disabled={isSaving} onClick={() => void save()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-black text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{isSaving ? "Guardando..." : "Guardar dashboard"}</button></div></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-[10px] font-black uppercase text-slate-500">Nombre<input value={definition.title} onChange={(event) => setDefinition({ ...definition, title: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold normal-case text-slate-900" /></label><label className="text-[10px] font-black uppercase text-slate-500">Descripción<input value={definition.description} onChange={(event) => setDefinition({ ...definition, description: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-semibold normal-case text-slate-900" /></label></div>
            <div className="mt-4 space-y-2">{definition.widgets.map((widget, index) => <article key={widget.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(180px,1.5fr)_130px_190px_170px_auto]"><input aria-label="Título del widget" value={widget.title} onChange={(event) => updateWidget(index, { title: event.target.value })} className="h-9 rounded-lg border bg-white px-3 font-bold" /><select aria-label="Tipo de widget" value={widget.type} onChange={(event) => { const type = event.target.value as DashboardWidgetType; updateWidget(index, { type, ...(type === "kpi" ? { dimension: undefined } : {}) }); }} className="h-9 rounded-lg border bg-white px-2">{allowedWidgetTypes.map((type) => <option key={type}>{type}</option>)}</select><select aria-label="Métrica" value={widget.metric} onChange={(event) => updateWidget(index, { metric: event.target.value as AnalyticsMetricKey })} className="h-9 rounded-lg border bg-white px-2">{allowedMetricKeys.map((metric) => <option key={metric} value={metric}>{metricDefinitions[metric].label}</option>)}</select><select aria-label="Dimensión" disabled={widget.type === "kpi"} value={widget.dimension ?? ""} onChange={(event) => updateWidget(index, { dimension: event.target.value ? event.target.value as AnalyticsDimensionKey : undefined })} className="h-9 rounded-lg border bg-white px-2 disabled:bg-slate-100 disabled:text-slate-400"><option value="">Sin dimensión</option>{allowedDimensionKeys.map((dimension) => <option key={dimension}>{dimension}</option>)}</select><button type="button" disabled={definition.widgets.length === 1} onClick={() => setDefinition({ ...definition, widgets: definition.widgets.filter((_, widgetIndex) => widgetIndex !== index) })} className="flex h-9 items-center justify-center rounded-lg border border-red-200 px-3 text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></article>)}</div>
          </section>
          <AiDashboardRenderer definition={definition} data={data} loading={isResolving} />
        </>
      ) : null}
    </div>
  );
}
