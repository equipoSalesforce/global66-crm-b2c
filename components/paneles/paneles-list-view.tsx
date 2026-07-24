"use client";

import {
  createDashboardFolder,
  deleteDashboard,
  duplicateDashboard,
  listDashboardFolders,
  listDashboards,
  type DashboardDefinition,
  type DashboardVisibility,
  dashboardFolders,
} from "@/lib/paneles-api";
import {
  Copy,
  Bot,
  Edit3,
  ExternalLink,
  Folder,
  FolderPlus,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PanelVisibilityBadge } from "./panel-ui";

const filters: Array<{ id: "all" | "mine" | DashboardVisibility; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "mine", label: "Mis paneles" },
  { id: "shared", label: "Compartidos conmigo" },
  { id: "private", label: "Privados" },
  { id: "internal", label: "Públicos internos" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function SimpleModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-base font-extrabold text-slate-900">{title}</h2><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>{children}</div></div>;
}

export function PanelesListView() {
  const [dashboards, setDashboards] = useState<DashboardDefinition[]>([]);
  const [folders, setFolders] = useState(dashboardFolders);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [folderId, setFolderId] = useState("all");
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [shareDashboard, setShareDashboard] = useState<DashboardDefinition | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDashboards(listDashboards());
      setFolders(listDashboardFolders());
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const visible = useMemo(() => dashboards.filter((dashboard) => {
    const matchesQuery = `${dashboard.name} ${dashboard.description}`.toLowerCase().includes(query.toLowerCase());
    const matchesFolder = folderId === "all" || folderId === "mine" || dashboard.folderId === folderId;
    const matchesFilter = filter === "all" || (filter === "mine" ? dashboard.owner.id === "owner-1" : dashboard.visibility === filter);
    return matchesQuery && matchesFolder && matchesFilter;
  }), [dashboards, query, folderId, filter]);

  function duplicate(id: string) { const copy = duplicateDashboard(id); if (copy) setDashboards(listDashboards()); }
  function remove(id: string) { if (!window.confirm("¿Eliminar este panel?")) return; deleteDashboard(id); setDashboards(listDashboards()); }
  function addFolder() { if (!folderName.trim()) return; createDashboardFolder(folderName); setFolders(listDashboardFolders()); setFolderName(""); setFolderModal(false); }

  return (
    <div className="space-y-3 pb-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><LayoutDashboard className="h-5 w-5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-600">Analytics Studio</p><h1 className="text-2xl font-extrabold text-slate-950">Paneles</h1><p className="mt-0.5 text-xs text-slate-500">Crea, organiza y comparte paneles de operación.</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setFolderModal(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-[var(--g66-secondary-interactive)] hover:text-[var(--g66-secondary-interactive)]"><FolderPlus className="h-4 w-4" /> Nueva carpeta</button><Link href="/dashboards/ai-builder" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--g66-brand-blue)] px-3 text-xs font-bold text-[var(--g66-brand-blue)] hover:border-[var(--g66-secondary-interactive)] hover:text-[var(--g66-secondary-interactive)]"><Bot className="h-4 w-4" /> Crear panel con IA</Link><Link href="/paneles/nuevo" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-[var(--g66-secondary-interactive)]"><Plus className="h-4 w-4" /> Nuevo panel</Link></div></section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between"><label className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paneles..." className="w-full bg-transparent text-xs outline-none" /></label><div className="flex flex-wrap gap-1.5">{filters.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${filter === item.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{item.label}</button>)}</div></div>
        <div className="grid min-h-[430px] lg:grid-cols-[210px_minmax(0,1fr)]"><aside className="border-b border-slate-200 p-3 lg:border-b-0 lg:border-r"><p className="px-2 pb-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Carpetas</p><nav className="grid grid-cols-2 gap-1 lg:grid-cols-1">{folders.map((folder) => <button key={folder.id} type="button" onClick={() => setFolderId(folder.id)} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold ${folderId === folder.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}><Folder className="h-3.5 w-3.5" />{folder.name}</button>)}</nav></aside>
          <div className="min-w-0 overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-2.5">Nombre</th><th className="px-3 py-2.5">Carpeta</th><th className="px-3 py-2.5">Visibilidad</th><th className="px-3 py-2.5">Dueño</th><th className="px-3 py-2.5">Actualización</th><th className="px-3 py-2.5 text-center">Widgets</th><th className="px-3 py-2.5 text-right">Acciones</th></tr></thead><tbody>{visible.map((dashboard) => { const folder = folders.find((item) => item.id === dashboard.folderId); return <tr key={dashboard.id} className="border-t border-slate-100 hover:bg-blue-50/30"><td className="px-4 py-3"><Link href={`/paneles/${dashboard.id}`} className="font-extrabold text-sm text-slate-900 hover:text-blue-600">{dashboard.name}</Link><p className="mt-0.5 max-w-xs truncate text-[10px] text-slate-500">{dashboard.description}</p></td><td className="px-3 py-3 text-[11px] font-semibold text-slate-600">{folder?.name || "—"}</td><td className="px-3 py-3"><PanelVisibilityBadge visibility={dashboard.visibility} /></td><td className="px-3 py-3"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[8px] font-bold text-slate-600">{dashboard.owner.initials}</span><span className="text-[10px] font-semibold text-slate-600">{dashboard.owner.name}</span></div></td><td className="px-3 py-3 text-[10px] text-slate-500">{formatDate(dashboard.updatedAt)}</td><td className="px-3 py-3 text-center text-xs font-bold text-slate-700">{dashboard.widgets.length}</td><td className="px-3 py-3"><div className="flex justify-end gap-1"><Link title="Abrir" href={`/paneles/${dashboard.id}`} className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><ExternalLink className="h-3.5 w-3.5" /></Link><Link title="Editar" href={`/paneles/${dashboard.id}?edit=true`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5" /></Link><button title="Duplicar" type="button" onClick={() => duplicate(dashboard.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><Copy className="h-3.5 w-3.5" /></button><button title="Compartir" type="button" onClick={() => setShareDashboard(dashboard)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><Share2 className="h-3.5 w-3.5" /></button><button title="Eliminar" type="button" onClick={() => remove(dashboard.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>; })}</tbody></table>{!visible.length ? <div className="flex flex-col items-center py-20 text-slate-400"><MoreHorizontal className="h-8 w-8" /><p className="mt-2 text-xs font-semibold">No encontramos paneles con estos filtros.</p></div> : null}</div>
        </div>
      </section>
      {folderModal ? <SimpleModal title="Nueva carpeta" onClose={() => setFolderModal(false)}><label className="mt-4 block text-[10px] font-bold uppercase text-slate-500">Nombre<input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setFolderModal(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-bold">Cancelar</button><button type="button" onClick={addFolder} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white">Crear carpeta</button></div></SimpleModal> : null}
      {shareDashboard ? <SimpleModal title={`Compartir “${shareDashboard.name}”`} onClose={() => setShareDashboard(null)}><p className="mt-3 text-xs leading-5 text-slate-500">La gestión real de usuarios y permisos llegará en una siguiente etapa. Esta vista permite preparar la experiencia de compartir.</p><label className="mt-4 block text-[10px] font-bold uppercase text-slate-500">Personas o equipos<input placeholder="Buscar por nombre..." className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none" /></label><button type="button" onClick={() => setShareDashboard(null)} className="mt-5 h-9 w-full rounded-lg bg-blue-600 text-xs font-bold text-white"><Share2 className="mr-1 inline h-3.5 w-3.5" /> Listo</button></SimpleModal> : null}
    </div>
  );
}
