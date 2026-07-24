"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getNavigationItems } from "@/lib/permissions";
import { clearDemoCrmSession } from "@/lib/crm-users";
import { DemoAvailabilitySelect } from "./demo-availability-select";
import { GlobalSearch } from "./global-search";
import { Global66Mark } from "./global66-mark";
import { NotificationBell } from "./notification-bell";
import { ToastProvider } from "./toast-provider";
import { useCrmSession } from "./use-crm-session";
import { useCrmPermissions } from "./use-crm-permissions";
import originalStyles from "./cases/case-detail-original.module.css";
import { caseDetailManrope, caseDetailMono } from "./cases/case-detail-fonts";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  Home,
  LayoutDashboard,
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
  "/dashboards": BarChart3,
  "/informes": FileBarChart,
  "/casos": BriefcaseBusiness,
  "/clientes": UsersRound,
  "/cuentas": UsersRound,
  "/agentes": UserRoundCheck,
  "/comunicaciones": MessageCircle,
  "/logs-ia": Sparkles,
  "/configuracion/ia": ShieldCheck,
  "/sla": BarChart3,
  "/base-conocimiento": BookOpen,
  "/configuracion": Settings,
};

type BreadcrumbItem = { label: string; href?: string };

function navigationBasePath(href: string) {
  return href.split("?")[0];
}

