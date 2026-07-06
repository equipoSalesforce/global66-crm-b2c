"use client";

import { listDashboardFolders, saveDashboard, type DashboardVisibility } from "@/lib/paneles-api";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export function CreatePanelView() {
  const router = useRouter();
  const folders = listDashboardFolders().filter((folder) => !["all", "mine"].includes(folder.id));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState(folders[0]?.id || "operations");
  const [visibility, setVisibility] = useState<DashboardVisibility>("private");

  function create() {
    if (!name.trim()) return;
    const id = `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "panel"}-${Date.now()}`;
    saveDashboard({ id, name: name.trim(), description: description.trim(), folderId, visibility, owner: { id: "owner-1", name: "Equipo Operaciones", initials: "EO" }, updatedAt: new Date().toISOString(), widgets: [] });
    router.push(`/paneles/${id}`);
  }

  return <div className="mx-auto max-w-3xl space-y-3 pb-6"><div className="text-[10px] font-semibold text-slate-500"><Link href="/paneles" className="hover:text-blue-600">Paneles</Link> › Nuevo panel</div><section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-slate-200 p-5"><Link href="/paneles" className="rounded-lg border border-slate-200 p-2 text-slate-500"><ArrowLeft className="h-4 w-4" /></Link><span className="rounded-xl bg-blue-50 p-2 text-blue-600"><LayoutDashboard className="h-5 w-5" /></span><div><h1 className="text-xl font-extrabold text-slate-950">Nuevo panel</h1><p className="text-xs text-slate-500">Crea el contenedor y luego agrega widgets.</p></div></div><div className="space-y-4 p-5"><label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Nombre del panel<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Seguimiento de operación" className={inputClass} /></label><label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explica qué decisiones soporta este panel..." className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-400" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Carpeta<select value={folderId} onChange={(event) => setFolderId(event.target.value)} className={inputClass}>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Visibilidad<select value={visibility} onChange={(event) => setVisibility(event.target.value as DashboardVisibility)} className={inputClass}><option value="private">Privado</option><option value="shared">Compartido</option><option value="internal">Público interno</option></select></label></div></div><div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3"><Link href="/paneles" className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600">Cancelar</Link><button type="button" disabled={!name.trim()} onClick={create} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Crear panel</button></div></section></div>;
}
