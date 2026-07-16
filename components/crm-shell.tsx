"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getNavigationItems } from "@/lib/permissions";
import { clearDemoCrmSession } from "@/lib/crm-users";
import { DemoAvailabilitySelect } from "./demo-availability-select";
import { Global66Mark } from "./global66-mark";
import { NotificationBell } from "./notification-bell";
import { ToastProvider } from "./toast-provider";
import { useCrmSession } from "./use-crm-session";
import { useCrmPermissions } from "./use-crm-permissions";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  FileBarChart,
  Home,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

const navigationIconByHref: Record<string, LucideIcon> = {
  "/dashboard": Home,
  "/paneles": LayoutDashboard,
  "/informes": FileBarChart,
  "/casos": BriefcaseBusiness,
  "/clientes": UsersRound,
  "/cuentas": UsersRound,
  "/agentes": UserRoundCheck,
  "/conversaciones": MessageCircle,
  "/casos?channel=GMAIL": Mail,
  "/logs-ia": Sparkles,
  "/mi-ia": Sparkles,
  "/configuracion/ia": ShieldCheck,
  "/sla": BarChart3,
  "/base-conocimiento": BookOpen,
  "/configuracion": Settings,
};

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isChecking } = useCrmSession();
  const { permissions: rolePermissions } = useCrmPermissions();
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [launcherQuery, setLauncherQuery] = useState("");
  const [casesGlobalSearch, setCasesGlobalSearch] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const launcherRef = useRef<HTMLDivElement | null>(null);
  const agentId = user?.id ?? "";
  const agentName = user?.name ?? "Agente";
  const agentRole = user?.role ?? "AGENT";
  const isCaseExpediente =
    pathname.startsWith("/casos/") && pathname !== "/casos/nuevo";
  const isCasesList = pathname === "/casos";
  const hasGlobalSidebar = true;
  const isDashboard = pathname === "/dashboard";
  const isCasesConsole = isCaseExpediente;
  const isAccount360 = pathname.startsWith("/cuentas/");
  const isSidebarCompact = sidebarCollapsed || isAccount360;
  const visibleNavigationItems = getNavigationItems(agentRole, rolePermissions);
  const activeItem =
    [...visibleNavigationItems]
      .sort((left, right) => right.href.length - left.href.length)
      .find(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) ??
    visibleNavigationItems[0] ??
    getNavigationItems("AGENT", rolePermissions)[0];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSidebarCollapsed(
        window.localStorage.getItem("crmSidebarCollapsed") === "true",
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("crmSidebarCollapsed", String(next));
      return next;
    });
  }

  function logoutDemoUser() {
    clearDemoCrmSession();
  }

  useEffect(() => {
    if (!isLauncherOpen) return;

    function handleClick(event: MouseEvent) {
      if (
        launcherRef.current &&
        !launcherRef.current.contains(event.target as Node)
      ) {
        setIsLauncherOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, [isLauncherOpen]);

  useEffect(() => {
    if (!agentId) return;

    let isMounted = true;

    async function loadNotificationCount() {
      try {
        const searchParams = new URLSearchParams({
          agentId,
          channel: "WHATSAPP",
          openOnly: "true",
        });
        const response = await fetch(`/api/notifications/cases?${searchParams}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          summary?: { red?: number; blue?: number };
        };

        if (!response.ok || !isMounted) return;

        setNotificationCount(
          (payload.summary?.red ?? 0) + (payload.summary?.blue ?? 0),
        );
      } catch (error) {
        console.error("[crm-shell] Error loading notification count", {
          message: error instanceof Error ? error.message : String(error),
          error,
        });
      }
    }

    loadNotificationCount();
    const intervalId = window.setInterval(loadNotificationCount, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [agentId]);

  const filteredNavigationItems = visibleNavigationItems.filter((item) =>
    item.label.toLowerCase().includes(launcherQuery.toLowerCase()),
  );

  function updateCasesGlobalSearch(value: string) {
    setCasesGlobalSearch(value);
    window.dispatchEvent(
      new CustomEvent("cases-global-search", { detail: value }),
    );
  }

  if (isChecking) {
    return (
      <ToastProvider>
        <div className="flex min-h-screen items-center justify-center bg-[var(--g66-background)] px-6 text-sm font-medium text-[var(--g66-text-secondary)]">
          Cargando sesión demo...
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[var(--g66-background)] text-[var(--g66-text-primary)]">
        {hasGlobalSidebar ? (
          <aside
            className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--g66-border)] bg-[var(--g66-sidebar-bg)] py-5 shadow-[var(--g66-shadow-card)] transition-all ${
              isSidebarCompact ? "w-16 px-2" : "w-60 px-4"
            }`}
          >
            <Link
              href="/dashboard"
              className={`flex items-center ${
                isSidebarCompact ? "justify-center" : "gap-3"
              }`}
              title="Global66 CRM"
            >
              <Global66Mark className="h-9 w-9" />
              <div className={isSidebarCompact ? "hidden" : ""}>
                <p className="text-lg font-black leading-5 text-[var(--g66-brand-blue)]">
                  Global66 CRM
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--g66-text-muted)]">
                  Operación interna
                </p>
              </div>
            </Link>

            <nav className="mt-6 grid gap-1">
              {visibleNavigationItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = navigationIconByHref[item.href] ?? BriefcaseBusiness;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex h-10 items-center gap-3 rounded-[var(--g66-radius-md)] px-3 text-sm font-bold transition ${
                      isActive
                        ? "bg-[var(--g66-brand-blue)] text-white shadow-[0_10px_22px_rgb(32_94_241/0.18)]"
                        : "text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
                    } ${isSidebarCompact ? "justify-center px-0" : ""}`}
                    title={item.label}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center ${
                        isActive ? "text-white" : "text-[var(--g66-text-secondary)]"
                      }`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className={isSidebarCompact ? "hidden" : "truncate"}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div
              className={`mt-auto rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-[var(--g66-surface-soft)] ${
                isSidebarCompact ? "p-2" : "p-3"
              }`}
            >
              <div
                className={`flex items-center ${
                  isSidebarCompact ? "justify-center" : "gap-2"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--g66-brand-blue)] text-xs font-black text-white">
                  {agentName.slice(0, 2).toUpperCase()}
                </span>
                <div className={isSidebarCompact ? "hidden" : "min-w-0"}>
                  <p className="text-xs font-black text-[var(--g66-text-primary)]">
                    Sesión demo
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold text-[var(--g66-text-secondary)]">
                    {agentName} · {agentRole}
                  </p>
                </div>
              </div>
              {!isAccount360 ? <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className={`mt-3 flex h-8 w-full items-center justify-center rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white text-xs font-black text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-brand-blue)] hover:text-[var(--g66-brand-blue)] ${
                  isSidebarCompact ? "px-0" : "px-3"
                }`}
                title={sidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
              >
                {isSidebarCompact ? ">" : "< Colapsar"}
              </button> : null}
            </div>
          </aside>
        ) : null}

        <header
          className={`fixed right-0 top-0 z-40 grid h-10 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--g66-border)] bg-[var(--g66-surface)] px-2 shadow-[var(--g66-shadow-card)] ${
            hasGlobalSidebar ? (isSidebarCompact ? "left-16" : "left-60") : "left-0"
          }`}
        >
          <div ref={launcherRef} className="relative">
            {hasGlobalSidebar ? (
              <div className="w-2" aria-hidden="true" />
            ) : (
              <button
                type="button"
                onClick={() => setIsLauncherOpen((current) => !current)}
                className="inline-flex h-8 items-center gap-2 rounded-full border border-transparent px-1.5 pr-3 text-sm font-extrabold text-[var(--g66-brand-blue)] hover:border-[var(--g66-border)] hover:bg-[var(--g66-brand-blue-soft)]"
                aria-expanded={isLauncherOpen}
                aria-label="Abrir App Launcher"
              >
                <Global66Mark className="h-6 w-6" />
                <span>Global66 CRM</span>
              </button>
            )}

            {!isCaseExpediente && isLauncherOpen ? (
              <div className="absolute left-0 top-9 z-50 w-72 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-[var(--g66-surface)] p-2 shadow-[var(--g66-shadow-soft)]">
                <input
                  value={launcherQuery}
                  onChange={(event) => setLauncherQuery(event.target.value)}
                  placeholder="Buscar..."
                  className="h-8 w-full rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-[var(--g66-surface-soft)] px-2 text-sm text-[var(--g66-text-primary)] outline-none placeholder:text-[var(--g66-text-muted)] focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                />
                <nav className="mt-2 grid gap-1">
                  {filteredNavigationItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
                    const Icon = navigationIconByHref[item.href] ?? BriefcaseBusiness;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setIsLauncherOpen(false)}
                        className={`flex h-9 items-center gap-2 rounded-md px-2 text-sm font-semibold transition-colors ${
                          isActive
                            ? "bg-[var(--g66-brand-blue)] text-white"
                            : "text-[var(--g66-text-primary)] hover:bg-[var(--g66-brand-blue-soft)]"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center ${
                            isActive ? "text-white" : "text-[var(--g66-text-secondary)]"
                          }`}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                  {filteredNavigationItems.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-[var(--g66-text-muted)]">
                      No hay resultados.
                    </p>
                  ) : null}
                </nav>
              </div>
            ) : null}
          </div>
          {hasGlobalSidebar ? (
            <div className="flex justify-center px-4">
              <input
                value={casesGlobalSearch}
                onChange={(event) => updateCasesGlobalSearch(event.target.value)}
                placeholder="Buscar clientes, casos, conversaciones..."
                className={`h-7 w-full rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-[var(--g66-surface-soft)] px-3 text-sm text-[var(--g66-text-primary)] outline-none placeholder:text-[var(--g66-text-muted)] focus:border-[var(--g66-brand-blue)] focus:bg-white focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] ${isAccount360 ? "max-w-lg" : "max-w-2xl"}`}
              />
            </div>
          ) : (
            <div />
          )}
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-xs font-semibold text-[var(--g66-text-muted)] sm:inline">
              {activeItem.label}
            </span>
            <span className="hidden truncate text-xs font-semibold text-[var(--g66-text-primary)] md:inline">
              {agentName} · {agentRole}
            </span>
            {notificationCount > 0 ? (
              <Link
                href="/casos"
                className="hidden rounded-full bg-[var(--g66-danger-soft)] px-2 py-1 text-xs font-bold text-[var(--g66-danger)] lg:inline-flex"
              >
                WhatsApp pendientes: {notificationCount}
              </Link>
            ) : null}
            {agentId ? (
              <NotificationBell key={agentId} currentUserId={agentId} />
            ) : null}
            {agentId ? (
              <DemoAvailabilitySelect userId={agentId} compact />
            ) : null}
            <Link
              href="/login"
              onClick={logoutDemoUser}
              className="hidden rounded-full border border-[var(--g66-border)] px-2 py-1 text-xs font-bold text-[var(--g66-text-secondary)] hover:border-[var(--g66-brand-blue)] hover:text-[var(--g66-brand-blue)] lg:inline-flex"
            >
              Cambiar usuario
            </Link>
          </div>
        </header>

        <main
          className={
            hasGlobalSidebar
              ? isSidebarCompact
                ? `pl-16 pt-10 ${isCasesConsole ? "h-screen overflow-hidden" : ""}`
                : `pl-60 pt-10 ${isCasesConsole ? "h-screen overflow-hidden" : ""}`
              : `pt-10 ${isCasesConsole ? "h-screen overflow-hidden" : ""}`
          }
        >
          <div
            className={
              isCasesConsole
                ? "h-[calc(100vh-40px)] min-h-0 w-full overflow-hidden bg-white"
                : isCasesList
                  ? "min-h-[calc(100vh-40px)] w-full bg-[#F4F6FA]"
                : isDashboard
                  ? "min-h-[calc(100vh-40px)] w-full overflow-hidden bg-[var(--g66-background)]"
                : isAccount360
                  ? "flex min-h-[calc(100vh-40px)] w-full flex-col gap-3 bg-[#f5f7fb] px-3 py-3 xl:px-4"
                : "mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-5 lg:px-6 lg:py-6"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