function isNavigationItemActive(pathname: string, href: string) {
  const basePath = navigationBasePath(href);

  if (pathname.startsWith("/configuracion")) return href === "/configuracion";
  if (pathname.startsWith("/casos")) return href === "/casos";
  if (pathname.startsWith("/cuentas") || pathname.startsWith("/clientes")) {
    return href === "/cuentas" || href === "/clientes";
  }

  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function getBreadcrumbs(
  pathname: string,
  fallbackLabel: string,
  caseNumber: string | null,
): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);

  if (pathname.startsWith("/casos")) {
    if (pathname === "/casos") return [{ label: "Casos" }];
    if (pathname === "/casos/nuevo") {
      return [{ label: "Casos", href: "/casos" }, { label: "Nuevo caso" }];
    }
    return [
      { label: "Casos", href: "/casos" },
      { label: caseNumber || "Detalle de caso" },
    ];
  }
  if (pathname.startsWith("/configuracion")) {
    const sectionLabels: Record<string, string> = {
      ia: "Gobierno IA",
      macros: "Macros",
      "layout-builder": "Layout Builder",
      "layout-detalle-caso": "Layout detalle caso",
      "conocimiento-ia": "Conocimiento IA",
      "mensajes-rapidos": "Mensajes rápidos",
      objetos: "Objetos",
      permisos: "Permisos",
      usuarios: "Usuarios",
      "templates-correo": "Templates de correo",
    };
    const breadcrumbs: BreadcrumbItem[] = [
      { label: "Configuración", href: pathname === "/configuracion" ? undefined : "/configuracion" },
    ];
    if (segments[1]) {
      breadcrumbs.push({
        label: sectionLabels[segments[1]] || segments[1],
        href: segments.length > 2 ? `/configuracion/${segments[1]}` : undefined,
      });
    }
    if (segments.length > 2) {
      breadcrumbs.push({
        label: segments[2] === "nueva" ? "Nueva" : "Detalle",
      });
    }
    return breadcrumbs;
  }
  if (pathname.startsWith("/dashboards")) {
    return pathname === "/dashboards"
      ? [{ label: "Dashboards" }]
      : [{ label: "Dashboards", href: "/dashboards" }, { label: "Dashboard" }];
  }
  if (pathname.startsWith("/cuentas") || pathname.startsWith("/clientes")) {
    return segments.length === 1
      ? [{ label: "Cuentas" }]
      : [{ label: "Cuentas", href: "/cuentas" }, { label: "Cliente" }];
  }
  if (pathname === "/mi-perfil") {
    return [{ label: "Mi perfil" }];
  }
  if (pathname === "/comunicaciones") {
    return [{ label: "Comunicaciones" }];
  }

  return [{ label: fallbackLabel }];
}

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isChecking, authEnabled } = useCrmSession();
  const { permissions: rolePermissions } = useCrmPermissions();
  const [notificationCount, setNotificationCount] = useState(0);
  const [caseBreadcrumbNumber, setCaseBreadcrumbNumber] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const agentId = user?.id ?? "";
  const agentName = user?.name ?? "Agente";
  const agentRole = user?.role ?? "AGENT";
  const isCaseExpediente =
    pathname.startsWith("/casos/") && pathname !== "/casos/nuevo";
  const isCasesList = pathname === "/casos";
  const hasGlobalSidebar = true;
  const isDashboard = pathname === "/dashboard";
  const isCaseObjectManager = pathname === "/configuracion/objetos/caso";
  const isCasesConsole = isCaseExpediente;
  const isAccount360 = pathname.startsWith("/cuentas/");
  const isSidebarCompact = sidebarCollapsed;
  const visibleNavigationItems = getNavigationItems(agentRole, rolePermissions);
  const activeItem =
    [...visibleNavigationItems]
      .sort((left, right) => right.href.length - left.href.length)
      .find((item) => isNavigationItemActive(pathname, item.href)) ??
    visibleNavigationItems[0] ??
    getNavigationItems("AGENT", rolePermissions)[0];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedPreference = window.localStorage.getItem("crmSidebarCollapsed");
      setSidebarCollapsed(
        storedPreference === null
          ? isCaseExpediente || isAccount360
          : storedPreference === "true",
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isAccount360, isCaseExpediente]);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("crmSidebarCollapsed", String(next));
      return next;
    });
  }

  async function logoutDemoUser(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    clearDemoCrmSession();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    if (!isCaseExpediente) return;

    function handleCaseHeaderContext(event: Event) {
      const detail = (event as CustomEvent<{ caseNumber?: string }>).detail;
      setCaseBreadcrumbNumber(detail?.caseNumber || null);
    }

    window.addEventListener("case-header-context", handleCaseHeaderContext);
    window.dispatchEvent(new Event("request-case-header-context"));

    return () => {
      window.removeEventListener("case-header-context", handleCaseHeaderContext);
    };
  }, [isCaseExpediente]);

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

  const breadcrumbs = getBreadcrumbs(pathname, activeItem.label, caseBreadcrumbNumber);
  const ActiveNavigationIcon =
    navigationIconByHref[activeItem.href] ?? BriefcaseBusiness;

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
                const isActive = isNavigationItemActive(pathname, item.href);
                const Icon = navigationIconByHref[item.href] ?? BriefcaseBusiness;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex h-10 items-center gap-3 rounded-[var(--g66-radius-md)] px-3 text-sm font-bold transition ${
                      isActive
                        ? "bg-[var(--g66-brand-blue)] text-white shadow-[0_10px_22px_rgb(var(--crm-primary-rgb)/0.18)]"
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

            <Link
              href="/mi-perfil"
              className={`mt-auto rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-[var(--g66-surface-soft)] ${
                isSidebarCompact ? "p-2" : "p-3"
              } transition hover:border-[var(--g66-secondary-interactive)] hover:bg-[var(--g66-brand-blue-soft)]`}
              title="Mi perfil"
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
                    {agentName}
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold text-[var(--g66-text-secondary)]">
                    {agentRole} · Mi perfil
                  </p>
                </div>
              </div>
            </Link>
            <div className="mt-2">
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className={`flex h-8 w-full items-center justify-center rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white text-xs font-black text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-secondary-interactive)] hover:text-[var(--g66-secondary-interactive)] ${
                  isSidebarCompact ? "px-0" : "px-3"
                }`}
                title={sidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
              >
                {isSidebarCompact ? (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <>
                    <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                    Colapsar
                  </>
                )}
              </button>
            </div>
          </aside>
        ) : null}

        <header
          className={`${caseDetailManrope.variable} ${caseDetailMono.variable} ${originalStyles.caseTopBar} fixed right-0 top-0 z-40 grid items-center border-b border-[var(--g66-border)] bg-[var(--g66-surface)] shadow-sm ${
            hasGlobalSidebar ? (isSidebarCompact ? "left-16" : "left-60") : "left-0"
          }`}
        >
          <nav
            aria-label="Breadcrumb"
            className={`${originalStyles.topBreadcrumb} flex min-w-0 items-center`}
          >
            <ActiveNavigationIcon
              className="h-3.5 w-3.5 shrink-0 text-[var(--g66-text-muted)]"
              aria-hidden="true"
            />
            {breadcrumbs.map((breadcrumb, index) => (
              <span key={`${breadcrumb.label}-${index}`} className="contents">
                {index > 0 ? (
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-[var(--g66-text-muted)]"
                    aria-hidden="true"
                  />
                ) : null}
                {breadcrumb.href ? (
                  <Link
                    href={breadcrumb.href}
                    className="truncate text-[var(--g66-text-muted)] transition hover:text-[var(--g66-brand-blue)]"
                  >
                    {breadcrumb.label}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-[var(--g66-text-primary)]">
                    {breadcrumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>

          <div className="flex justify-center px-4">
            <GlobalSearch className="max-w-[520px]" />
          </div>

          <div className={`${originalStyles.topActions} flex min-w-0 items-center justify-end`}>
            {agentId ? (
              <NotificationBell key={agentId} currentUserId={agentId} />
            ) : null}
            {!isCaseExpediente && notificationCount > 0 ? (
              <Link
                href="/casos"
                className="hidden rounded-full bg-[var(--g66-danger-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--g66-danger)] 2xl:inline-flex"
              >
                WhatsApp: {notificationCount}
              </Link>
            ) : null}
            {agentId ? (
              <div className={`${originalStyles.availability} inline-flex items-center bg-white`}>
                <span className="h-2 w-2 rounded-full bg-[var(--g66-success)]" aria-hidden="true" />
                <DemoAvailabilitySelect userId={agentId} compact showLabel={false} bare />
              </div>
            ) : null}
            {!isChecking && !authEnabled ? (
              <Link
                href="/login"
                onClick={logoutDemoUser}
                className={`${originalStyles.changeUser} whitespace-nowrap text-[var(--g66-brand-blue)] hover:text-[var(--g66-secondary-interactive)] hover:underline`}
              >
                Cambiar usuario
              </Link>
            ) : null}
            <span className="h-8 w-px bg-[var(--g66-border)]" aria-hidden="true" />
            <div className={`${originalStyles.currentUser} flex min-w-0 items-center`}>
              <span className={`${originalStyles.currentUserAvatar} flex shrink-0 items-center justify-center bg-[var(--g66-brand-blue)] text-white`}>
                {agentName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className={`${originalStyles.currentUserName} truncate text-[var(--g66-text-primary)]`}>{agentName}</p>
                <p className={`${originalStyles.currentUserRole} truncate uppercase`}>
                  {[agentRole, user?.team || user?.area].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main
          className={
            hasGlobalSidebar
              ? isSidebarCompact
                ? `pl-16 pt-[58px] ${isCasesConsole ? "h-screen overflow-hidden" : ""}`
                : `pl-60 pt-[58px] ${isCasesConsole ? "h-screen overflow-hidden" : ""}`
              : `pt-[58px] ${isCasesConsole ? "h-screen overflow-hidden" : ""}`
          }
        >
          <div
            className={
              isCasesConsole
                ? "h-[calc(100vh-58px)] min-h-0 w-full overflow-hidden bg-white"
                : isCasesList
                  ? "min-h-[calc(100vh-58px)] w-full bg-[#F4F6FA]"
                : isDashboard
                  ? "min-h-[calc(100vh-58px)] w-full overflow-hidden bg-[var(--g66-background)]"
                : isAccount360
                  ? "flex min-h-[calc(100vh-58px)] w-full flex-col gap-3 bg-[#f5f7fb] px-3 py-3 xl:px-4"
                : isCaseObjectManager
                  ? "flex min-h-[calc(100vh-58px)] w-full flex-col gap-4 bg-[var(--g66-background)] px-3 py-4 xl:px-4"
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
