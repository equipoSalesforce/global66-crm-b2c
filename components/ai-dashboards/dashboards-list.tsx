"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, ExternalLink, LayoutDashboard, Plus, Search } from "lucide-react";
import type { SafeDashboardDefinition } from "@/lib/analytics/semantic-layer";

type DashboardListItem = {
  id: string;
  name: string;
  description: string | null;
  owner_user_name: string | null;
  visibility: "PRIVATE" | "TEAM" | "PUBLIC";
  source: string;
  definition: SafeDashboardDefinition;
  updated_at: string;
};

export function DashboardsList() {
  const [dashboards, setDashboards] = useState<DashboardListItem[]>([]);
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/dashboards", { cache: "no-store" });
        const payload = (await response.json()) as { ok?: boolean; error?: string; dashboards?: DashboardListItem[] };
        if (!response.ok || !payload.ok) throw new Error(payload.error || "No se pudieron cargar los dashboards.");
        setDashboards(payload.dashboards ?? []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudieron cargar los dashboards.");
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const visible = useMemo(() => dashboards.filter((dashboard) => {
    const matchesQuery = `${dashboard.name} ${dashboard.description ?? ""} ${dashboard.owner_user_name ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!visibility || dashboard.visibility === visibility);
  }), [dashboards, query, visibility]);

  return <div className="space-y-4 pb-8"><section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><LayoutDashboard className="h-5 w-5" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">Analytics Studio</p><h1 className="text-2xl font-black text-slate-950">Dashboards</h1><p className="mt-1 text-xs text-slate-500">Paneles operativos guardados con datos reales del CRM.</p></div></div><Link href="/dashboards/ai-builder" className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black text-white shadow-sm hover:bg-blue-700"><Bot className="h-4 w-4" />Crear con IA</Link></section><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-2 sm:flex-row"><label className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar dashboards..." className="w-full bg-transparent text-xs outline-none" /></label><select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold"><option value="">Todas las visibilidades</option><option value="PRIVATE">Privados</option><option value="TEAM">Equipo</option><option value="PUBLIC">Públicos</option></select></div></section>{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}{loading ? <div className="rounded-xl border bg-white p-8 text-sm font-semibold text-slate-500">Cargando dashboards...</div> : <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((dashboard) => <article key={dashboard.id} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="rounded-lg bg-violet-50 p-2 text-violet-600"><Plus className="h-4 w-4" /></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">{dashboard.visibility}</span></div><h2 className="mt-4 text-base font-black text-slate-950">{dashboard.name}</h2><p className="mt-1 line-clamp-2 min-h-9 text-xs leading-5 text-slate-500">{dashboard.description || "Sin descripción"}</p><div className="mt-4 flex items-center justify-between border-t pt-3 text-[10px] text-slate-400"><span>{dashboard.definition.widgets.length} widgets · {dashboard.owner_user_name || "Sin owner"}</span><Link href={`/dashboards/${dashboard.id}`} className="inline-flex items-center gap-1 font-black text-blue-600">Abrir <ExternalLink className="h-3 w-3" /></Link></div></article>)}{!visible.length ? <div className="col-span-full rounded-xl border border-dashed bg-white py-16 text-center text-sm font-semibold text-slate-400">No hay dashboards para estos filtros.</div> : null}</section>}</div>;
}

