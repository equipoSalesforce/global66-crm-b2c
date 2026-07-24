"use client";

import { AiProfileDashboard } from "@/components/ai-profile-dashboard";
import { clearDemoCrmSession } from "@/lib/crm-users";
import type { CrmProfile } from "@/lib/profile-service";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  LogOut,
  Monitor,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const tabs = [
  { value: "profile", label: "Perfil" },
  { value: "security", label: "Seguridad y acceso" },
  { value: "activity", label: "Actividad" },
  { value: "ai-preferences", label: "Preferencias IA" },
] as const;

function formatDate(value: string | null) {
  if (!value) return "Sin información";
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileWorkspace({ profile }: { profile: CrmProfile }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = tabs.some((tab) => tab.value === requestedTab)
    ? requestedTab
    : "profile";
  const { user } = profile;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearDemoCrmSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <header className="border-b border-[var(--g66-border)]">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--g66-text-primary)]">
          Mi perfil
        </h1>
        <p className="mt-1 text-sm text-[var(--g66-text-secondary)]">
          Administra tu información, seguridad, actividad y preferencias personales.
        </p>
        <div className="mt-5 flex flex-wrap gap-7" role="tablist" aria-label="Secciones de mi perfil">
          {tabs.map((tab) => {
            const selected = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => router.replace(`/mi-perfil?tab=${tab.value}`, { scroll: false })}
                className={`h-10 border-b-2 px-1 text-sm font-medium transition ${
                  selected
                    ? "border-[var(--g66-brand-blue)] text-[var(--g66-brand-blue)]"
                    : "border-transparent text-[var(--g66-text-secondary)] hover:text-[var(--g66-secondary-interactive)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {activeTab === "profile" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-5 shadow-[var(--g66-shadow-card)]">
            <h2 className="flex items-center gap-2 font-semibold text-[var(--g66-text-primary)]">
              <UserRound className="h-5 w-5 text-[var(--g66-brand-blue)]" />
              Información personal
            </h2>
            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
              <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-4xl font-semibold text-[var(--g66-brand-blue)]">
                {initials(user.name)}
              </span>
              <dl className="grid gap-3 text-sm">
                <div><dt className="text-xs text-[var(--g66-text-muted)]">Nombre completo</dt><dd className="font-semibold">{user.name}</dd></div>
                <div><dt className="text-xs text-[var(--g66-text-muted)]">Correo corporativo</dt><dd className="font-medium text-[var(--g66-brand-blue)]">{user.email}</dd></div>
                <div className="flex gap-5"><div><dt className="text-xs text-[var(--g66-text-muted)]">Rol</dt><dd className="font-medium">{user.role}</dd></div><div><dt className="text-xs text-[var(--g66-text-muted)]">Área</dt><dd className="font-medium">{user.area || user.team || "Sin área"}</dd></div></div>
              </dl>
            </div>
          </section>
          <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-5 shadow-[var(--g66-shadow-card)]">
            <h2 className="flex items-center gap-2 font-semibold text-[var(--g66-text-primary)]"><ShieldCheck className="h-5 w-5 text-[var(--g66-brand-blue)]" />Acceso al CRM</h2>
            <dl className="mt-4 divide-y divide-[var(--g66-border-soft)] text-sm">
              <div className="flex justify-between gap-4 py-3"><dt className="text-[var(--g66-text-secondary)]">Método de inicio</dt><dd className="font-medium">{profile.loginMethod}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-[var(--g66-text-secondary)]">Estado</dt><dd className="text-[var(--g66-success)]">Activo</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-[var(--g66-text-secondary)]">Correo habilitado</dt><dd className="font-medium">{user.email}</dd></div>
            </dl>
          </section>
          <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-5 shadow-[var(--g66-shadow-card)]">
            <h2 className="flex items-center gap-2 font-semibold"><Monitor className="h-5 w-5 text-[var(--g66-brand-blue)]" />Sesión actual</h2>
            <p className="mt-4 text-sm text-[var(--g66-text-secondary)]">{profile.userAgent || "Información del navegador no disponible."}</p>
            <p className="mt-2 text-sm">Última conexión: <span className="font-medium">{formatDate(profile.lastLoginAt)}</span></p>
            <button type="button" onClick={() => void logout()} className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--g66-danger)] px-4 text-sm font-medium text-[var(--g66-danger)]"><LogOut className="h-4 w-4" />Cerrar sesión</button>
          </section>
          <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-5 shadow-[var(--g66-shadow-card)]">
            <h2 className="flex items-center gap-2 font-semibold"><Activity className="h-5 w-5 text-[var(--g66-brand-blue)]" />Resumen de actividad</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--g66-surface-soft)] p-4"><p className="text-xs text-[var(--g66-text-muted)]">Eventos recientes</p><p className="mt-1 text-2xl font-semibold">{profile.activity.length}</p></div>
              <div className="rounded-xl bg-[var(--g66-surface-soft)] p-4"><p className="text-xs text-[var(--g66-text-muted)]">Último acceso</p><p className="mt-1 text-sm font-semibold">{formatDate(profile.lastLoginAt)}</p></div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "security" ? (
        <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-5 shadow-[var(--g66-shadow-card)]">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-[var(--g66-brand-blue)]" />Seguridad y acceso</h2>
          <dl className="mt-4 divide-y divide-[var(--g66-border-soft)] text-sm">
            <div className="grid gap-1 py-3 sm:grid-cols-2"><dt className="text-[var(--g66-text-secondary)]">Método de inicio de sesión</dt><dd className="font-medium">{profile.loginMethod}</dd></div>
            <div className="grid gap-1 py-3 sm:grid-cols-2"><dt className="text-[var(--g66-text-secondary)]">Correo corporativo</dt><dd className="font-medium">{user.email}</dd></div>
            <div className="grid gap-1 py-3 sm:grid-cols-2"><dt className="text-[var(--g66-text-secondary)]">Alias legacy</dt><dd className="font-medium">{profile.legacyAlias || "Sin alias adicional"}</dd></div>
            <div className="grid gap-1 py-3 sm:grid-cols-2"><dt className="text-[var(--g66-text-secondary)]">Sesión iniciada</dt><dd className="font-medium">{formatDate(profile.sessionStartedAt)}</dd></div>
          </dl>
        </section>
      ) : null}

      {activeTab === "activity" ? (
        <section className="overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-card)]">
          <div className="border-b border-[var(--g66-border)] p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Clock3 className="h-5 w-5 text-[var(--g66-brand-blue)]" />Actividad reciente</h2></div>
          {profile.activity.length ? <div className="divide-y divide-[var(--g66-border-soft)]">{profile.activity.map((item) => <article key={item.id} className="flex gap-3 px-5 py-4">{item.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g66-success)]" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g66-danger)]" />}<div className="min-w-0"><p className="text-sm font-medium">{item.action}</p><p className="mt-1 text-xs text-[var(--g66-text-secondary)]">{item.detail}</p><time className="mt-1 block text-[11px] text-[var(--g66-text-muted)]">{formatDate(item.createdAt)}</time></div></article>)}</div> : <div className="grid place-items-center p-12 text-center"><Activity className="h-8 w-8 text-[var(--g66-text-muted)]" /><p className="mt-3 text-sm font-medium">Aún no hay actividad registrada.</p></div>}
        </section>
      ) : null}

      {activeTab === "ai-preferences" ? (
        <section aria-label="Preferencias IA">
          <div className="mb-4 flex items-center gap-2"><Bot className="h-5 w-5 text-[var(--g66-brand-blue)]" /><div><h2 className="font-semibold">Preferencias IA</h2><p className="text-xs text-[var(--g66-text-secondary)]">Tu uso, cupos y recomendaciones actuales.</p></div></div>
          <AiProfileDashboard embedded />
        </section>
      ) : null}
    </div>
  );
}
