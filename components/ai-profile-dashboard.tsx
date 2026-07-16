"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CalendarDays, CheckCircle2, Clock3, Search, Sparkles, TrendingUp, Zap } from "lucide-react";
import type { AiFeature, AiInteraction, AiUserLimit } from "@/lib/ai-governance-types";

type FeatureUsage = {
  feature: AiFeature;
  limit: AiUserLimit | null;
  effectiveDailyLimit: number;
  usedToday: number;
  usedMonth: number;
  remainingToday: number;
  temporaryActive: boolean;
};

type ProfilePayload = {
  ok: boolean;
  error?: string;
  user: { name: string };
  metrics: { usedToday: number; usedMonth: number; totalDailyLimit: number; totalMonthlyLimit: number; remainingToday: number; mostUsed: FeatureUsage | null };
  featureUsage: FeatureUsage[];
  topics: Array<{ topic: string; uses: number }>;
  interactions: AiInteraction[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const statusLabels: Record<string, string> = { SUCCESS: "Éxito", BLOCKED_LIMIT: "Bloqueado por límite", ERROR: "Error" };

function percent(value: number, total: number) {
  return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function AiProfileDashboard() {
  const [payload, setPayload] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ featureKey: "", status: "", topic: "", dateFrom: "", dateTo: "", search: "", page: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(filters.page), pageSize: "8" });
    Object.entries(filters).forEach(([key, value]) => {
      if (key !== "page" && value) {
        params.set(key, key === "dateTo" ? `${value}T23:59:59.999Z` : String(value));
      }
    });
    try {
      const response = await fetch(`/api/ai/usage/me?${params}`, { cache: "no-store" });
      const next = (await response.json()) as ProfilePayload;
      if (!response.ok || !next.ok) throw new Error(next.error || "No se pudo cargar tu perfil IA.");
      setPayload(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar tu perfil IA.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const feedback = useMemo(() => {
    if (!payload) return [];
    const exhausted = payload.featureUsage.find((item) => item.remainingToday === 0 && item.effectiveDailyLimit > 0);
    const topTopic = payload.topics[0];
    const items = [];
    if (payload.metrics.usedToday > 0) items.push({ tone: "blue", title: "Tu uso de IA está activo", text: `Hoy completaste ${payload.metrics.usedToday} interacciones exitosas.` });
    if (exhausted) items.push({ tone: "orange", title: `Límite alcanzado: ${exhausted.feature.name}`, text: "Planifica los usos restantes o solicita una excepción temporal a un administrador." });
    if (topTopic) items.push({ tone: "green", title: "Tema frecuente observado", text: `${topTopic.topic} concentra la mayor cantidad de interacciones del período.` });
    if (!items.length) items.push({ tone: "blue", title: "Empieza a usar tus herramientas IA", text: "Aquí aparecerán recomendaciones basadas en tus interacciones reales." });
    return items;
  }, [payload]);

  if (loading && !payload) return <div className="rounded-xl border bg-white p-8 text-sm font-semibold text-slate-500">Cargando perfil IA...</div>;
  if (error && !payload) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">{error}</div>;
  if (!payload) return null;

  const maxTopic = Math.max(1, ...payload.topics.map((item) => item.uses));
  return (
    <div className="space-y-4 text-[13px]">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">Mi perfil IA</h1>
        <p className="mt-1 text-sm text-slate-600">Revisa cómo estás usando la IA, tus cupos disponibles y recomendaciones para mejorar tu gestión.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Usos de IA hoy", value: payload.metrics.usedToday, detail: `de ${payload.metrics.totalDailyLimit} cupos`, icon: CalendarDays, color: "bg-blue-600" },
          { label: "Usos este mes", value: payload.metrics.usedMonth, detail: `de ${payload.metrics.totalMonthlyLimit} cupos`, icon: Clock3, color: "bg-blue-600" },
          { label: "Funcionalidad más usada", value: payload.metrics.mostUsed?.feature.name ?? "Sin uso", detail: `${payload.metrics.mostUsed?.usedMonth ?? 0} usos este mes`, icon: Sparkles, color: "bg-violet-500" },
          { label: "Cupos restantes hoy", value: payload.metrics.remainingToday, detail: `de ${payload.metrics.totalDailyLimit} cupos`, icon: CheckCircle2, color: "bg-emerald-500" },
        ].map((card) => (
          <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{card.label}</p><p className="mt-2 text-xl font-black text-slate-950">{card.value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{card.detail}</p></div><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><card.icon className="h-4 w-4" /></span></div>
            {typeof card.value === "number" ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${card.color}`} style={{ width: `${percent(card.value, card.label.includes("mes") ? payload.metrics.totalMonthlyLimit : payload.metrics.totalDailyLimit)}%` }} /></div> : null}
          </article>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(290px,1fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="px-1 pb-2 text-base font-black text-slate-950">Uso por funcionalidad</h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {payload.featureUsage.map((item) => {
              const usagePercent = percent(item.usedToday, item.effectiveDailyLimit);
              return <article key={item.feature.feature_key} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center gap-3"><span className="rounded-full bg-blue-50 p-2 text-blue-600"><Bot className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-extrabold text-slate-900">{item.feature.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${item.remainingToday ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{item.remainingToday ? `${item.remainingToday} restantes` : "Límite alcanzado"}</span></div><div className="mt-1 flex items-center gap-3 text-[11px] font-semibold text-slate-500"><span>Usado hoy: {item.usedToday} / {item.effectiveDailyLimit}</span>{item.temporaryActive ? <span className="text-amber-600">Excepción activa</span> : null}</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={usagePercent >= 100 ? "h-full bg-red-500" : usagePercent > 75 ? "h-full bg-amber-500" : "h-full bg-blue-600"} style={{ width: `${usagePercent}%` }} /></div></div></div></article>;
            })}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-base font-black text-slate-950">Temas más frecuentes</h2><div className="mt-4 space-y-3">{payload.topics.length ? payload.topics.map((item) => <div key={item.topic} className="grid grid-cols-[1fr_100px_auto] items-center gap-2"><span className="truncate font-semibold text-slate-700">{item.topic}</span><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600" style={{ width: `${percent(item.uses, maxTopic)}%` }} /></div><span className="text-xs font-bold text-slate-500">{item.uses}</span></div>) : <p className="text-slate-500">Aún no hay temas registrados.</p>}</div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-base font-black text-slate-950">Feedback para ti</h2><div className="mt-3 space-y-2">{feedback.map((item) => <article key={item.title} className={`rounded-lg p-3 ${item.tone === "orange" ? "bg-amber-50" : item.tone === "green" ? "bg-emerald-50" : "bg-blue-50"}`}><div className="flex gap-2"><TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><div><p className="font-extrabold text-slate-900">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{item.text}</p></div></div></article>)}</div></section>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-3"><h2 className="text-base font-black text-slate-950">Todas las interacciones</h2><div className="mt-3 grid gap-2 md:grid-cols-4 xl:grid-cols-[1fr_1fr_1fr_1.4fr]">
          <select value={filters.featureKey} onChange={(event) => setFilters((current) => ({ ...current, featureKey: event.target.value, page: 1 }))} className="h-9 rounded-lg border border-slate-200 px-3"><option value="">Todas las funcionalidades</option>{payload.featureUsage.map((item) => <option key={item.feature.feature_key} value={item.feature.feature_key}>{item.feature.name}</option>)}</select>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} className="h-9 rounded-lg border border-slate-200 px-3"><option value="">Todos los estados</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select value={filters.topic} onChange={(event) => setFilters((current) => ({ ...current, topic: event.target.value, page: 1 }))} className="h-9 rounded-lg border border-slate-200 px-3"><option value="">Todos los temas</option>{payload.topics.map((item) => <option key={item.topic} value={item.topic}>{item.topic}</option>)}</select>
          <input type="date" aria-label="Fecha desde" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value, page: 1 }))} className="h-9 rounded-lg border border-slate-200 px-3" />
          <input type="date" aria-label="Fecha hasta" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value, page: 1 }))} className="h-9 rounded-lg border border-slate-200 px-3" />
          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} placeholder="Buscar caso o tema" className="min-w-0 flex-1 outline-none" /></label>
        </div></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{["Fecha", "Funcionalidad", "Caso", "Tema", "Estado", "Tokens", "Modelo"].map((label) => <th key={label} className="px-3 py-2 font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{payload.interactions.map((item) => <tr key={item.id}><td className="whitespace-nowrap px-3 py-2">{shortDate(item.created_at)}</td><td className="px-3 py-2 font-bold">{payload.featureUsage.find((usage) => usage.feature.feature_key === item.feature_key)?.feature.name ?? item.feature_key}</td><td className="px-3 py-2">{item.case_number ? `#${item.case_number.replace(/^#/, "")}` : "—"}</td><td className="px-3 py-2">{item.topic ?? "—"}</td><td className="px-3 py-2"><span className={`inline-flex items-center gap-1 font-bold ${item.status === "SUCCESS" ? "text-emerald-700" : item.status === "ERROR" ? "text-red-600" : "text-amber-700"}`}><Zap className="h-3 w-3" />{statusLabels[item.status] ?? item.status}</span></td><td className="px-3 py-2">{item.tokens_used?.toLocaleString("es-CL") ?? "—"}</td><td className="px-3 py-2">{item.model ?? "—"}</td></tr>)}{!payload.interactions.length ? <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No hay interacciones para estos filtros.</td></tr> : null}</tbody></table></div>
        <footer className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs text-slate-500"><span>Mostrando {payload.interactions.length} de {payload.pagination.total} resultados</span><div className="flex gap-2"><button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded border px-3 py-1.5 disabled:opacity-40">Anterior</button><span className="rounded bg-blue-600 px-3 py-1.5 font-bold text-white">{filters.page}</span><button disabled={filters.page >= payload.pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded border px-3 py-1.5 disabled:opacity-40">Siguiente</button></div></footer>
      </section>
    </div>
  );
}
