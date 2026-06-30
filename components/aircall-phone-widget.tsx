"use client";

import { getAircallDialErrorMessage } from "@/lib/aircall";
import { Phone, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "./toast-provider";

type AircallDialRequest = {
  phoneNumber: string;
  pendingContextId?: string;
};

type AircallSettings = {
  user?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    company_name?: string;
  };
};

const workspaceEvents = [
  "incoming_call",
  "call_end_ringtone",
  "outgoing_call",
  "outgoing_answered",
  "call_ended",
  "comment_saved",
  "external_dial",
  "powerdialer_updated",
];

export function AircallPhoneWidget() {
  const toast = useToast();
  const workspaceRef = useRef<import("aircall-everywhere").default | null>(null);
  const isWorkspaceReadyRef = useRef(false);
  const pendingDialRef = useRef<AircallDialRequest | null>(null);
  const eventListenersRef = useRef<
    { eventName: string; callback: (payload: unknown) => void }[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRenderPanel, setShouldRenderPanel] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);
  const [isDialing, setIsDialing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loginUser, setLoginUser] = useState("");
  const [lastPhoneNumber, setLastPhoneNumber] = useState("");

  const sendDialNumber = useCallback(
    (request: AircallDialRequest) => {
      const workspace = workspaceRef.current;

      if (!workspace || !isWorkspaceReadyRef.current) {
        pendingDialRef.current = request;
        setShouldRenderPanel(true);
        setIsOpen(true);
        toast.info("Inicia sesión en Aircall para llamar.");
        return;
      }

      setIsDialing(true);
      workspace.send(
        "dial_number",
        { phone_number: request.phoneNumber },
        (success, data) => {
          setIsDialing(false);
          console.info("[aircall-widget] dial_number result", {
            success,
            data,
            phoneNumber: request.phoneNumber,
            pendingContextId: request.pendingContextId,
          });

          if (success) {
            pendingDialRef.current = null;
            toast.success("Llamada enviada a Aircall");
            return;
          }

          toast.error(getAircallDialErrorMessage(data));
        },
      );
    },
    [toast],
  );
  const sendDialNumberRef = useRef(sendDialNumber);

  useEffect(() => {
    sendDialNumberRef.current = sendDialNumber;
  }, [sendDialNumber]);

  const openPanel = useCallback(() => {
    setShouldRenderPanel(true);
    setIsOpen(true);
  }, []);

  const requestDial = useCallback(
    (request: AircallDialRequest) => {
      pendingDialRef.current = request;
      setLastPhoneNumber(request.phoneNumber);
      openPanel();

      if (!isWorkspaceReadyRef.current) {
        toast.info("Inicia sesión en Aircall para llamar.");
        return;
      }

      sendDialNumber(request);
    },
    [openPanel, sendDialNumber, toast],
  );

  useEffect(() => {
    if (!shouldRenderPanel || workspaceRef.current) return;

    let isMounted = true;
    const initializeTimeout = window.setTimeout(() => {
      void initializeWorkspace();
    }, 0);

    async function initializeWorkspace() {
      try {
        const container = document.querySelector("#aircall-workspace");

        if (!container) {
          if (!isMounted) return;
          setLoadError("No se pudo cargar Aircall. Reabre el panel.");
          console.error("[aircall-widget] #aircall-workspace not found");
          return;
        }

        const aircallModule = await import("aircall-everywhere");
        if (!isMounted || workspaceRef.current) return;

        const workspace = new aircallModule.default({
          domToLoadWorkspace: "#aircall-workspace",
          onLogin: (settings: unknown) => {
            const aircallSettings = settings as AircallSettings;
            const firstName = aircallSettings.user?.first_name ?? "";
            const lastName = aircallSettings.user?.last_name ?? "";
            const email = aircallSettings.user?.email ?? "";

            isWorkspaceReadyRef.current = true;
            setIsLoaded(true);
            setIsWorkspaceReady(true);
            setLoadError("");
            setLoginUser([firstName, lastName].filter(Boolean).join(" ") || email);
            console.info("[aircall-widget] logged in", aircallSettings.user);

            if (pendingDialRef.current) {
              const pendingDial = pendingDialRef.current;
              window.setTimeout(() => sendDialNumberRef.current(pendingDial), 150);
            }
          },
          onLogout: () => {
            isWorkspaceReadyRef.current = false;
            setIsWorkspaceReady(false);
            setLoginUser("");
            console.info("[aircall-widget] logged out");
          },
          size: "big",
          debug: process.env.NODE_ENV !== "production",
        });

        workspaceRef.current = workspace;
        setIsLoaded(true);

        workspaceEvents.forEach((eventName) => {
          const callback = (payload: unknown) => {
            console.info("[aircall-widget] event", { eventName, payload });
          };
          workspace.on(eventName, callback);
          eventListenersRef.current.push({ eventName, callback });
        });
      } catch (error) {
        console.error("[aircall-widget] load error", error);
        setLoadError("No se pudo cargar Aircall. Reabre el panel.");
        toast.error("Aircall no cargó correctamente.");
      }
    }

    return () => {
      isMounted = false;
      window.clearTimeout(initializeTimeout);
    };
  }, [shouldRenderPanel, toast]);

  useEffect(() => {
    return () => {
      const workspace = workspaceRef.current;
      if (!workspace) return;

      eventListenersRef.current.forEach(({ eventName, callback }) => {
        workspace.removeListener(eventName, callback);
      });
      eventListenersRef.current = [];
      workspaceRef.current = null;
      isWorkspaceReadyRef.current = false;
    };
  }, []);

  useEffect(() => {
    function handleDialRequest(event: Event) {
      if (!(event instanceof CustomEvent)) return;

      const detail = event.detail as AircallDialRequest | undefined;
      if (!detail?.phoneNumber) return;

      requestDial(detail);
    }

    window.addEventListener("aircall-dial-request", handleDialRequest);

    return () => {
      window.removeEventListener("aircall-dial-request", handleDialRequest);
    };
  }, [requestDial]);

  const statusLabel = isWorkspaceReady
    ? loginUser || "Sesión Aircall activa"
    : loadError || (isLoaded ? "Debes iniciar sesión en Aircall" : "Aircall no cargado");

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50">
      {shouldRenderPanel ? (
        <section
          className={`pointer-events-auto fixed bottom-5 right-3 top-20 w-[calc(100vw-24px)] max-w-[376px] flex-col rounded-[var(--g66-radius-xl)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-soft)] sm:right-5 sm:w-[376px] ${
            isOpen ? "flex" : "hidden"
          }`}
        >
          <header className="flex h-11 items-center justify-between border-b border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] px-3">
            <div>
              <p className="text-xs font-black text-[var(--g66-text-primary)]">
                Aircall
              </p>
              <p className="text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                {statusLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)]"
              aria-label="Cerrar Aircall"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            <div id="aircall-workspace" className="h-full min-h-[640px] w-full" />
          </div>
          {lastPhoneNumber ? (
            <footer className="border-t border-[var(--g66-border-soft)] px-3 py-2 text-[11px] font-semibold text-[var(--g66-text-secondary)]">
              {isDialing ? "Marcando " : "Último número: "}
              {lastPhoneNumber}
            </footer>
          ) : null}
        </section>
      ) : null}

      <div className="pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
              return;
            }

            openPanel();
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--g66-brand-blue)] text-white shadow-[var(--g66-shadow-soft)] transition hover:bg-[var(--g66-brand-blue-hover)]"
          aria-label="Abrir Aircall"
          title="Abrir Aircall"
        >
          <Phone className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
