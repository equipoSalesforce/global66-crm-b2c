"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CaseAssignmentNotification,
  CaseAssignmentNotificationsResponse,
} from "@/lib/case-assignment-notifications";

function formatNotificationDate(value: string) {
  const date = new Date(value);
  const elapsedSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (Number.isNaN(date.getTime())) return "Fecha desconocida";
  if (elapsedSeconds < 60) return "Ahora";
  if (elapsedSeconds < 3600) return `Hace ${Math.floor(elapsedSeconds / 60)} min`;
  if (elapsedSeconds < 86400) return `Hace ${Math.floor(elapsedSeconds / 3600)} h`;

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function NotificationBell({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<
    CaseAssignmentNotification[]
  >([]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = (await response.json()) as
        | CaseAssignmentNotificationsResponse
        | { error?: string };

      if (!response.ok || !("notifications" in payload)) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "No se pudieron cargar las notificaciones.",
        );
      }

      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las notificaciones.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadNotifications(), 0);
    const intervalId = window.setInterval(loadNotifications, 60000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [currentUserId, loadNotifications]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  async function toggleDropdown() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) await loadNotifications();
  }

  async function openNotification(notification: CaseAssignmentNotification) {
    if (!notification.isRead) {
      try {
        const response = await fetch(
          `/api/notifications/${encodeURIComponent(notification.id)}/read`,
          { method: "PATCH" },
        );

        if (response.ok) {
          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id ? { ...item, isRead: true } : item,
            ),
          );
          setUnreadCount((current) => Math.max(0, current - 1));
        }
      } catch (readError) {
        console.error("[notification-bell] Error marking notification read", readError);
      }
    }

    setIsOpen(false);
    router.push(`/casos/${notification.caseId}`);
  }

  async function markAllRead() {
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("No se pudieron marcar las notificaciones.");
      }

      setNotifications((current) =>
        current.map((notification) => ({ ...notification, isRead: true })),
      );
      setUnreadCount(0);
      setError("");
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "No se pudieron marcar las notificaciones.",
      );
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        className="relative grid h-8 w-8 place-items-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
        aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} no leídas` : ""}`}
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-[var(--g66-danger)] px-1 text-center text-[9px] font-black leading-4 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <section className="absolute right-0 top-10 z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-soft)]">
          <header className="flex items-center justify-between border-b border-[var(--g66-border)] px-4 py-3">
            <div>
              <h2 className="text-sm font-black text-[var(--g66-text-primary)]">
                Notificaciones
              </h2>
              <p className="mt-0.5 text-[10px] font-semibold text-[var(--g66-text-muted)]">
                {unreadCount} sin leer
              </p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-bold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas como leídas
            </button>
          </header>

          {error ? (
            <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
              {error}
            </p>
          ) : null}

          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-8 text-center text-xs font-semibold text-[var(--g66-text-muted)]">
                Cargando notificaciones...
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm font-semibold text-[var(--g66-text-muted)]">
                No tienes notificaciones.
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={`block w-full border-b border-[var(--g66-border)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[var(--g66-brand-blue-soft)] ${
                    notification.isRead ? "bg-white" : "bg-[#F4F7FF]"
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        notification.isRead
                          ? "bg-slate-200"
                          : "bg-[var(--g66-brand-blue)]"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-xs font-black text-[var(--g66-text-primary)]">
                          {notification.title}
                        </span>
                        <span className="shrink-0 text-[9px] font-semibold text-[var(--g66-text-muted)]">
                          {formatNotificationDate(notification.createdAt)}
                        </span>
                      </span>
                      <span className="mt-1 block text-[11px] leading-4 text-[var(--g66-text-secondary)]">
                        {notification.message}
                      </span>
                      <span className="mt-1.5 block text-[10px] font-bold text-[var(--g66-brand-blue)]">
                        Caso #{notification.caseNumber ?? notification.caseId.slice(-6)} · Abrir caso
                      </span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
