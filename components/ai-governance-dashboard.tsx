"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import type { AiFeature, AiGovernanceUser, AiUserLimit } from "@/lib/ai-governance-types";

type ChangeEvent = {
  id: string;
  target_user_id: string;
  change_type: string;
  feature_key: string | null;
  created_at: string;
  changer?: { name?: string } | null;
};

type GovernancePayload = {
  ok: boolean;
  error?: string;
  users: AiGovernanceUser[];
  features: AiFeature[];
  limits: AiUserLimit[];
  interactionsToday: Array<{ user_id: string; feature_key: string; status: string }>;
  history: ChangeEvent[];
  summary: { activeUsers: number; usesToday: number; usersAtLimit: number; activeLimits: number };
};

type BulkValue = { dailyLimit: number; monthlyLimit: number; isActive: boolean };
type UserDraft = BulkValue & {
  featureKey: string;
  temporaryDailyLimit: number | null;
  temporaryLimitExpiresAt: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function createDraft(limits: AiUserLimit[]): Record<string, UserDraft> {
  return Object.fromEntries(
    limits.map((limit) => [
      limit.feature_key,
      {
        featureKey: limit.feature_key,
        dailyLimit: limit.daily_limit,
        monthlyLimit: limit.monthly_limit,
        temporaryDailyLimit: limit.temporary_daily_limit,
        temporaryLimitExpiresAt: limit.temporary_expires_at,
        isActive: limit.is_active,
      },
    ]),
  );
}

export function AiGovernanceDashboard() {
  const [data, setData] = useState<GovernancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"bulk" | "user">("bulk");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkValues, setBulkValues] = useState<Record<string, BulkValue>>({});
  const [temporary, setTemporary] = useState({ featureKey: "", dailyLimit: 0, expiresAt: "", reason: "" });
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userDraft, setUserDraft] = useState<Record<string, UserDraft>>({});

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/ai/usage/limits", { cache: "no-store" });
    const payload = (await response.json()) as GovernancePayload;
    if (!response.ok || !payload.ok) throw new Error(payload.error || "No se pudo cargar Gobierno IA.");
    setData(payload);
    setSelectedUserId((current) => current || payload.users.find((user) => user.status === "ACTIVE")?.id || "");
    setBulkValues((current) => {
      if (Object.keys(current).length) return current;
      return Object.fromEntries(payload.features.map((feature) => {
        const source = payload.limits.find((limit) => limit.feature_key === feature.feature_key);
        return [feature.feature_key, { dailyLimit: source?.daily_limit ?? 0, monthlyLimit: source?.monthly_limit ?? 0, isActive: source?.is_active ?? true }];
      }));
    });
    setTemporary((current) => ({ ...current, featureKey: current.featureKey || payload.features[0]?.feature_key || "" }));
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load().catch((caught) => setError(caught instanceof Error ? caught.message : "No se pudo cargar Gobierno IA."));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const areas = useMemo(
    () => [...new Set((data?.users ?? []).map((user) => user.area).filter(Boolean) as string[])].sort(),
    [data],
  );
  const filteredUsers = useMemo(
    () => (data?.users ?? []).filter((user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase()) && (!area || user.area === area),
    ),
    [area, data, query],
  );
  const selectedUser = data?.users.find((user) => user.id === selectedUserId) ?? null;
  const selectedLimits = data?.limits.filter((limit) => limit.user_id === selectedUserId) ?? [];
  const selectedHistory = data?.history.filter((event) => event.target_user_id === selectedUserId) ?? [];

  async function mutate(url: string, options: RequestInit, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers },
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "No se pudo guardar el cambio.");
      await load();
      setNotice(success);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el cambio.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function selectUser(userId: string) {
    setSelectedUserId(userId);
    setIsEditingUser(false);
    setUserDraft({});
    setNotice(null);
  }

  function startUserEditing() {
    setUserDraft(createDraft(selectedLimits));
    setIsEditingUser(true);
    setError(null);
    setNotice(null);
  }

  function cancelUserEditing() {
    setUserDraft({});
    setIsEditingUser(false);
    setNotice(null);
  }

  function updateDraft(featureKey: string, patch: Partial<UserDraft>) {
    setUserDraft((current) => ({
      ...current,
      [featureKey]: { ...current[featureKey], ...patch },
    }));
  }

  async function saveUserLimits() {
    const limits = Object.values(userDraft).map((limit) => ({
      ...limit,
      temporaryLimitExpiresAt: limit.temporaryLimitExpiresAt
        ? new Date(`${toDateInput(limit.temporaryLimitExpiresAt)}T23:59:59`).toISOString()
        : null,
    }));
    const saved = await mutate(
      "/api/ai/usage/limits/user",
      { method: "PATCH", body: JSON.stringify({ userId: selectedUserId, limits }) },
      "Límites actualizados correctamente.",
    );
    if (saved) {
      setIsEditingUser(false);
      setUserDraft({});
    }
  }

  function useSelectedUserAsTemplate() {
    const sourceUserId = selectedIds[0];
    if (!sourceUserId) return setError("Selecciona un ejecutivo para usar sus límites como plantilla.");
    const sourceLimits = data?.limits.filter((limit) => limit.user_id === sourceUserId) ?? [];
    setBulkValues(Object.fromEntries(sourceLimits.map((limit) => [limit.feature_key, { dailyLimit: limit.daily_limit, monthlyLimit: limit.monthly_limit, isActive: limit.is_active }])));
    setNotice("Plantilla cargada. Revisa los valores antes de aplicar.");
  }

  async function applyBulk() {
    if (!selectedIds.length) return setError("Selecciona al menos un ejecutivo.");
    await mutate(
      "/api/ai/usage/limits/bulk",
      { method: "POST", body: JSON.stringify({ targetUserIds: selectedIds, limits: Object.entries(bulkValues).map(([featureKey, value]) => ({ featureKey, ...value })), reason: "Configuración masiva desde Gobierno IA" }) },
      `Límites aplicados a ${selectedIds.length} usuarios.`,
    );
  }

  async function applyTemporary() {
    if (!selectedIds.length) return setError("Selecciona al menos un usuario.");
    await mutate(
      "/api/ai/usage/limits/temporary",
      { method: "POST", body: JSON.stringify({ targetUserIds: selectedIds, featureKey: temporary.featureKey, dailyLimit: temporary.dailyLimit, expiresAt: new Date(`${temporary.expiresAt}T23:59:59`).toISOString(), reason: temporary.reason }) },
      "Excepción temporal aplicada.",
    );
  }

  function exportUsers() {
    if (!data) return;
    const rows = [["nombre", "email", "area", "funcionalidad", "limite_diario", "limite_mensual", "activo"]];
    data.users.forEach((user) => data.limits.filter((limit) => limit.user_id === user.id).forEach((limit) => rows.push([user.name, user.email, user.area ?? "", limit.feature_key, String(limit.daily_limit), String(limit.monthly_limit), String(limit.is_active)])));
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "gobierno-ia.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!data && !error) return <div className="rounded-xl border bg-white p-8 text-sm font-semibold text-slate-500">Cargando Gobierno IA...</div>;
  if (!data) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">{error}</div>;

  return (
    <div className="space-y-4 text-[13px]">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">Gobierno IA</h1>
        <p className="mt-1 text-sm text-slate-600">Administra y controla límites de uso por usuario y funcionalidad.</p>
        <div className="mt-3 flex gap-2 border-b border-slate-200">
          <button onClick={() => setTab("bulk")} className={`px-3 py-2 font-extrabold ${tab === "bulk" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500"}`}>Gestión masiva</button>
          <button onClick={() => setTab("user")} className={`px-3 py-2 font-extrabold ${tab === "user" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500"}`}>Gestión por usuario</button>
        </div>
      </header>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700">{notice}</div> : null}

      {tab === "bulk" ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Usuarios activos con IA", value: data.summary.activeUsers, icon: Users, tone: "blue" },
              { label: "Asignaciones hoy", value: data.summary.usesToday, icon: CheckCircle2, tone: "green" },
              { label: "Usuarios con límite alcanzado", value: data.summary.usersAtLimit, icon: AlertTriangle, tone: "orange" },
              { label: "Límites activos", value: data.summary.activeLimits, icon: Sparkles, tone: "violet" },
            ].map((item) => (
              <article key={item.label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="rounded-full bg-blue-50 p-3 text-blue-600"><item.icon className="h-6 w-6" /></span>
                <div><p className="text-xs font-bold text-slate-500">{item.label}</p><p className="text-2xl font-black text-slate-950">{item.value}</p></div>
              </article>
            ))}
          </section>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(330px,0.8fr)]">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b p-4">
                <h2 className="text-base font-black">Gestión masiva de límites</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={useSelectedUserAsTemplate} className="h-9 rounded-lg border border-blue-200 px-3 font-bold text-blue-600">Aplicar plantilla</button>
                  <button onClick={() => setBulkValues((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, isActive: !value.isActive }]))) } className="h-9 rounded-lg border border-blue-200 px-3 font-bold text-blue-600">Activar / Desactivar</button>
                  <button onClick={exportUsers} className="h-9 rounded-lg border border-blue-200 px-3 font-bold text-blue-600">Exportar</button>
                  <select value={area} onChange={(event) => setArea(event.target.value)} className="h-9 rounded-lg border px-3"><option value="">Todas las áreas</option>{areas.map((value) => <option key={value}>{value}</option>)}</select>
                  <label className="flex h-9 min-w-52 items-center gap-2 rounded-lg border px-3"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ejecutivo" className="min-w-0 flex-1 outline-none" /></label>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-2" />{["Ejecutivo", "Área", "Estado", "Usos hoy", "Alertas"].map((label) => <th key={label} className="px-3 py-2 font-black">{label}</th>)}</tr></thead>
                  <tbody className="divide-y">{filteredUsers.map((user) => {
                    const uses = data.interactionsToday.filter((item) => item.user_id === user.id && item.status === "SUCCESS").length;
                    const alerts = data.interactionsToday.filter((item) => item.user_id === user.id && item.status === "BLOCKED_LIMIT").length;
                    return <tr key={user.id}><td className="px-3 py-2"><input type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => setSelectedIds((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id])} /></td><td className="px-3 py-2"><p className="font-extrabold">{user.name}</p><p className="text-[11px] text-slate-500">{user.email}</p></td><td className="px-3 py-2">{user.area ?? "Sin área"}</td><td className="px-3 py-2">{user.status}</td><td className="px-3 py-2">{uses}</td><td className="px-3 py-2 text-amber-600">{alerts || "—"}</td></tr>;
                  })}</tbody>
                </table>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-black">Configuración masiva</h2>
              <p className="text-xs text-slate-500">{selectedIds.length} usuarios seleccionados</p>
              <div className="mt-3 space-y-2">{data.features.map((feature) => {
                const value = bulkValues[feature.feature_key] ?? { dailyLimit: 0, monthlyLimit: 0, isActive: true };
                return <div key={feature.feature_key} className="rounded-lg border p-3"><div className="flex justify-between gap-2"><p className="font-extrabold">{feature.name}</p><input type="checkbox" checked={value.isActive} onChange={(event) => setBulkValues((current) => ({ ...current, [feature.feature_key]: { ...value, isActive: event.target.checked } }))} /></div><div className="mt-2 grid grid-cols-2 gap-2"><input aria-label={`Límite diario ${feature.name}`} type="number" min={0} value={value.dailyLimit} onChange={(event) => setBulkValues((current) => ({ ...current, [feature.feature_key]: { ...value, dailyLimit: Number(event.target.value) } }))} className="h-8 rounded border px-2" /><input aria-label={`Límite mensual ${feature.name}`} type="number" min={0} value={value.monthlyLimit} onChange={(event) => setBulkValues((current) => ({ ...current, [feature.feature_key]: { ...value, monthlyLimit: Number(event.target.value) } }))} className="h-8 rounded border px-2" /></div></div>;
              })}</div>
              <button disabled={busy} onClick={() => void applyBulk()} className="mt-4 h-10 w-full rounded-lg bg-blue-600 font-extrabold text-white disabled:opacity-50">Aplicar a {selectedIds.length} usuarios</button>
            </section>
          </div>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-600" /><h2 className="font-black">Excepción temporal para selección</h2></div>
            <div className="mt-3 grid gap-2 md:grid-cols-4"><select value={temporary.featureKey} onChange={(event) => setTemporary((current) => ({ ...current, featureKey: event.target.value }))} className="h-9 rounded-lg border px-3">{data.features.map((feature) => <option key={feature.feature_key} value={feature.feature_key}>{feature.name}</option>)}</select><input type="number" min={0} value={temporary.dailyLimit} onChange={(event) => setTemporary((current) => ({ ...current, dailyLimit: Number(event.target.value) }))} className="h-9 rounded-lg border px-3" placeholder="Cupo diario" /><input type="date" value={temporary.expiresAt} onChange={(event) => setTemporary((current) => ({ ...current, expiresAt: event.target.value }))} className="h-9 rounded-lg border px-3" /><button disabled={busy || !temporary.expiresAt} onClick={() => void applyTemporary()} className="h-9 rounded-lg border border-blue-600 font-extrabold text-blue-600 disabled:opacity-50">Aplicar excepción</button></div>
          </section>
        </>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block max-w-xl text-[10px] font-black uppercase text-slate-500">Selecciona un ejecutivo
              <select value={selectedUserId} onChange={(event) => selectUser(event.target.value)} disabled={isEditingUser} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold normal-case text-slate-900 disabled:bg-slate-100">{data.users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}</select>
            </label>
            {selectedUser ? <div className="mt-4 flex items-center gap-4 border-t pt-4"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-lg font-black text-blue-700">{selectedUser.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><h2 className="text-xl font-black">{selectedUser.name}</h2><p className="text-xs text-slate-500">{selectedUser.role} · {selectedUser.team ?? selectedUser.area ?? "Sin equipo"} · {selectedUser.email}</p></div></div> : null}
          </section>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.6fr)]">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="text-base font-black">Límites por funcionalidad</h2><p className="text-xs text-slate-500">Los cambios se guardan únicamente al confirmar.</p></div>
                {!isEditingUser ? <button onClick={startUserEditing} className="h-9 rounded-lg bg-blue-600 px-4 font-extrabold text-white">Editar límites</button> : <div className="flex gap-2"><button disabled={busy} onClick={cancelUserEditing} className="h-9 rounded-lg border px-4 font-extrabold text-slate-600">Cancelar</button><button disabled={busy} onClick={() => void saveUserLimits()} className="h-9 rounded-lg bg-blue-600 px-4 font-extrabold text-white disabled:opacity-50">{busy ? "Guardando..." : "Guardar cambios"}</button></div>}
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border">
                <table className="min-w-[820px] w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{["Funcionalidad", "Diario", "Mensual", "Temporal diario", "Expira", "Estado"].map((label) => <th key={label} className="px-3 py-2 font-black">{label}</th>)}</tr></thead>
                  <tbody className="divide-y">{selectedLimits.map((limit) => {
                    const feature = data.features.find((item) => item.feature_key === limit.feature_key);
                    const draft = userDraft[limit.feature_key];
                    const current = draft ?? { featureKey: limit.feature_key, dailyLimit: limit.daily_limit, monthlyLimit: limit.monthly_limit, temporaryDailyLimit: limit.temporary_daily_limit, temporaryLimitExpiresAt: limit.temporary_expires_at, isActive: limit.is_active };
                    return <tr key={limit.id}><td className="px-3 py-3 font-extrabold">{feature?.name ?? limit.feature_key}</td><td className="px-3 py-2"><input disabled={!isEditingUser} type="number" min={0} value={current.dailyLimit} onChange={(event) => updateDraft(limit.feature_key, { dailyLimit: Number(event.target.value) })} className="h-8 w-20 rounded border px-2 disabled:bg-slate-50" /></td><td className="px-3 py-2"><input disabled={!isEditingUser} type="number" min={0} value={current.monthlyLimit} onChange={(event) => updateDraft(limit.feature_key, { monthlyLimit: Number(event.target.value) })} className="h-8 w-24 rounded border px-2 disabled:bg-slate-50" /></td><td className="px-3 py-2"><input disabled={!isEditingUser} type="number" min={0} value={current.temporaryDailyLimit ?? ""} onChange={(event) => updateDraft(limit.feature_key, { temporaryDailyLimit: event.target.value === "" ? null : Number(event.target.value) })} className="h-8 w-24 rounded border px-2 disabled:bg-slate-50" /></td><td className="px-3 py-2"><input disabled={!isEditingUser} type="date" value={toDateInput(current.temporaryLimitExpiresAt)} onChange={(event) => updateDraft(limit.feature_key, { temporaryLimitExpiresAt: event.target.value || null })} className="h-8 rounded border px-2 disabled:bg-slate-50" /></td><td className="px-3 py-2"><button disabled={!isEditingUser} onClick={() => updateDraft(limit.feature_key, { isActive: !current.isActive })} className={`rounded-full px-2 py-1 text-[10px] font-black disabled:opacity-70 ${current.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{current.isActive ? "Activo" : "Inactivo"}</button></td></tr>;
                  })}</tbody>
                </table>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-black">Historial de cambios</h2>
              <div className="mt-3 divide-y">{selectedHistory.slice(0, 10).map((event) => <article key={event.id} className="py-2"><div className="flex justify-between gap-2"><p className="font-bold">{event.change_type.replaceAll("_", " ")}</p><span className="text-[10px] text-slate-500">{formatDate(event.created_at)}</span></div><p className="text-[11px] text-slate-500">{data.features.find((feature) => feature.feature_key === event.feature_key)?.name ?? event.feature_key ?? "Configuración"} · {event.changer?.name ?? "Administrador"}</p></article>)}{!selectedHistory.length ? <p className="py-4 text-slate-500">No hay cambios registrados.</p> : null}</div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
