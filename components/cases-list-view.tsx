"use client";

import {
  formatCaseNumber,
  normalizeLifecycleStatus,
  normalizeRoutingStatus,
} from "@/lib/case-status";
import { computeCaseSla, type CaseNotificationStatus } from "@/lib/case-sla";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  Columns3,
  Filter,
  ListFilter,
  Mail,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  ConsoleAgentRecord,
  ConsoleCaseRecord,
  ConsoleMessageRecord,
} from "./cases-console";

type CaseListViewKey =
  | "all"
  | "mine"
  | "open"
  | "unassigned"
  | "email"
  | "whatsapp"
  | "attachments"
  | "pending_today"
  | "sla_risk"
  | "attention_queue"
  | "new";

type CasesListViewProps = {
  cases: ConsoleCaseRecord[];
  messages: ConsoleMessageRecord[];
  agents: ConsoleAgentRecord[];
  attachmentCounts: Record<string, number>;
};

const caseViews: { key: CaseListViewKey; label: string }[] = [
  { key: "all", label: "Todos los casos" },
  { key: "mine", label: "Mis casos" },
  { key: "open", label: "Casos abiertos" },
  { key: "unassigned", label: "Casos sin asignar" },
  { key: "email", label: "Casos email" },
  { key: "whatsapp", label: "Casos WhatsApp" },
  { key: "attachments", label: "Casos con adjuntos" },
  { key: "pending_today", label: "Pendientes hoy" },
  { key: "sla_risk", label: "SLA en riesgo" },
  { key: "attention_queue", label: "Cola de atención" },
  { key: "new", label: "Nuevos recientes" },
];

