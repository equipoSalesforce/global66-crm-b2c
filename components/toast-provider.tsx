"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  success: (message?: string) => void;
  error: (message?: string) => void;
  info: (message?: string) => void;
};

const defaultMessages: Record<ToastType, string> = {
  success: "✓ Cambios guardados correctamente",
  error: "✗ No se pudieron guardar los cambios",
  info: "ℹ Acción completada",
};

const toastStyles: Record<ToastType, string> = {
  success: "border-[var(--g66-success-soft)] bg-[var(--g66-success-soft)] text-[var(--g66-success)]",
  error: "border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]",
  info: "border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]",
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== id),
    );
  }, []);

  const showToast = useCallback((type: ToastType, message?: string) => {
    const id = Date.now() + Math.random();

    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id,
        type,
        message: message ?? defaultMessages[type],
      },
    ]);
  }, []);

  const value = useMemo(
    () => ({
      success: (message?: string) => showToast("success", message),
      error: (message?: string) => showToast("error", message),
      info: (message?: string) => showToast("info", message),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: (id: number) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const showTimer = window.setTimeout(() => setIsVisible(true), 10);
    const hideTimer = window.setTimeout(() => setIsVisible(false), 2700);
    const removeTimer = window.setTimeout(() => onClose(toast.id), 3000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [onClose, toast.id]);

  return (
    <div
      className={`pointer-events-auto flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ease-out ${
        toastStyles[toast.type]
      } ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "-translate-y-2 opacity-0"
      }`}
      role="status"
    >
      <p className="leading-6">{toast.message}</p>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="rounded-md px-1 text-lg leading-6 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
        aria-label="Cerrar notificación"
      >
        ×
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast debe usarse dentro de ToastProvider.");
  }

  return context;
}
