"use client";

import {
  formatCaseNumber,
  normalizeLifecycleStatus,
  normalizeRoutingStatus,
} from "@/lib/case-status";
import { formatDuration } from "@/lib/case-sla";
import {
  hasPermission,
  type AgentRole,
  type Permission,
} from "@/lib/permissions";
import { useToast } from "@/components/toast-provider";
import { useCrmSession } from "@/components/use-crm-session";
import {
  Activity,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Filter,
  Gauge,
  Headphones,
  Inbox,
  Mail,
  MessageCircle,
  PlusCircle,
  Send,
  Sparkles,
  TrendingUp,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ComponentType } from "react";

type DashboardCaseRecord = {
  id: string | number | null;
  case_number: string | null;
  subject: string | null;
  status: string | null;
  lifecycle_status: string | null;
  routing_status: string | null;
  assigned_to: string | null;
  assigned_agent_id: string | null;
  assigned_at: string | null;
  priority: string | null;
  area: string | null;
  channel: string | null;
  contact_type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  first_response_at?: string | null;
  customer:
    | {
        id?: string | number | null;
        name: string | null;
        email?: string | null;
        phone?: string | null;
      }
    | null;
};

type DashboardMessageRecord = {
  id: string | number | null;
  case_id: string | number | null;
  body: string | null;
  sender_type: string | null;
  direction: string | null;
  channel: string | null;
  message_type: string | null;
  email_subject?: string | null;
  email_text_body?: string | null;
  created_at: string | null;
};

type DashboardCustomerRecord = {
  id: string | number | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
};

type DashboardAgentRecord = {
  id: string;
  name: string | null;
  email: string | null;
  role?: string | null;
  availability_status?: string | null;
};

type DashboardOperationalProps = {
  cases: DashboardCaseRecord[];
  messages: DashboardMessageRecord[];
  customers: DashboardCustomerRecord[];
  agents: DashboardAgentRecord[];
  errors: string[];
};

type FilterState = {
  dateRange: "today" | "7d" | "30d" | "all";
  channel: "all" | "WHATSAPP" | "GMAIL";
  status: "all" | "open" | "in_progress" | "human" | "closed";
  priority: "all" | "HIGH" | "MEDIUM" | "LOW";
  assignment: "all" | "mine" | "unassigned";
};

type KpiCard = {
  label: string;
  value: string;
  detail: string;
  href: string;
  tone: "blue" | "green" | "amber" | "red" | "violet";
  icon: ComponentType<{ className?: string }>;
};

const defaultFilters: FilterState = {
  dateRange: "30d",
  channel: "all",
  status: "all",
  priority: "all",
  assignment: "all",
};

function parseTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function formatRelativeTime(value: string | null | undefined) {
  const time = parseTime(value);
  if (!time) return "Sin fecha";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 60) return "Ahora";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} h`;
  return `${Math.floor(diffSeconds / 86400)} d`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dateRangeStart(range: FilterState["dateRange"]) {
  if (range === "all") return null;
  if (range === "today") return startOfToday();

  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (range === "7d" ? 6 : 29));
  return date.getTime();
}

function getCustomerLabel(caseItem: DashboardCaseRecord) {
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
  caseItem: DashboardCaseRecord,
  agents: Map<string, string>,
) {
  if (caseItem.assigned_agent_id) {
    return agents.get(String(caseItem.assigned_agent_id)) || caseItem.assigned_to || "Sin asignar";
  }

  return caseItem.assigned_to || "Sin asignar";
}

function isOpenCase(caseItem: DashboardCaseRecord) {
  return normalizeLifecycleStatus(caseItem.lifecycle_status, caseItem.status) !== "CLOSED";
}

function isWhatsappCase(caseItem: DashboardCaseRecord) {
  const channel = (caseItem.channel || caseItem.contact_type || "").toUpperCase();
  return channel === "WHATSAPP";
}

function isEmailCase(caseItem: DashboardCaseRecord) {
  const channel = (caseItem.channel || caseItem.contact_type || "").toUpperCase();
  return channel === "GMAIL" || channel === "EMAIL";
}

function getLatestMessageByCase(messages: DashboardMessageRecord[]) {
  const latest = new Map<string, DashboardMessageRecord>();

  messages.forEach((message) => {
    if (!message.case_id) return;

    const caseId = String(message.case_id);
    const current = latest.get(caseId);
    const currentTime = parseTime(current?.created_at) ?? 0;
    const nextTime = parseTime(message.created_at) ?? 0;

    if (!current || nextTime >= currentTime) {
      latest.set(caseId, message);
    }
  });

  return latest;
}

function getMessagesForCase(messages: DashboardMessageRecord[], caseId: string | number | null) {
  return messages.filter((message) => String(message.case_id) === String(caseId));
}

function getFirstAgentResponseSeconds(
  caseItem: DashboardCaseRecord,
  messages: DashboardMessageRecord[],
) {
  const start = parseTime(caseItem.assigned_at) ?? parseTime(caseItem.created_at);
  if (!start) return null;

  const firstAgent = messages
    .filter(
      (message) =>
        String(message.case_id) === String(caseItem.id) &&
        message.direction?.toUpperCase() === "OUTBOUND" &&
        message.sender_type?.toUpperCase() === "AGENT",
    )
    .map((message) => parseTime(message.created_at))
    .filter((time): time is number => time !== null && time >= start)
    .sort((left, right) => left - right)[0];

  if (!firstAgent) return null;
  return Math.floor((firstAgent - start) / 1000);
}

function isSlaRisk(caseItem: DashboardCaseRecord, messages: DashboardMessageRecord[]) {
  if (!isOpenCase(caseItem)) return false;
  if (caseItem.routing_status === "HUMAN_REQUIRED") return true;

  const firstResponse = getFirstAgentResponseSeconds(caseItem, messages);
  const start = parseTime(caseItem.assigned_at) ?? parseTime(caseItem.created_at);

  return firstResponse === null && start !== null && Date.now() - start > 15 * 60 * 1000;
}

function priorityRank(priority: string | null) {
  const normalized = priority?.toUpperCase();
  if (normalized === "URGENT") return 4;
  if (normalized === "HIGH") return 3;
  if (normalized === "MEDIUM") return 2;
  if (normalized === "LOW") return 1;
  return 0;
}

function priorityBadge(priority: string | null) {
  const normalized = priority?.toUpperCase();
  if (normalized === "URGENT" || normalized === "HIGH") {
    return { label: "ALTA", className: "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]" };
  }
  if (normalized === "MEDIUM") {
    return { label: "MEDIA", className: "bg-[var(--g66-warning-soft)] text-[var(--g66-warning-text)]" };
  }
  return { label: "BAJA", className: "bg-[var(--g66-success-soft)] text-[var(--g66-success)]" };
}

function statusBadgeClass(status: string | null) {
  if (status === "CLOSED") return "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]";
  if (status === "IN_PROGRESS" || status === "ASSIGNED") return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
  if (status === "HUMAN_REQUIRED") return "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]";
  if (status === "RESOLVED") return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
  return "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]";
}

function channelIcon(caseItem: DashboardCaseRecord) {
  if (isWhatsappCase(caseItem)) return MessageCircle;
  if (isEmailCase(caseItem)) return Mail;
  return Inbox;
}

function channelLabel(caseItem: DashboardCaseRecord) {
  if (isWhatsappCase(caseItem)) return "WhatsApp";
  if (isEmailCase(caseItem)) return "Email";
  return caseItem.channel || caseItem.contact_type || "CRM";
}

function getMessagePreview(message: DashboardMessageRecord | undefined) {
  return message?.email_subject || message?.email_text_body || message?.body || "";
}

function filterCases(
  cases: DashboardCaseRecord[],
  filters: FilterState,
  agentId: string,
) {
  const rangeStart = dateRangeStart(filters.dateRange);

  return cases.filter((caseItem) => {
    const lifecycle = normalizeLifecycleStatus(caseItem.lifecycle_status, caseItem.status);
    const routing = normalizeRoutingStatus({
      routingStatus: caseItem.routing_status,
      status: caseItem.status,
      assignedAgentId: caseItem.assigned_agent_id,
    });
    const activityTime =
      parseTime(caseItem.updated_at) ?? parseTime(caseItem.created_at) ?? 0;

    if (rangeStart !== null && activityTime < rangeStart) return false;
    if (filters.channel === "WHATSAPP" && !isWhatsappCase(caseItem)) return false;
    if (filters.channel === "GMAIL" && !isEmailCase(caseItem)) return false;
    if (filters.status === "open" && lifecycle === "CLOSED") return false;
    if (filters.status === "in_progress" && lifecycle !== "IN_PROGRESS") return false;
    if (filters.status === "human" && routing !== "HUMAN_REQUIRED") return false;
    if (filters.status === "closed" && lifecycle !== "CLOSED") return false;
    if (
      filters.priority !== "all" &&
      (filters.priority === "HIGH"
        ? !["HIGH", "URGENT"].includes((caseItem.priority || "").toUpperCase())
        : (caseItem.priority || "").toUpperCase() !== filters.priority)
    ) {
      return false;
    }
    if (filters.assignment === "mine" && caseItem.assigned_agent_id !== agentId) {
      return false;
    }
    if (
      filters.assignment === "unassigned" &&
      (caseItem.assigned_agent_id || routing !== "UNASSIGNED")
    ) {
      return false;
    }

    return true;
  });
}

function KpiCardView({ card }: { card: KpiCard }) {
  const Icon = card.icon;
  const toneClass = {
    blue: "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]",
    green: "bg-[var(--g66-success-soft)] text-[var(--g66-success)]",
    amber: "bg-[var(--g66-warning-soft)] text-[var(--g66-warning-text)]",
    red: "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]",
    violet: "bg-[var(--g66-accent-purple-soft)] text-[var(--g66-accent-purple)]",
  }[card.tone];

  return (
    <Link
      href={card.href}
      className="group rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--g66-brand-blue)] hover:shadow-[var(--g66-shadow-soft)]"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[var(--g66-text-secondary)]">
            {card.label}
          </p>
          <p className="mt-0.5 text-2xl font-black tracking-tight text-[var(--g66-text-primary)]">
            {card.value}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-[var(--g66-success)]">
            <TrendingUp className="h-3.5 w-3.5" />
            {card.detail}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function DashboardOperational({
  cases,
  messages,
  agents,
  errors,
}: DashboardOperationalProps) {
  const toast = useToast();
  const { user } = useCrmSession({ redirectInactive: false });
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isSyncingEmail, setIsSyncingEmail] = useState(false);
  const agentSession = {
    id: user?.id ?? "",
    name: user?.name ?? "Agente Demo",
    role: (user?.role ?? "AGENT") as AgentRole,
  };

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
  const filteredCases = useMemo(
    () => filterCases(cases, filters, agentSession.id),
    [agentSession.id, cases, filters],
  );
  const filteredCaseIds = useMemo(
    () => new Set(filteredCases.map((caseItem) => String(caseItem.id))),
    [filteredCases],
  );
  const filteredMessages = useMemo(
    () =>
      messages.filter(
        (message) => message.case_id && filteredCaseIds.has(String(message.case_id)),
      ),
    [filteredCaseIds, messages],
  );
  const latestMessageByCase = useMemo(
    () => getLatestMessageByCase(messages),
    [messages],
  );
  const openCases = filteredCases.filter(isOpenCase);
  const todayStart = startOfToday();
  const slaRiskCases = openCases.filter((caseItem) =>
    isSlaRisk(caseItem, getMessagesForCase(messages, caseItem.id)),
  );
  const pendingToday = openCases.filter((caseItem) => {
    const updatedAt = parseTime(caseItem.updated_at) ?? parseTime(caseItem.created_at) ?? 0;
    const routing = normalizeRoutingStatus({
      routingStatus: caseItem.routing_status,
      status: caseItem.status,
      assignedAgentId: caseItem.assigned_agent_id,
    });
    return updatedAt >= todayStart && (routing === "HUMAN_REQUIRED" || !caseItem.assigned_agent_id);
  });
  const whatsappActive = openCases.filter(isWhatsappCase);
  const emailMessagesToday = filteredMessages.filter((message) => {
    const channel = message.channel?.toUpperCase();
    const createdAt = parseTime(message.created_at) ?? 0;
    return (
      createdAt >= todayStart &&
      message.direction?.toUpperCase() === "INBOUND" &&
      (channel === "GMAIL" || channel === "EMAIL")
    );
  });
  const assignedOpenCases = openCases.filter(
    (caseItem) =>
      normalizeRoutingStatus({
        routingStatus: caseItem.routing_status,
        status: caseItem.status,
        assignedAgentId: caseItem.assigned_agent_id,
      }) === "ASSIGNED" || Boolean(caseItem.assigned_agent_id),
  );
  const resolvedToday = filteredCases.filter((caseItem) => {
    const closedAt = parseTime(caseItem.closed_at) ?? 0;
    return closedAt >= todayStart;
  });
  const avgFirstResponseSeconds = useMemo(() => {
    const values = filteredCases
      .map((caseItem) => getFirstAgentResponseSeconds(caseItem, getMessagesForCase(messages, caseItem.id)))
      .filter((value): value is number => value !== null);

    if (values.length === 0) return null;
    return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  }, [filteredCases, messages]);
  const avgResolutionSeconds = useMemo(() => {
    const values = filteredCases
      .map((caseItem) => {
        const createdAt = parseTime(caseItem.created_at);
        const closedAt = parseTime(caseItem.closed_at);
        if (!createdAt || !closedAt) return null;
        return Math.floor((closedAt - createdAt) / 1000);
      })
      .filter((value): value is number => value !== null);

    if (values.length === 0) return null;
    return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  }, [filteredCases]);
  const slaCompliance =
    openCases.length === 0
      ? null
      : Math.max(
          0,
          Math.round(((openCases.length - slaRiskCases.length) / openCases.length) * 100),
        );
  const attentionQueue = [...openCases]
    .sort((left, right) => {
      const leftRisk = slaRiskCases.some((caseItem) => caseItem.id === left.id) ? 1 : 0;
      const rightRisk = slaRiskCases.some((caseItem) => caseItem.id === right.id) ? 1 : 0;
      if (leftRisk !== rightRisk) return rightRisk - leftRisk;
      const priorityDiff = priorityRank(right.priority) - priorityRank(left.priority);
      if (priorityDiff !== 0) return priorityDiff;
      const leftTime = parseTime(left.updated_at) ?? parseTime(left.created_at) ?? 0;
      const rightTime = parseTime(right.updated_at) ?? parseTime(right.created_at) ?? 0;
      return rightTime - leftTime;
    })
    .slice(0, 7);
  const latestCases = [...filteredCases]
    .sort((left, right) => {
      const leftTime = parseTime(left.updated_at) ?? parseTime(left.created_at) ?? 0;
      const rightTime = parseTime(right.updated_at) ?? parseTime(right.created_at) ?? 0;
      return rightTime - leftTime;
    })
    .slice(0, 8);
  const activityItems = [
    ...filteredMessages.slice(0, 10).map((message) => {
      const relatedCase = cases.find(
        (caseItem) => String(caseItem.id) === String(message.case_id),
      );
      const inbound = message.direction?.toUpperCase() === "INBOUND";
      const channel = message.channel?.toUpperCase();
      const title =
        channel === "WHATSAPP"
          ? inbound
            ? "WhatsApp entrante"
            : "WhatsApp enviado"
          : channel === "GMAIL" || channel === "EMAIL"
            ? inbound
              ? "Email recibido"
              : "Email enviado"
            : message.sender_type?.toUpperCase() === "AI"
              ? "Sugerencia de IA"
              : "Actividad de conversación";
      const Icon =
        channel === "WHATSAPP" ? MessageCircle : channel === "GMAIL" || channel === "EMAIL" ? Mail : BotIcon;

      return {
        id: `message-${message.id}`,
        caseId: relatedCase?.id,
        title,
        detail:
          getMessagePreview(message).slice(0, 100) ||
          relatedCase?.subject ||
          "Actualización registrada en el caso.",
        time: message.created_at,
        icon: Icon,
      };
    }),
    ...filteredCases.slice(0, 5).map((caseItem) => ({
      id: `case-${caseItem.id}`,
      caseId: caseItem.id,
      title:
        normalizeLifecycleStatus(caseItem.lifecycle_status, caseItem.status) === "CLOSED"
          ? "Caso cerrado"
          : caseItem.assigned_agent_id
            ? "Caso asignado"
            : "Caso actualizado",
      detail: `${formatCaseNumber(caseItem.case_number, caseItem.id)} · ${
        caseItem.subject || "Sin asunto"
      }`,
      time: caseItem.updated_at || caseItem.created_at,
      icon: Activity,
    })),
  ]
    .sort((left, right) => (parseTime(right.time) ?? 0) - (parseTime(left.time) ?? 0))
    .slice(0, 7);
  const kpis: KpiCard[] = [
    {
      label: "Casos abiertos",
      value: openCases.length.toLocaleString("es-CL"),
      detail: `${filteredCases.length.toLocaleString("es-CL")} casos filtrados`,
      tone: "blue",
      icon: BriefcaseBusiness,
      href: "/casos?view=open",
    },
    {
      label: "Pendientes hoy",
      value: pendingToday.length.toLocaleString("es-CL"),
      detail: "Requieren revisión o asignación",
      tone: "amber",
      icon: Clock3,
      href: "/casos?view=pending_today",
    },
    {
      label: "SLA en riesgo",
      value: slaRiskCases.length.toLocaleString("es-CL"),
      detail: slaRiskCases.length > 0 ? `${slaRiskCases.length} críticos` : "Sin alertas críticas",
      tone: slaRiskCases.length > 0 ? "red" : "green",
      icon: Gauge,
      href: "/casos?view=sla_risk",
    },
    {
      label: "WhatsApp activos",
      value: whatsappActive.length.toLocaleString("es-CL"),
      detail: "Conversaciones abiertas",
      tone: "green",
      icon: MessageCircle,
      href: "/casos?channel=WHATSAPP&status=open",
    },
    {
      label: "Emails nuevos",
      value: emailMessagesToday.length.toLocaleString("es-CL"),
      detail: "Entrantes desde hoy",
      tone: "violet",
      icon: Mail,
      href: "/casos?channel=GMAIL&view=new",
    },
    {
      label: "Casos asignados",
      value: assignedOpenCases.length.toLocaleString("es-CL"),
      detail: "En manos de agentes",
      tone: "blue",
      icon: UsersRound,
      href: "/casos?view=my_cases",
    },
  ];
  const quickActions = [
    {
      label: "Crear caso",
      detail: "Registrar un nuevo caso manualmente",
      href: "/casos/nuevo",
      icon: PlusCircle,
      permission: "editCaseFields" as Permission,
    },
    {
      label: "Buscar cliente",
      detail: "Consultar información de clientes",
      href: "/clientes",
      icon: UserRound,
      permission: "viewCustomers" as Permission,
    },
    {
      label: "Ejecutar macro",
      detail: "Disponible dentro del expediente de caso",
      href: "/configuracion/macros",
      icon: Zap,
      permission: "respondToCustomers" as Permission,
    },
    {
      label: "Ver bandejas",
      detail: "WhatsApp, Email y pendientes",
      href: "/casos?view=attention_queue",
      icon: Headphones,
      permission: "viewCases" as Permission,
    },
  ].filter((action) => hasPermission(agentSession.role, action.permission));
  const canSyncEmail = hasPermission(agentSession.role, "respondToCustomers");

  async function syncEmail() {
    setIsSyncingEmail(true);
    try {
      const response = await fetch("/api/integrations/email/sync", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            inserted?: number;
            skipped?: number;
            errors?: string[];
          }
        | null;

      if (!response.ok || payload?.success === false) {
        const detail =
          payload?.errors?.[0] ||
          (payload ? JSON.stringify(payload) : response.statusText);
        throw new Error(detail);
      }

      toast.success(
        `Sincronización completada: ${payload?.inserted ?? 0} correos nuevos, ${
          payload?.skipped ?? 0
        } omitidos`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[dashboard-email-sync] Error sincronizando correos", {
        message,
        error,
      });
      toast.error(`Error sincronizando correos: ${message}`);
    } finally {
      setIsSyncingEmail(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-40px)] overflow-y-auto bg-[linear-gradient(135deg,var(--g66-background)_0%,var(--g66-background-soft)_100%)]">
      <div className="grid gap-4 px-4 py-5 lg:px-8">
          {errors.length > 0 ? (
            <div className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] px-3 py-2.5 text-sm font-semibold text-[var(--g66-danger)]">
              Algunos datos no pudieron cargarse: {errors.join(" · ")}
            </div>
          ) : null}

          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[var(--g66-text-primary)]">
                Panel de operación
              </h1>
              <p className="mt-1.5 text-sm font-semibold text-[var(--g66-text-secondary)]">
                Resumen en tiempo real de tu operación y actividad del equipo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFiltersOpen((current) => !current)}
                className="inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-bold text-[var(--g66-brand-blue)] shadow-[var(--g66-shadow-card)] hover:bg-[var(--g66-brand-blue-soft)]"
              >
                <Filter className="h-4 w-4" />
                Filtros
              </button>
              <Link
                href="/casos"
                className="inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-3 text-xs font-bold text-white shadow-[0_12px_24px_rgb(32_94_241/0.22)] hover:bg-[var(--g66-brand-blue-hover)]"
              >
                <BriefcaseBusiness className="h-4 w-4" />
                Ver casos
              </Link>
            </div>
          </section>

          {isFiltersOpen ? (
            <section className="grid gap-3 rounded-xl border border-[var(--g66-border)] bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
              <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
                Fecha
                <select
                  value={filters.dateRange}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      dateRange: event.target.value as FilterState["dateRange"],
                    }))
                  }
                  className="h-9 rounded-md border border-[var(--g66-border)] bg-white px-2 text-sm font-semibold normal-case text-[var(--g66-text-primary)]"
                >
                  <option value="today">Hoy</option>
                  <option value="7d">Últimos 7 días</option>
                  <option value="30d">Últimos 30 días</option>
                  <option value="all">Todo</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
                Canal
                <select
                  value={filters.channel}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      channel: event.target.value as FilterState["channel"],
                    }))
                  }
                  className="h-9 rounded-md border border-[var(--g66-border)] bg-white px-2 text-sm font-semibold normal-case text-[var(--g66-text-primary)]"
                >
                  <option value="all">Todos</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="GMAIL">Email</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
                Estado
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value as FilterState["status"],
                    }))
                  }
                  className="h-9 rounded-md border border-[var(--g66-border)] bg-white px-2 text-sm font-semibold normal-case text-[var(--g66-text-primary)]"
                >
                  <option value="all">Todos</option>
                  <option value="open">Abierto</option>
                  <option value="in_progress">En curso</option>
                  <option value="human">Requiere humano</option>
                  <option value="closed">Cerrado</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
                Prioridad
                <select
                  value={filters.priority}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      priority: event.target.value as FilterState["priority"],
                    }))
                  }
                  className="h-9 rounded-md border border-[var(--g66-border)] bg-white px-2 text-sm font-semibold normal-case text-[var(--g66-text-primary)]"
                >
                  <option value="all">Todas</option>
                  <option value="HIGH">Alta</option>
                  <option value="MEDIUM">Media</option>
                  <option value="LOW">Baja</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
                Asignación
                <select
                  value={filters.assignment}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      assignment: event.target.value as FilterState["assignment"],
                    }))
                  }
                  className="h-9 rounded-md border border-[var(--g66-border)] bg-white px-2 text-sm font-semibold normal-case text-[var(--g66-text-primary)]"
                >
                  <option value="all">Todos</option>
                  <option value="mine">Mis casos</option>
                  <option value="unassigned">Sin asignar</option>
                </select>
              </label>
            </section>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {kpis.map((card) => (
              <KpiCardView key={card.label} card={card} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[35fr_35fr_30fr]">
            <article className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-black text-[var(--g66-text-primary)]">Cola de atención</h2>
                <Link href="/casos?view=attention_queue" className="text-xs font-bold text-[var(--g66-brand-blue)] hover:underline">
                  Ver todas
                </Link>
              </div>
              <div className="grid gap-2">
                {attentionQueue.length === 0 ? (
                  <p className="rounded-lg bg-[var(--g66-background)] p-4 text-sm font-semibold text-[var(--g66-text-secondary)]">
                    No hay casos abiertos en cola con los filtros actuales.
                  </p>
                ) : (
                  attentionQueue.map((caseItem) => {
                    const badge = priorityBadge(caseItem.priority);
                    const Icon = channelIcon(caseItem);
                    const lastActivity =
                      latestMessageByCase.get(String(caseItem.id))?.created_at ||
                      caseItem.updated_at ||
                      caseItem.created_at;

                    return (
                      <Link
                        key={caseItem.id}
                        href={`/casos/${caseItem.id}`}
                        className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded-[var(--g66-radius-md)] border border-transparent px-2 py-2 transition hover:border-[var(--g66-border)] hover:bg-[var(--g66-surface-soft)]"
                      >
                        <span className={`rounded-md px-2 py-1 text-[11px] font-black ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-[var(--g66-text-primary)]">
                            {caseItem.subject || "Sin asunto"}
                          </span>
                          <span className="block truncate text-xs font-semibold text-[var(--g66-text-secondary)]">
                            {channelLabel(caseItem)} · {getCustomerLabel(caseItem)} · {getAgentLabel(caseItem, agentNames)}
                          </span>
                        </span>
                        <span className="text-xs font-bold text-[var(--g66-danger)]">
                          {formatRelativeTime(lastActivity)}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </article>

            <article className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-black text-[var(--g66-text-primary)]">
                  Actividad en tiempo real
                </h2>
                <Link href="/casos" className="text-xs font-bold text-[var(--g66-brand-blue)] hover:underline">
                  Ver todas
                </Link>
              </div>
              <div className="grid gap-3">
                {activityItems.length === 0 ? (
                  <p className="rounded-lg bg-[var(--g66-background)] p-4 text-sm font-semibold text-[var(--g66-text-secondary)]">
                    No hay actividad reciente para los filtros actuales.
                  </p>
                ) : (
                  activityItems.map((item) => {
                    const Icon = item.icon;
                    const content = (
                      <>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-[var(--g66-text-primary)]">
                            {item.title}
                          </span>
                          <span className="block truncate text-xs font-semibold text-[var(--g66-text-secondary)]">
                            {item.detail}
                          </span>
                        </span>
                        <span className="text-xs font-bold text-[var(--g66-text-secondary)]">
                          {formatRelativeTime(item.time)}
                        </span>
                      </>
                    );

                    return item.caseId ? (
                      <Link
                        key={item.id}
                        href={`/casos/${item.caseId}`}
                        className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-[var(--g66-radius-md)] px-1 py-1.5 transition hover:bg-[var(--g66-surface-soft)]"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={item.id} className="grid grid-cols-[auto_1fr_auto] gap-3 px-1 py-1">
                        {content}
                      </div>
                    );
                  })
                )}
              </div>
            </article>

            <article className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-black text-[var(--g66-text-primary)]">Rendimiento / SLA</h2>
                <Link href="/sla" className="text-xs font-bold text-[var(--g66-brand-blue)] hover:underline">
                  Ver reporte
                </Link>
              </div>
              <div className="grid gap-5 lg:grid-cols-[160px_1fr] xl:grid-cols-1 2xl:grid-cols-[170px_1fr]">
                <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--g66-radius-md)] bg-[var(--g66-surface-soft)] p-4">
                  <div
                    className="flex h-[136px] w-[136px] items-center justify-center rounded-full p-3 shadow-[inset_0_0_0_1px_var(--g66-border-soft)]"
                    style={{
                      background: `conic-gradient(var(--g66-success) ${slaCompliance ?? 0}%, var(--g66-border-soft) 0)`,
                    }}
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white shadow-[var(--g66-shadow-card)]">
                      <p className="text-4xl font-black tracking-tight text-[var(--g66-text-primary)]">
                        {slaCompliance === null ? "--" : `${slaCompliance}%`}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-[var(--g66-text-primary)]">SLA Cumplido</p>
                    <p className="mt-1 text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                      Meta operativa: 90%
                    </p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="grid grid-cols-[auto_1fr] gap-3 rounded-[var(--g66-radius-md)] border border-[var(--g66-border-soft)] bg-white p-3.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--g66-success-soft)] text-[var(--g66-success)]">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[var(--g66-text-secondary)]">Casos resueltos hoy</p>
                      <p className="mt-1 text-2xl font-black text-[var(--g66-text-primary)]">
                        {resolvedToday.length}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-[var(--g66-success)]">
                        Cerrados desde medianoche
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-3 rounded-[var(--g66-radius-md)] border border-[var(--g66-border-soft)] bg-white p-3.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
                      <Clock3 className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[var(--g66-text-secondary)]">
                        Tiempo de primera respuesta
                      </p>
                      <p className="mt-1 text-2xl font-black text-[var(--g66-text-primary)]">
                        {avgFirstResponseSeconds === null
                          ? "--"
                          : formatDuration(avgFirstResponseSeconds)}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-[var(--g66-text-secondary)]">
                        {avgFirstResponseSeconds === null ? "Sin datos suficientes" : "Meta: 30 min"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-3 rounded-[var(--g66-radius-md)] border border-[var(--g66-border-soft)] bg-white p-3.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--g66-info-soft)] text-[var(--g66-info)]">
                      <Gauge className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[var(--g66-text-secondary)]">
                        Tiempo de resolución
                      </p>
                      <p className="mt-1 text-2xl font-black text-[var(--g66-text-primary)]">
                        {avgResolutionSeconds === null
                          ? "--"
                          : formatDuration(avgResolutionSeconds)}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-[var(--g66-text-secondary)]">
                        {avgResolutionSeconds === null ? "Sin datos suficientes" : "Meta: 4 h"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[70fr_30fr]">
            <article className="overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-card)]">
              <div className="flex items-center justify-between border-b border-[var(--g66-border)] px-3 py-2.5">
                <h2 className="text-base font-black text-[var(--g66-text-primary)]">Últimos casos</h2>
                <Link href="/casos" className="text-xs font-bold text-[var(--g66-brand-blue)] hover:underline">
                  Ver todos
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-left text-sm">
                  <thead className="bg-[var(--g66-surface-soft)] text-xs uppercase tracking-wide text-[var(--g66-text-secondary)]">
                    <tr>
                      <th className="px-3 py-2.5">ID / Número caso</th>
                      <th className="px-3 py-2.5">Asunto</th>
                      <th className="px-3 py-2.5">Cliente</th>
                      <th className="px-3 py-2.5">Canal</th>
                      <th className="px-3 py-2.5">Prioridad</th>
                      <th className="px-3 py-2.5">Estado</th>
                      <th className="px-3 py-2.5">Asignado</th>
                      <th className="px-3 py-2.5">Actualizado</th>
                      <th className="px-3 py-2.5">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--g66-border)]">
                    {latestCases.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-7 text-center text-sm font-semibold text-[var(--g66-text-secondary)]">
                          No hay casos para mostrar con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      latestCases.map((caseItem) => {
                        const badge = priorityBadge(caseItem.priority);
                        const lifecycle = normalizeLifecycleStatus(
                          caseItem.lifecycle_status,
                          caseItem.status,
                        );
                        const Icon = channelIcon(caseItem);

                        return (
                          <tr key={caseItem.id} className="transition hover:bg-[var(--g66-surface-soft)]">
                            <td className="px-3 py-2.5">
                              <Link href={`/casos/${caseItem.id}`} className="font-bold text-[var(--g66-brand-blue)] hover:underline">
                                {formatCaseNumber(caseItem.case_number, caseItem.id)}
                              </Link>
                            </td>
                            <td className="max-w-[260px] px-3 py-2.5">
                              <Link href={`/casos/${caseItem.id}`} className="line-clamp-1 font-bold text-[var(--g66-text-primary)] hover:underline">
                                {caseItem.subject || "Sin asunto"}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-[var(--g66-text-secondary)]">
                              {getCustomerLabel(caseItem)}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--g66-accent-cyan)]">
                                <Icon className="h-4 w-4" />
                                {channelLabel(caseItem)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`rounded-md px-2 py-1 text-[11px] font-black ${badge.className}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`rounded-md px-2 py-1 text-[11px] font-black ${statusBadgeClass(lifecycle)}`}>
                                {lifecycle}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-[var(--g66-text-secondary)]">
                              {getAgentLabel(caseItem, agentNames)}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-[var(--g66-text-secondary)]">
                              {formatRelativeTime(caseItem.updated_at || caseItem.created_at)}
                            </td>
                            <td className="px-3 py-2.5">
                              <Link href={`/casos/${caseItem.id}`} className="inline-flex h-8 items-center rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white px-3 text-xs font-bold text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]">
                                Abrir
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
              <h2 className="text-base font-black text-[var(--g66-text-primary)]">Acciones rápidas</h2>
              <div className="mt-4 grid gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-surface-soft)] hover:shadow-[var(--g66-shadow-card)]"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-[var(--g66-text-primary)]">
                          {action.label}
                        </span>
                        <span className="block text-xs font-semibold text-[var(--g66-text-secondary)]">
                          {action.detail}
                        </span>
                      </span>
                    </Link>
                  );
                })}
                {canSyncEmail ? (
                  <button
                    type="button"
                    onClick={syncEmail}
                    disabled={isSyncingEmail}
                    className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-surface-soft)] hover:shadow-[var(--g66-shadow-card)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
                      <Send className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-[var(--g66-text-primary)]">
                        {isSyncingEmail ? "Sincronizando..." : "Sincronizar correo"}
                      </span>
                      <span className="block text-xs font-semibold text-[var(--g66-text-secondary)]">
                        Ejecuta sync IMAP manual
                      </span>
                    </span>
                  </button>
                ) : null}
              </div>
            </article>
          </section>
      </div>
    </div>
  );
}

function BotIcon({ className }: { className?: string }) {
  return <Sparkles className={className} />;
}