function formatDateTime(date: string | null | undefined) {
  if (!date) return "Sin fecha";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

function getCustomerLabel(caseItem: ConsoleCaseRecord) {
  return (
    caseItem.customer?.name ||
    caseItem.contact_name ||
    caseItem.customer?.email ||
    caseItem.contact_email ||
    caseItem.customer?.phone ||
    caseItem.contact_phone ||
    "Cliente no relacionado"
  );
}

function getAgentLabel(
  caseItem: ConsoleCaseRecord,
  agentNames: Map<string, string>,
) {
  if (caseItem.assigned_agent_id) {
    return agentNames.get(caseItem.assigned_agent_id) || caseItem.assigned_to || "Sin agente";
  }

  return caseItem.assigned_to || "Sin agente";
}

function getLastActivity(
  caseItem: ConsoleCaseRecord,
  latestMessage: ConsoleMessageRecord | undefined,
) {
  return latestMessage?.created_at || caseItem.updated_at || caseItem.created_at;
}

function getMessagePreview(message: ConsoleMessageRecord | undefined) {
  return (
    message?.email_subject ||
    message?.email_text_body ||
    message?.body ||
    ""
  );
}

function statusBadgeClass(status: string) {
  if (status === "NEW") return "bg-[var(--g66-warning-soft)] text-[#B77900]";
  if (status === "IN_PROGRESS") return "bg-[#E8F3FF] text-[var(--g66-brand-blue)]";
  if (status === "CLOSED") return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
  if (status === "STAND_BY") return "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]";
  if (status === "RESOLVED") return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";

  return "bg-[var(--g66-background-soft)] text-[var(--g66-text-secondary)]";
}

function priorityBadgeClass(priority: string | null | undefined) {
  const normalizedPriority = priority?.toUpperCase();

  if (normalizedPriority === "HIGH" || normalizedPriority === "URGENT") {
    return "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]";
  }

  if (normalizedPriority === "MEDIUM") {
    return "bg-[var(--g66-warning-soft)] text-[#B77900]";
  }

  if (normalizedPriority === "LOW") {
    return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
  }

  return "bg-[var(--g66-background-soft)] text-[var(--g66-text-secondary)]";
}

function priorityLabel(priority: string | null | undefined) {
  const normalizedPriority = priority?.toUpperCase();

  if (normalizedPriority === "HIGH") return "Alta";
  if (normalizedPriority === "URGENT") return "Urgente";
  if (normalizedPriority === "MEDIUM") return "Media";
  if (normalizedPriority === "LOW") return "Baja";

  return priority || "Sin prioridad";
}

function channelBadgeClass(channel: string | null | undefined) {
  if (channel === "WHATSAPP") {
    return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
  }

  if (channel === "GMAIL" || channel === "EMAIL") {
    return "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]";
  }

  return "bg-[var(--g66-background-soft)] text-[var(--g66-text-secondary)]";
}

function responseBadgeClass(status: CaseNotificationStatus) {
  if (status === "RED") return "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]";
  if (status === "BLUE") return "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]";
  if (status === "NEUTRAL") return "bg-[var(--g66-background)] text-[var(--g66-text-secondary)]";

  return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
}

function uniqueValues(
  cases: ConsoleCaseRecord[],
  key: keyof Pick<
    ConsoleCaseRecord,
    "priority" | "channel" | "lifecycle_status" | "status"
  >,
) {
  return Array.from(
    new Set(
      cases
        .map((caseItem) =>
          key === "lifecycle_status"
            ? normalizeLifecycleStatus(caseItem.lifecycle_status, caseItem.status)
            : caseItem[key],
        )
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort();
}

export function CasesListView({
  cases,
  messages,
  agents,
  attachmentCounts,
}: CasesListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedView, setSelectedView] = useState<CaseListViewKey>(() => {
    const viewParam = searchParams.get("view");
    const statusParam = searchParams.get("status");

    if (statusParam === "open") return "open";
    if (viewParam === "my_cases") return "mine";
    if (
      viewParam === "pending_today" ||
      viewParam === "sla_risk" ||
      viewParam === "attention_queue" ||
      viewParam === "new" ||
      viewParam === "open" ||
      viewParam === "all" ||
      viewParam === "unassigned" ||
      viewParam === "email" ||
      viewParam === "whatsapp" ||
      viewParam === "attachments"
    ) {
      return viewParam;
    }

    return "all";
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState(() =>
    searchParams.get("channel")?.toUpperCase() ?? "",
  );
  const [agentFilter, setAgentFilter] = useState("");
  const [attachmentsOnly, setAttachmentsOnly] = useState(false);
  const [agentSession] = useState(() => {
    if (typeof window === "undefined") return { id: "" };

    return { id: window.localStorage.getItem("agentId") ?? "" };
  });

  useEffect(() => {
    function handleGlobalSearch(event: Event) {
      const customEvent = event as CustomEvent<string>;
      setQuery(customEvent.detail ?? "");
    }

    window.addEventListener("cases-global-search", handleGlobalSearch);

    return () => {
      window.removeEventListener("cases-global-search", handleGlobalSearch);
    };
  }, []);

  useEffect(() => {
    let refreshTimeout: number | null = null;

    function refreshCases() {
      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
      }

      refreshTimeout = window.setTimeout(() => {
        router.refresh();
        refreshTimeout = null;
      }, 250);
    }

    console.info("[realtime] subscribed", {
      scope: "cases-list",
      channel: "cases-list",
    });

    const casesChannel = supabaseBrowser
      .channel("cases-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cases",
        },
        (payload) => {
          console.info("[realtime] cases list changed", {
            eventType: payload.eventType,
          });
          refreshCases();
        },
      )
      .subscribe((status) => {
        console.info("[realtime] cases list subscription status", status);
        if (status === "SUBSCRIBED") {
          console.info("[realtime] status SUBSCRIBED", {
            scope: "cases-list",
            channel: "cases-list",
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[realtime] cases list subscription error", {
            status,
            channel: "cases-list",
          });
        }
      });
    const fallbackIntervalId = window.setInterval(() => {
      router.refresh();
    }, 60000);

    return () => {
      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
      }
      window.clearInterval(fallbackIntervalId);
      void supabaseBrowser.removeChannel(casesChannel);
      console.info("[realtime] unsubscribed", {
        scope: "cases-list",
      });
    };
  }, [router]);

  const agentNames = useMemo(
    () =>
      new Map(
        agents.map((agent) => [
          agent.id,
          agent.name ?? agent.email ?? agent.id,
        ]),
      ),
    [agents],
  );

  const latestMessageByCase = useMemo(() => {
    const latestMessages = new Map<string, ConsoleMessageRecord>();

    messages.forEach((message) => {
      if (!message.case_id) return;

      const caseId = String(message.case_id);
      const current = latestMessages.get(caseId);
      const currentTime = current?.created_at
        ? new Date(current.created_at).getTime()
        : 0;
      const messageTime = message.created_at
        ? new Date(message.created_at).getTime()
        : 0;

      if (!current || messageTime >= currentTime) {
        latestMessages.set(caseId, message);
      }
    });

    return latestMessages;
  }, [messages]);

  const messagesByCase = useMemo(() => {
    const groupedMessages = new Map<string, ConsoleMessageRecord[]>();

    messages.forEach((message) => {
      if (!message.case_id) return;

      const caseId = String(message.case_id);
      const currentMessages = groupedMessages.get(caseId) ?? [];
      currentMessages.push(message);
      groupedMessages.set(caseId, currentMessages);
    });

    return groupedMessages;
  }, [messages]);

  const filteredCases = cases
    .filter((caseItem) => {
      const lifecycleStatus = normalizeLifecycleStatus(
        caseItem.lifecycle_status,
        caseItem.status,
      );
      const routingStatus = normalizeRoutingStatus({
        routingStatus: caseItem.routing_status,
        status: caseItem.status,
        assignedAgentId: caseItem.assigned_agent_id,
      });
      const attachmentCount = attachmentCounts[caseItem.id] ?? 0;
      const caseMessages = messagesByCase.get(caseItem.id) ?? [];
      const caseSla = computeCaseSla(caseItem, caseMessages);
      const updatedAt = caseItem.updated_at
        ? new Date(caseItem.updated_at).getTime()
        : 0;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      if (
        selectedView === "mine" &&
        (caseItem.assigned_agent_id !== agentSession.id ||
          lifecycleStatus === "CLOSED")
      ) {
        return false;
      }
      if (selectedView === "open" && lifecycleStatus === "CLOSED") return false;
      if (
        selectedView === "pending_today" &&
        (lifecycleStatus === "CLOSED" ||
          updatedAt < todayStart.getTime() ||
          (routingStatus !== "HUMAN_REQUIRED" && caseItem.assigned_agent_id))
      ) {
        return false;
      }
      if (
        selectedView === "sla_risk" &&
        caseSla.notificationStatus !== "RED" &&
        caseSla.notificationStatus !== "BLUE"
      ) {
        return false;
      }
      if (
        selectedView === "attention_queue" &&
        (lifecycleStatus === "CLOSED" ||
          (routingStatus !== "HUMAN_REQUIRED" &&
            caseItem.assigned_agent_id &&
            !["HIGH", "URGENT"].includes((caseItem.priority || "").toUpperCase())))
      ) {
        return false;
      }
      if (
        selectedView === "new" &&
        lifecycleStatus !== "NEW" &&
        updatedAt < todayStart.getTime()
      ) {
        return false;
      }
      if (
        selectedView === "unassigned" &&
        routingStatus !== "UNASSIGNED" &&
        caseItem.assigned_agent_id
      ) {
        return false;
      }
      if (selectedView === "email" && caseItem.channel !== "GMAIL") return false;
      if (selectedView === "whatsapp" && caseItem.channel !== "WHATSAPP") {
        return false;
      }
      if (selectedView === "attachments" && attachmentCount <= 0) return false;
      if (attachmentsOnly && attachmentCount <= 0) return false;
      if (statusFilter && lifecycleStatus !== statusFilter) return false;
      if (priorityFilter && caseItem.priority !== priorityFilter) return false;
      if (channelFilter && caseItem.channel !== channelFilter) return false;
      if (agentFilter && caseItem.assigned_agent_id !== agentFilter) return false;

      const latestMessage = latestMessageByCase.get(caseItem.id);
      const searchableText = [
        caseItem.case_number,
        caseItem.subject,
        getCustomerLabel(caseItem),
        caseItem.customer?.email,
        caseItem.customer?.phone,
        caseItem.contact_email,
        caseItem.contact_phone,
        getAgentLabel(caseItem, agentNames),
        caseItem.channel,
        caseItem.contact_type,
        getMessagePreview(latestMessage),
      ]
        .join(" ")
        .toLowerCase();

      return !query || searchableText.includes(query.toLowerCase());
    })
    .sort((caseA, caseB) => {
      const activityA = getLastActivity(caseA, latestMessageByCase.get(caseA.id));
      const activityB = getLastActivity(caseB, latestMessageByCase.get(caseB.id));

      return (
        new Date(activityB ?? 0).getTime() -
        new Date(activityA ?? 0).getTime()
      );
    });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const caseMetrics = cases.reduce(
    (metrics, caseItem) => {
      const lifecycleStatus = normalizeLifecycleStatus(
        caseItem.lifecycle_status,
        caseItem.status,
      );
      const routingStatus = normalizeRoutingStatus({
        routingStatus: caseItem.routing_status,
        status: caseItem.status,
        assignedAgentId: caseItem.assigned_agent_id,
      });
      const caseMessages = messagesByCase.get(caseItem.id) ?? [];
      const caseSla = computeCaseSla(caseItem, caseMessages);
      const updatedAt = caseItem.updated_at
        ? new Date(caseItem.updated_at).getTime()
        : 0;

      if (lifecycleStatus !== "CLOSED") metrics.open += 1;
      if (
        lifecycleStatus !== "CLOSED" &&
        updatedAt >= todayStart.getTime() &&
        (routingStatus === "HUMAN_REQUIRED" || !caseItem.assigned_agent_id)
      ) {
        metrics.pending += 1;
      }
      if (!caseItem.assigned_agent_id || routingStatus === "UNASSIGNED") {
        metrics.unassigned += 1;
      }
      if (
        caseSla.notificationStatus === "RED" ||
        caseSla.notificationStatus === "BLUE"
      ) {
        metrics.risk += 1;
      }
      if (
        (lifecycleStatus === "RESOLVED" || lifecycleStatus === "CLOSED") &&
        updatedAt >= todayStart.getTime()
      ) {
        metrics.resolvedToday += 1;
      }

      return metrics;
    },
    { open: 0, pending: 0, unassigned: 0, risk: 0, resolvedToday: 0 },
  );

  const pillViews: Array<{
    key: CaseListViewKey | "filter";
    label: string;
    icon: ReactNode;
  }> = [
    { key: "all", label: "Todos los casos", icon: <ListFilter /> },
    { key: "mine", label: "Mis casos", icon: <UserRound /> },
    { key: "open", label: "Abiertos", icon: <CheckCircle2 /> },
    { key: "whatsapp", label: "WhatsApp", icon: <MessageCircle /> },
    { key: "email", label: "Email", icon: <Mail /> },
    { key: "sla_risk", label: "En riesgo SLA", icon: <AlertTriangle /> },
    { key: "unassigned", label: "Sin asignar", icon: <CircleUserRound /> },
    { key: "filter", label: "Agregar filtro", icon: <Plus /> },
  ];

  const kpiCards = [
    {
      label: "Abiertos",
      value: caseMetrics.open,
      detail: "Casos en atención",
      icon: <MessageCircle />,
      iconClass: "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]",
    },
    {
      label: "Pendientes",
      value: caseMetrics.pending,
      detail: "Requieren acción",
      icon: <Clock3 />,
      iconClass: "bg-[var(--g66-warning-soft)] text-[var(--g66-warning)]",
    },
    {
      label: "Sin asignar",
      value: caseMetrics.unassigned,
      detail: "Disponibles para tomar",
      icon: <CircleUserRound />,
      iconClass: "bg-[var(--g66-background-soft)] text-[var(--g66-text-secondary)]",
    },
    {
      label: "En riesgo",
      value: caseMetrics.risk,
      detail: "SLA o respuesta",
      icon: <AlertTriangle />,
      iconClass: "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]",
    },
    {
      label: "Resueltos hoy",
      value: caseMetrics.resolvedToday,
      detail: "Cerrados o resueltos",
      icon: <CheckCircle2 />,
      iconClass: "bg-[var(--g66-success-soft)] text-[var(--g66-success)]",
    },
  ];

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[linear-gradient(135deg,var(--g66-background)_0%,var(--g66-background-soft)_100%)] text-[var(--g66-text-primary)]">
      <div className="min-h-0 flex-1 overflow-auto px-5 py-5 lg:px-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--g66-text-primary)]">
              Casos
            </h1>
            <p className="mt-1 text-sm font-medium text-[var(--g66-text-secondary)]">
              Gestiona la atención y prioriza tu operación diaria.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-bold text-[var(--g66-brand-blue)] shadow-[var(--g66-shadow-card)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
            >
              <Bookmark className="h-4 w-4" aria-hidden="true" />
              Guardar vista
            </button>
            <Link
              href="/casos/nuevo"
              className="inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-3 text-xs font-bold text-white shadow-[0_14px_28px_rgb(32_94_241/0.2)] transition hover:bg-[var(--g66-brand-blue-hover)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Crear caso
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {pillViews.map((view) => {
            const isActive = view.key !== "filter" && selectedView === view.key;

            return (
              <button
                key={view.key}
                type="button"
                onClick={() => {
                  if (view.key !== "filter") setSelectedView(view.key);
                }}
                className={`inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] border px-3 text-xs font-bold transition ${
                  isActive
                    ? "border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue)] text-white shadow-[0_12px_26px_rgb(32_94_241/0.18)]"
                    : "border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] shadow-[var(--g66-shadow-card)] hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
                }`}
              >
                <span className="[&_svg]:h-4 [&_svg]:w-4">{view.icon}</span>
                {view.label}
              </button>
            );
          })}
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-5">
          {kpiCards.map((card) => (
            <article
              key={card.label}
              className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-10 shrink-0 items-center justify-center rounded-full ${card.iconClass} [&_svg]:h-5 [&_svg]:w-5`}
                >
                  {card.icon}
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--g66-text-secondary)]">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-black text-[var(--g66-text-primary)]">
                    {card.value.toLocaleString("es-CL")}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--g66-success)]">
                    {card.detail}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-[var(--g66-text-primary)]">
              {filteredCases.length.toLocaleString("es-CL")} casos
            </span>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-bold text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Actualizar
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedView}
              onChange={(event) => setSelectedView(event.target.value as CaseListViewKey)}
              className="h-9 w-48 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-bold text-[var(--g66-text-primary)] outline-none transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
            >
              {caseViews.map((view) => (
                <option key={view.key} value={view.key}>
                  {view.label}
                </option>
              ))}
            </select>
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--g66-text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar casos"
                className="h-9 w-64 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white py-0 pl-9 pr-3 text-xs font-semibold text-[var(--g66-text-primary)] outline-none placeholder:text-[var(--g66-text-muted)] transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 w-36 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
            >
              <option value="">Estado</option>
              {uniqueValues(cases, "lifecycle_status").map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="h-9 w-36 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
            >
              <option value="">Prioridad</option>
              {uniqueValues(cases, "priority").map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              className="h-9 w-32 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
            >
              <option value="">Canal</option>
              {uniqueValues(cases, "channel").map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={agentFilter}
              onChange={(event) => setAgentFilter(event.target.value)}
              className="h-9 w-40 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
            >
              <option value="">Agente</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name || agent.email || agent.id}
                </option>
              ))}
            </select>
            <label className="flex h-9 shrink-0 items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-bold text-[var(--g66-brand-blue)]">
              <input
                type="checkbox"
                checked={attachmentsOnly}
                onChange={(event) => setAttachmentsOnly(event.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--g66-brand-blue)]"
              />
              Adjuntos
            </label>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-bold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
            >
              <Columns3 className="h-4 w-4" aria-hidden="true" />
              Columnas
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-bold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Más filtros
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-card)]">
          <div className="min-h-0 overflow-auto">
            <table className="w-full min-w-[1420px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--g66-surface-soft)] text-[11px] uppercase tracking-wide text-[var(--g66-text-secondary)]">
                <tr className="border-b border-[var(--g66-border)]">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" aria-label="Seleccionar todos" />
                  </th>
                  <th className="px-3 py-3">Número</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Asunto</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Respuesta</th>
                  <th className="px-3 py-3">Prioridad</th>
                  <th className="px-3 py-3">Asignado</th>
                  <th className="px-3 py-3">Apertura</th>
                  <th className="px-3 py-3">Última actividad</th>
                  <th className="px-3 py-3">Canal</th>
                  <th className="px-3 py-3">Tipo contacto</th>
                  <th className="px-3 py-3">Producto</th>
                  <th className="px-3 py-3">Adjuntos</th>
                  <th className="px-3 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--g66-border-soft)]">
            {filteredCases.map((caseItem) => {
              const lifecycleStatus = normalizeLifecycleStatus(
                caseItem.lifecycle_status,
                caseItem.status,
              );
              const latestMessage = latestMessageByCase.get(caseItem.id);
              const attachmentCount = attachmentCounts[caseItem.id] ?? 0;
              const caseMessages = messages.filter(
                (message) => String(message.case_id) === caseItem.id,
              );
              const sla = computeCaseSla(caseItem, caseMessages);

              return (
                <tr
                  key={caseItem.id}
                  className="transition hover:bg-[var(--g66-surface-soft)]"
                >
                  <td className="px-3 py-2.5">
                    <input type="checkbox" aria-label={`Seleccionar ${caseItem.id}`} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-black text-[var(--g66-brand-blue)]">
                    <Link href={`/casos/${caseItem.id}`} className="hover:underline">
                      {formatCaseNumber(caseItem.case_number, caseItem.id).replace(
                        /^Caso\s*/i,
                        "",
                      )}
                    </Link>
                  </td>
                  <td className="max-w-52 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--g66-success-soft)] text-[11px] font-black text-[var(--g66-success)]">
                        {getCustomerLabel(caseItem)
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <span className="truncate font-bold text-[var(--g66-text-primary)]">
                        {getCustomerLabel(caseItem)}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-80 truncate px-3 py-2.5 font-semibold text-[var(--g66-text-primary)]">
                    <Link
                      href={`/casos/${caseItem.id}`}
                      className="hover:text-[var(--g66-brand-blue)] hover:underline"
                    >
                      {caseItem.subject || "Caso sin asunto"}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${statusBadgeClass(lifecycleStatus)}`}
                    >
                      {lifecycleStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${responseBadgeClass(sla.notificationStatus)}`}
                    >
                      {sla.notificationStatus === "RED"
                        ? "Sin respuesta"
                        : sla.notificationLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${priorityBadgeClass(
                        caseItem.priority,
                      )}`}
                    >
                      {priorityLabel(caseItem.priority)}
                    </span>
                  </td>
                  <td className="max-w-44 truncate px-3 py-2.5 font-semibold text-[var(--g66-text-secondary)]">
                    {getAgentLabel(caseItem, agentNames)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[var(--g66-text-secondary)]">
                    {formatDateTime(caseItem.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-[var(--g66-text-secondary)]">
                    {formatDateTime(getLastActivity(caseItem, latestMessage))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${channelBadgeClass(
                        caseItem.channel,
                      )}`}
                    >
                      {caseItem.channel === "WHATSAPP" ? (
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : caseItem.channel === "GMAIL" || caseItem.channel === "EMAIL" ? (
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : null}
                      {caseItem.channel || "Sin canal"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[var(--g66-text-secondary)]">
                    {caseItem.contact_type || "Sin tipo"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[var(--g66-text-secondary)]">
                    Global66 CRM
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {attachmentCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--g66-brand-blue-soft)] px-2.5 py-1 text-[11px] font-black text-[var(--g66-brand-blue)]">
                        <Paperclip className="h-3 w-3" aria-hidden="true" />
                        {attachmentCount}
                      </span>
                    ) : (
                      <span className="text-[var(--g66-text-secondary)]">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/casos/${caseItem.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white px-3 text-xs font-black text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                      >
                        Abrir
                      </Link>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-[var(--g66-text-secondary)] hover:border-[var(--g66-border)] hover:bg-[var(--g66-surface-soft)] hover:text-[var(--g66-brand-blue)]"
                        aria-label="Más acciones"
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredCases.length === 0 ? (
              <tr>
                <td
                  colSpan={15}
                  className="px-3 py-10 text-center text-sm font-semibold text-[var(--g66-text-secondary)]"
                >
                  No hay casos para la vista o filtros actuales.
                </td>
              </tr>
            ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--g66-border-soft)] bg-white px-4 py-3 text-xs font-semibold text-[var(--g66-text-secondary)]">
            <span>
              Mostrando {filteredCases.length > 0 ? "1" : "0"} a{" "}
              {filteredCases.length.toLocaleString("es-CL")} de{" "}
              {filteredCases.length.toLocaleString("es-CL")} casos
            </span>
            <div className="flex items-center gap-2">
              <button className="h-9 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white px-3 text-[var(--g66-text-muted)]">
                ‹
              </button>
              <button className="h-9 rounded-[var(--g66-radius-sm)] bg-[var(--g66-brand-blue-soft)] px-3 font-black text-[var(--g66-brand-blue)]">
                1
              </button>
              <button className="h-9 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white px-3 text-[var(--g66-text-muted)]">
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
