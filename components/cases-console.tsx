"use client";

import {
  buildCaseFieldAuditEvents,
  createCaseAuditEvents,
  formatAuditValue,
  type CaseAuditActor,
  type CaseAuditEvent,
  type CaseAuditEventInput,
} from "@/lib/case-audit";
import {
  formatCaseNumber,
  lifecycleStatuses,
  normalizeLifecycleStatus,
  normalizeRoutingStatus,
  type LifecycleStatus,
} from "@/lib/case-status";
import {
  computeCaseSla,
  formatDuration,
  getFrtSlaState,
  type CaseNotificationStatus,
} from "@/lib/case-sla";
import {
  buildCustomValuePayload,
  getCustomValueForField,
  getStandardCaseValue,
  validateCustomFieldValue,
  type CaseCustomValue,
  type CaseFieldDefinition,
  type CaseLayoutTabWithSections,
  type ResolvedCaseAreaLayout,
} from "@/lib/case-metadata";
import { normalizeAircallPhone } from "@/lib/aircall";
import {
  canEditCaseField,
  canViewCaseField,
  hasPermission,
  standardCaseFieldKeys,
  type CrmCaseFieldPermissionRecord,
  type CrmRolePermissionRecord,
} from "@/lib/permissions";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCheck,
  CornerDownLeft,
  Copy,
  FileText,
  History,
  Mail,
  MessageCircle,
  Paperclip,
  PhoneCall,
  User,
  Wand2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CaseReplyForm } from "./case-reply-form";
import { CaseEmailComposer } from "./cases/case-email-composer";
import { AircallPhoneWidget } from "./aircall-phone-widget";
import { useToast } from "./toast-provider";
import { useDemoRole } from "./use-demo-role";

export type ConsoleCaseRecord = {
  id: string;
  case_number: string | null;
  customer_id: string | number | null;
  subject: string | null;
  channel: string | null;
  contact_type: string | null;
  status: string | null;
  lifecycle_status: string | null;
  routing_status: string | null;
  priority: string | null;
  area: string | null;
  category: string | null;
  assigned_agent_id: string | null;
  assigned_to: string | null;
  assigned_at?: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at?: string | null;
  resolution_type?: string | null;
  ai_summary?: string | null;
  ai_category?: string | null;
  ai_sentiment?: string | null;
  ai_confidence?: number | null;
  ai_resolution?: string | null;
  product?: string | null;
  subproduct?: string | null;
  is_edge_case?: boolean | null;
  customer: {
    name: string | null;
    email?: string | null;
    phone?: string | null;
    public_id?: string | null;
  } | null;
};

export type ConsoleMessageRecord = {
  id: string | number;
  case_id: string | number | null;
  body: string | null;
  sender_type: string | null;
  direction: string | null;
  created_at: string | null;
  channel?: string | null;
  message_type?: string | null;
  media_type?: string | null;
  has_media?: boolean | null;
  delivery_status?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
  failure_reason?: string | null;
  external_message_id?: string | null;
  email_subject?: string | null;
  email_from?: string | null;
  email_to?: string | null;
  email_cc?: string | null;
  email_bcc?: string | null;
  email_html_body?: string | null;
  email_text_body?: string | null;
  in_reply_to?: string | null;
  email_references?: string[] | null;
  email_message_id?: string | null;
};

export type ConsoleAgentRecord = {
  id: string;
  name: string | null;
  email: string | null;
};

type AircallCallRecord = {
  id: string;
  aircall_call_id: string;
  case_id: string | null;
  customer_id: string | null;
  crm_user_id: string | null;
  aircall_user_id: string | null;
  aircall_user_name: string | null;
  aircall_user_email: string | null;
  direction: string | null;
  phone_number: string | null;
  customer_phone: string | null;
  aircall_number_id: string | null;
  aircall_number: string | null;
  status: string | null;
  result: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  asset_url: string | null;
  voicemail_url: string | null;
  tags: unknown;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MessageAttachmentRecord = {
  id: string;
  message_id: string | number | null;
  case_id: string | number | null;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  source: string | null;
  media_type?: string | null;
  caption?: string | null;
  whatsapp_media_id?: string | null;
  created_at: string | null;
};

type ViewKey =
  | "all"
  | "mine"
  | "open"
  | "unassigned"
  | "ai"
  | "human"
  | "closed"
  | "whatsapp"
  | "email"
  | `saved:${string}`;
type WorkTab = "whatsapp" | "ticket" | "ai" | "activity" | "history" | "form";
type TicketTab = "publish" | "details" | "activity" | "history" | `layout:${string}`;
type RelatedView = "cases" | "qa" | "email" | "ai" | "history" | "activity" | "sla" | "aircall" | null;
type PendingAction =
  | "status"
  | "assign-me"
  | "close"
  | "email"
  | "email-sync"
  | "macro"
  | "custom-fields"
  | "case-info"
  | "aircall"
  | null;

type SavedView = {
  id: string;
  name: string;
  filters: {
    query: string;
    status: string;
    priority: string;
    channel: string;
  };
};

type MessagesResponse = {
  ok?: boolean;
  messages?: ConsoleMessageRecord[];
};

type EmailSendResponse = {
  ok?: boolean;
  error?: string;
  details?: string;
  message?: ConsoleMessageRecord;
};

type EmailSyncResponse = {
  success?: boolean;
  error?: string;
  processed?: number;
  inserted?: number;
  skipped?: number;
  errors?: string[];
  attachmentsSaved?: number;
};

type AttachmentsResponse = {
  ok?: boolean;
  attachments?: MessageAttachmentRecord[];
  error?: string;
};

type CaseAiHistoryMetrics = {
  total_cases?: number;
  transfer_cases?: number;
  repeated_cases?: number;
  open_escalations?: number;
  sentiment?: string;
};

type CaseAiHistorySummary = {
  id: string;
  case_id: string;
  customer_id: string | null;
  summary: string | null;
  patterns: string[] | null;
  next_best_action: string | null;
  sentiment: string | null;
  metrics: CaseAiHistoryMetrics | null;
  source_case_ids: string[] | null;
  model: string | null;
  generated_by: string | null;
  generated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CaseAiHistoryRow = {
  id: string;
  case_number: string | null;
  date: string | null;
  priority: string | null;
  request: string;
  resolution: string;
  final_status: string;
  channel: string | null;
};

type CaseAiHistoryResponse = {
  ok?: boolean;
  aiConfigured?: boolean;
  reason?: string;
  error?: string;
  cachedSummary?: CaseAiHistorySummary | null;
  historicalCases?: CaseAiHistoryRow[];
  metrics?: CaseAiHistoryMetrics;
};

type ActiveMacroActionRecord = {
  id: string;
  action_type: string;
  sort_order: number | null;
  payload: Record<string, unknown>;
};

type ActiveMacroRecord = {
  id: string;
  name: string;
  description: string | null;
  macro_actions?: ActiveMacroActionRecord[] | null;
};

type MacroRunResponse = {
  ok?: boolean;
  status?: string;
  error?: string;
  results?: {
    action_type: string;
    sort_order: number | null;
    ok: boolean;
    message: string;
  }[];
};

type WhatsappNotificationCase = {
  caseId: string;
  caseNumber: string;
  subject: string | null;
  customerName: string;
  channel: string | null;
  priority: string | null;
  assignedTo: string | null;
  notificationStatus: CaseNotificationStatus;
  notificationLabel: string;
  lastCustomerMessageAt: string | null;
  lastAgentMessageAt: string | null;
  lastActivityAt: string | null;
  createdAt: string | null;
  minutesWaiting: number;
};

type WhatsappNotificationsResponse = {
  summary?: {
    red?: number;
    blue?: number;
    green?: number;
    neutral?: number;
    total?: number;
  };
  cases?: WhatsappNotificationCase[];
  error?: string;
};

type TicketComposerState = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  bodyText?: string;
  bodyHtml?: string;
  htmlBody?: string;
  attachments?: {
    filename: string;
    contentType?: string;
    size?: number;
    contentBase64: string;
  }[];
};

const baseViews: { key: ViewKey; label: string }[] = [
  { key: "all", label: "Todos los casos" },
  { key: "mine", label: "Mis casos" },
  { key: "open", label: "Casos abiertos" },
  { key: "unassigned", label: "Sin asignar" },
  { key: "ai", label: "AI Handling" },
  { key: "human", label: "Human Required" },
  { key: "closed", label: "Cerrados" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
];
const lifecyclePathLabels: Record<LifecycleStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In Progress",
  STAND_BY: "Stand By",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  MERGED: "Merged",
};
const priorityOptions = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const areaOptions = [
  "GENERAL",
  "SOPORTE",
  "FACTURACION",
  "OPERACIONES",
  "COMPLIANCE",
  "VENTAS",
];
const categoryOptions = [
  "CONSULTA",
  "ACCESO",
  "INCIDENCIA",
  "PAGO",
  "DOCUMENTACION",
  "FACTURACION",
  "RECLAMO",
  "OTRO",
];
const contactTypeOptions = ["WHATSAPP", "GMAIL", "WEB", "CHATBOT", "PHONE", "MANUAL"];
const routingStatusOptions = [
  "AI_HANDLING",
  "HUMAN_REQUIRED",
  "ASSIGNED",
  "UNASSIGNED",
];
const resolutionTypeOptions = [
  "AI_RESOLVED",
  "AI_ASSISTED",
  "HUMAN_RESOLVED",
  "UNRESOLVED",
];

const caseAuditFieldLabels: Record<string, string> = {
  subject: "Asunto",
  status: "Estado",
  lifecycle_status: "Estado operativo",
  routing_status: "Estado de atención",
  priority: "Prioridad",
  area: "Área",
  category: "Categoría",
  contact_type: "Tipo de contacto",
  assigned_agent_id: "Agente asignado",
  assigned_to: "Asignado a",
  assigned_at: "Fecha de asignación",
  resolution_type: "Resolución",
  closed_at: "Fecha de cierre",
  ai_summary: "AI Summary",
};

function getDefaultWorkTab(caseItem: ConsoleCaseRecord | null | undefined): WorkTab {
  const channel = (caseItem?.channel || caseItem?.contact_type || "").toUpperCase();

  return channel === "WHATSAPP" ? "whatsapp" : "ticket";
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return "Sin fecha";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

function formatRelativeTime(date: string | null | undefined) {
  if (!date) return "Sin fecha";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Sin fecha";

  const diffMs = Date.now() - parsedDate.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function getDaysWithoutOperation(date: string | null | undefined) {
  if (!date) return null;

  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return null;

  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function formatAttachmentSize(sizeBytes: number | null | undefined) {
  if (!sizeBytes || sizeBytes <= 0) return "Sin tamaño";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?:
    | "gray"
    | "navy"
    | "blue"
    | "softBlue"
    | "lightBlue"
    | "coral"
    | "green";
}) {
  const tones = {
    gray: "border border-[var(--g66-border)] bg-[var(--g66-background)] text-[var(--g66-text-secondary)]",
    navy: "bg-[var(--g66-brand-blue)] text-white",
    blue: "bg-[var(--g66-accent-cyan)] text-white",
    softBlue: "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-accent-cyan)]",
    lightBlue: "border border-[var(--g66-border)] bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]",
    coral: "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]",
    green: "bg-[var(--g66-success-soft)] text-[var(--g66-success)]",
  };

  return (
    <span
      className={`inline-flex w-fit rounded-full px-1.5 py-px text-[9px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--g66-text-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-xs font-bold text-[var(--g66-text-primary)]">
        {value}
      </dd>
    </div>
  );
}

function HeaderMetadataItem({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 px-3 py-1 first:pl-2 ${className}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--g66-text-muted)]">
        {label}
      </p>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] font-black text-[var(--g66-text-primary)]">
        {children}
      </div>
    </div>
  );
}

function getAuditValueLabel(value: string | null | undefined) {
  return value === null || value === undefined || value === "" ? "vacío" : value;
}

function getAuditActorLabel(event: CaseAuditEvent) {
  return event.actor_name || event.actor_email || "Sistema";
}

function getAuditActionLabel(event: CaseAuditEvent) {
  const actor = getAuditActorLabel(event);
  const field = event.field_label || event.field_key || "campo";

  if (event.event_type === "case_closed") {
    return `${actor} cerró el caso`;
  }

  if (event.event_type === "case_reopened") {
    return `${actor} reabrió el caso`;
  }

  if (event.event_type === "case_assignment_updated") {
    return `${actor} actualizó la asignación`;
  }

  if (event.event_type === "case_custom_field_updated") {
    return `${actor} actualizó ${field}`;
  }

  return `${actor} cambió ${field}`;
}

function isUuidLike(value: string | null | undefined) {
  return Boolean(
    value?.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    ),
  );
}

function isAssignmentAuditEvent(event: CaseAuditEvent) {
  return (
    event.event_type === "case_assignment_updated" ||
    event.field_key === "assigned_agent_id" ||
    event.field_key === "assigned_to"
  );
}

function getAuditMetadataString(
  metadata: CaseAuditEvent["metadata"],
  key: string,
) {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim() ? value : null;
}

function getAuditDisplayValue(
  event: CaseAuditEvent,
  value: string | null | undefined,
  side: "old" | "new",
  agentNames: Map<string, string>,
) {
  if (!value) return "vacío";

  if (!isAssignmentAuditEvent(event)) {
    return getAuditValueLabel(value);
  }

  const metadataName = getAuditMetadataString(
    event.metadata,
    side === "old" ? "old_assigned_agent_name" : "new_assigned_agent_name",
  );

  if (metadataName) return metadataName;

  const resolvedName = agentNames.get(value);

  if (resolvedName) return resolvedName;
  if (isUuidLike(value)) return "Usuario no encontrado";

  return value;
}

function AuditEventCard({
  event,
  agentNames,
}: {
  event: CaseAuditEvent;
  agentNames: Map<string, string>;
}) {
  const hasFieldChange =
    event.old_value !== null ||
    event.new_value !== null ||
    event.field_key !== null;

  return (
    <article className="rounded-md border border-[var(--g66-border)] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--g66-text-primary)]">
            {getAuditActionLabel(event)}
          </p>
          {hasFieldChange ? (
            <p className="mt-1 text-xs font-semibold text-[var(--g66-text-secondary)]">
              {event.field_label || event.field_key || "Campo"}:{" "}
              <span className="text-[var(--g66-text-muted)]">
                {getAuditDisplayValue(event, event.old_value, "old", agentNames)}
              </span>{" "}
              →{" "}
              <span className="text-[var(--g66-text-primary)]">
                {getAuditDisplayValue(event, event.new_value, "new", agentNames)}
              </span>
            </p>
          ) : null}
          <p className="mt-1 text-[11px] font-semibold text-[var(--g66-text-muted)]">
            {event.actor_role || "Sin rol"} · {event.source || "case_detail"}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-[var(--g66-text-secondary)]">
          {formatDateTime(event.created_at)}
        </span>
      </div>
    </article>
  );
}

function getAircallCallTitle(call: AircallCallRecord) {
  const direction = call.direction?.toLowerCase();

  if (direction === "inbound") return "Llamada entrante";
  if (direction === "outbound") return "Llamada saliente";

  return "Llamada Aircall";
}

function getAircallDurationLabel(seconds: number | null) {
  if (seconds === null || seconds === undefined) return "Sin duración";

  return formatDuration(seconds);
}

function AircallCallCard({ call }: { call: AircallCallRecord }) {
  const tags = Array.isArray(call.tags)
    ? call.tags
        .map((tag) => {
          if (typeof tag === "string") return tag;
          if (tag && typeof tag === "object" && "name" in tag) {
            return String((tag as { name?: unknown }).name ?? "");
          }

          return "";
        })
        .filter(Boolean)
    : [];

  return (
    <article className="rounded-md border border-[var(--g66-border)] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-black text-[var(--g66-text-primary)]">
            <PhoneCall className="h-3.5 w-3.5 text-[var(--g66-brand-blue)]" aria-hidden="true" />
            {getAircallCallTitle(call)}
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--g66-text-secondary)]">
            {call.aircall_user_name || call.aircall_user_email || "Agente Aircall"} ·{" "}
            {call.customer_phone || call.phone_number || "Sin teléfono"}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[var(--g66-text-muted)]">
            Estado: {call.status || "Sin estado"} · Resultado:{" "}
            {call.result || "Sin resultado"} · Duración:{" "}
            {getAircallDurationLabel(call.duration_seconds)}
          </p>
          {call.aircall_number ? (
            <p className="mt-1 text-[11px] font-semibold text-[var(--g66-text-muted)]">
              Número Aircall: {call.aircall_number}
            </p>
          ) : null}
          {tags.length > 0 ? (
            <p className="mt-1 text-[11px] font-semibold text-[var(--g66-text-muted)]">
              Tags: {tags.join(", ")}
            </p>
          ) : null}
          {call.notes ? (
            <p className="mt-2 rounded-[var(--g66-radius-sm)] bg-[var(--g66-surface-soft)] p-2 text-[11px] font-semibold text-[var(--g66-text-secondary)]">
              {call.notes}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: "Grabación", href: call.recording_url },
              { label: "Asset", href: call.asset_url },
              { label: "Voicemail", href: call.voicemail_url },
            ]
              .filter((link) => Boolean(link.href))
              .map((link) => (
                <a
                  key={link.label}
                  href={link.href ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[var(--g66-border)] bg-white px-2 py-1 text-[10px] font-black text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                >
                  {link.label}
                </a>
              ))}
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-[var(--g66-text-secondary)]">
          {formatDateTime(call.started_at || call.created_at)}
        </span>
      </div>
    </article>
  );
}

function getCustomPayloadAuditValue(
  payload: ReturnType<typeof buildCustomValuePayload>,
) {
  if (payload.value_boolean !== null) return payload.value_boolean;
  if (payload.value_number !== null) return payload.value_number;
  if (payload.value_date !== null) return payload.value_date;
  if (payload.value_datetime !== null) return payload.value_datetime;
  if (payload.value_text !== null) return payload.value_text;

  return null;
}

function getAiMetricValue(value: number | undefined) {
  return (value ?? 0).toLocaleString("es-CL");
}

function AiMetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-[var(--g66-radius-md)] border border-[var(--g66-border-soft)] bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-[var(--g66-text-muted)]">
            {label}
          </p>
          <p className="text-lg font-black text-[var(--g66-text-primary)]">{value}</p>
        </div>
      </div>
      {detail ? (
        <p className="mt-1 text-[11px] font-semibold text-[var(--g66-text-secondary)]">
          {detail}
        </p>
      ) : null}
    </article>
  );
}

function CaseAiHistoryPanel({
  selectedCase,
  payload,
  isLoading,
  isGenerating,
  error,
  canGenerate,
  onGenerate,
}: {
  selectedCase: ConsoleCaseRecord;
  payload: CaseAiHistoryResponse | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  const summary = payload?.cachedSummary;
  const metrics = summary?.metrics ?? payload?.metrics ?? {};
  const patterns = summary?.patterns ?? [];
  const historicalCases = payload?.historicalCases ?? [];
  const sentiment = summary?.sentiment ?? metrics.sentiment ?? "Sin datos";
  const searchTerm = encodeURIComponent(getCustomerLabel(selectedCase));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--g66-background)] p-3">
      <div className="grid gap-3">
        <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-base font-black text-[var(--g66-text-primary)]">
                <Bot className="h-5 w-5 text-[var(--g66-brand-blue)]" aria-hidden="true" />
                Resumen IA de casos históricos
              </h3>
              <p className="mt-1 text-xs font-semibold text-[var(--g66-text-secondary)]">
                {summary?.generated_at
                  ? `Generado ${formatDateTime(summary.generated_at)}`
                  : "Sin resumen generado todavía"}
              </p>
            </div>
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate || isGenerating}
              className="inline-flex items-center justify-center rounded-full border border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue)] px-4 py-2 text-xs font-black text-white transition hover:bg-[var(--g66-brand-blue-hover)] disabled:border-[var(--g66-border)] disabled:bg-[var(--g66-border)] disabled:text-[var(--g66-text-muted)]"
              title={
                canGenerate
                  ? "Actualizar resumen IA"
                  : "No tienes permiso para generar este resumen"
              }
            >
              {isGenerating ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          {error ? (
            <p className="mt-3 rounded-[var(--g66-radius-md)] border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-3 text-xs font-bold text-[var(--g66-danger)]">
              {error}
            </p>
          ) : null}

          {!payload?.aiConfigured && payload ? (
            <p className="mt-3 rounded-[var(--g66-radius-md)] border border-[var(--g66-warning-soft)] bg-[var(--g66-warning-soft)] p-3 text-xs font-bold text-[#B77900]">
              IA no configurada. Puedes revisar la tabla histórica sin generar resumen.
            </p>
          ) : null}

          <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-6 text-[var(--g66-text-primary)]">
            {isLoading
              ? "Cargando historial del cliente..."
              : summary?.summary ||
                "Actualiza el resumen para detectar patrones del historial de este cliente."}
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          <AiMetricCard
            label="Casos totales"
            value={getAiMetricValue(metrics.total_cases)}
            icon={<FileText className="h-4 w-4" aria-hidden="true" />}
          />
          <AiMetricCard
            label="Transferencias"
            value={getAiMetricValue(metrics.transfer_cases)}
            detail="Casos relacionados"
            icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          />
          <AiMetricCard
            label="Repetidos"
            value={getAiMetricValue(metrics.repeated_cases)}
            detail="Patrones similares"
            icon={<History className="h-4 w-4" aria-hidden="true" />}
          />
          <AiMetricCard
            label="Escalaciones"
            value={getAiMetricValue(metrics.open_escalations)}
            detail="Abiertas o en riesgo"
            icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          />
          <AiMetricCard
            label="Sentimiento"
            value={sentiment}
            icon={<Activity className="h-4 w-4" aria-hidden="true" />}
          />
        </section>

        <section className="overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-card)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--g66-border-soft)] px-4 py-3">
            <h3 className="text-sm font-black text-[var(--g66-text-primary)]">
              Casos históricos del cliente
            </h3>
            <Link
              href={`/casos?search=${searchTerm}`}
              className="text-xs font-black text-[var(--g66-brand-blue)] hover:underline"
            >
              Ver todos los casos históricos
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[var(--g66-surface-soft)] text-[10px] font-black uppercase tracking-wide text-[var(--g66-text-muted)]">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Caso #</th>
                  <th className="px-4 py-2">Qué pidió el cliente</th>
                  <th className="px-4 py-2">Solución / resolución</th>
                  <th className="px-4 py-2">Estado final</th>
                  <th className="px-4 py-2">Canal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--g66-border-soft)]">
                {historicalCases.slice(0, 6).map((caseItem) => (
                  <tr key={caseItem.id} className="hover:bg-[var(--g66-surface-soft)]">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--g66-text-secondary)]">
                      {formatDateTime(caseItem.date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-black text-[var(--g66-brand-blue)]">
                      <Link href={`/casos/${caseItem.id}`}>
                        {formatCaseNumber(caseItem.case_number, caseItem.id)}
                      </Link>
                    </td>
                    <td className="max-w-[240px] px-4 py-3 font-semibold text-[var(--g66-text-primary)]">
                      {caseItem.request}
                    </td>
                    <td className="max-w-[280px] px-4 py-3 font-semibold text-[var(--g66-text-secondary)]">
                      {caseItem.resolution}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded-full bg-[var(--g66-info-soft)] px-2 py-1 text-[10px] font-black text-[var(--g66-info)]">
                        {caseItem.final_status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-[var(--g66-text-secondary)]">
                      {caseItem.channel || "Sin canal"}
                    </td>
                  </tr>
                ))}
                {!isLoading && historicalCases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm font-semibold text-[var(--g66-text-secondary)]"
                    >
                      No hay casos históricos asociados a este cliente.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
            <h3 className="text-sm font-black text-[var(--g66-text-primary)]">
              Patrones detectados por IA
            </h3>
            {patterns.length > 0 ? (
              <ul className="mt-3 grid gap-2 text-sm font-semibold text-[var(--g66-text-secondary)]">
                {patterns.map((pattern) => (
                  <li key={pattern} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g66-success)]" aria-hidden="true" />
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm font-semibold text-[var(--g66-text-secondary)]">
                Actualiza el resumen para ver patrones detectados.
              </p>
            )}
          </section>

          <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
            <h3 className="text-sm font-black text-[var(--g66-text-primary)]">
              Próxima mejor acción
            </h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-[var(--g66-text-secondary)]">
              {summary?.next_best_action ||
                "Genera el resumen para obtener una recomendación operativa."}
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                disabled
                className="rounded-full border border-[var(--g66-border)] bg-[var(--g66-surface-soft)] px-3 py-2 text-xs font-black text-[var(--g66-text-muted)]"
              >
                Enviar mensaje sugerido
              </button>
              <button
                type="button"
                disabled
                className="rounded-full border border-[var(--g66-border)] bg-white px-3 py-2 text-xs font-black text-[var(--g66-text-muted)]"
              >
                Ver guion
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ModuleBox({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-card)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] px-2.5 py-1.5">
        <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[var(--g66-text-primary)]">
          {icon ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
              {icon}
            </span>
          ) : null}
          {title}
        </h3>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-2.5">{children}</div>
    </section>
  );
}

function QuickCopyRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--g66-text-muted)]">
          {label}
        </p>
        <p className="truncate text-xs font-bold text-[var(--g66-text-primary)]">{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
        aria-label={`Copiar ${label}`}
        title={`Copiar ${label}`}
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[var(--g66-text-secondary)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function CustomFieldInput({
  field,
  value,
  disabled,
}: {
  field: CaseFieldDefinition;
  value: unknown;
  disabled: boolean;
}) {
  const name = `custom:${field.id}`;
  const textValue = typeof value === "string" ? value : "";

  if (field.field_type === "textarea") {
    return (
      <textarea
        name={name}
        defaultValue={textValue}
        disabled={disabled}
        required={Boolean(field.is_required)}
        className={textareaClassName()}
      />
    );
  }

  if (field.field_type === "boolean") {
    return (
      <label className="inline-flex h-8 items-center gap-2 text-sm font-semibold text-[var(--g66-text-primary)]">
        <input
          name={name}
          type="checkbox"
          defaultChecked={Boolean(value)}
          disabled={disabled}
        />
        Sí
      </label>
    );
  }

  if (field.field_type === "picklist") {
    return (
      <select
        name={name}
        defaultValue={textValue}
        disabled={disabled}
        required={Boolean(field.is_required)}
        className={inputClassName()}
      >
        <option value="">Seleccionar</option>
        {(field.picklist_values ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  const inputTypeByFieldType: Record<string, string> = {
    number: "number",
    currency: "number",
    date: "date",
    datetime: "datetime-local",
    email: "email",
    phone: "tel",
    url: "url",
    text: "text",
  };

  return (
    <input
      name={name}
      type={inputTypeByFieldType[field.field_type] ?? "text"}
      step={field.field_type === "currency" ? "0.01" : undefined}
      defaultValue={textValue}
      disabled={disabled}
      required={Boolean(field.is_required)}
      className={inputClassName()}
    />
  );
}

function inputClassName() {
  return "h-9 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-sm font-semibold text-[var(--g66-text-primary)] outline-none transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:bg-[var(--g66-background)] disabled:text-[var(--g66-text-secondary)]";
}

function textareaClassName() {
  return "min-h-20 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 py-2 text-sm font-semibold leading-5 text-[var(--g66-text-primary)] outline-none transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:bg-[var(--g66-background)] disabled:text-[var(--g66-text-secondary)]";
}

function getCustomerLabel(caseItem: ConsoleCaseRecord) {
  return (
    caseItem.customer?.name ??
    caseItem.customer?.email ??
    caseItem.contact_name ??
    caseItem.contact_email ??
    caseItem.contact_phone ??
    "Cliente no relacionado"
  );
}

function getCustomerEmail(caseItem: ConsoleCaseRecord) {
  return caseItem.customer?.email ?? caseItem.contact_email ?? "Sin email";
}

function getCustomerPhone(caseItem: ConsoleCaseRecord) {
  return caseItem.customer?.phone ?? caseItem.contact_phone ?? "Sin teléfono";
}

function getAgentLabel(
  caseItem: ConsoleCaseRecord,
  agentNames: Map<string, string>,
) {
  if (caseItem.assigned_agent_id) {
    return agentNames.get(caseItem.assigned_agent_id) ?? "Usuario no encontrado";
  }

  return caseItem.assigned_to ?? "Sin asignar";
}

function getMessagePreview(message: ConsoleMessageRecord | undefined) {
  return message?.body || "Sin mensajes";
}

function isEmailMessage(message: ConsoleMessageRecord) {
  return message.message_type?.toUpperCase() === "EMAIL";
}

function getEmailTitle(message: ConsoleMessageRecord) {
  const sender = message.sender_type?.toUpperCase() ?? "";

  return sender === "AGENT"
    ? "Correo enviado por agente"
    : "Correo recibido del cliente";
}

function getMacroActionSummary(action: ActiveMacroActionRecord) {
  if (action.action_type === "UPDATE_CASE_FIELDS") {
    const fields = Object.entries(action.payload ?? {})
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => `${key} = ${String(value)}`);

    return fields.length > 0 ? `Actualizar ${fields.join(", ")}` : "Actualizar campos";
  }

  if (action.action_type === "ADD_INTERNAL_NOTE") {
    return `Agregar nota: ${String(action.payload?.note || "Sin nota")}`;
  }

  if (action.action_type === "SEND_REPLY") {
    return `Enviar respuesta ${String(action.payload?.channel || "INTERNAL")}`;
  }

  if (action.action_type === "ESCALATE_CASE") {
    return `Escalar caso · prioridad ${String(action.payload?.priority || "HIGH")}`;
  }

  if (action.action_type === "CLOSE_CASE") return "Cerrar caso";

  return action.action_type;
}

function splitQuotedEmailText(text: string) {
  const markers = [
    "\nOn ",
    "\nEl ",
    "\nDe:",
    "\nFrom:",
    "\n-----Original Message-----",
  ];
  const indexes = markers
    .map((marker) => text.indexOf(marker))
    .filter((index) => index > 0);

  if (indexes.length === 0) {
    return { current: text, quoted: "" };
  }

  const firstIndex = Math.min(...indexes);

  return {
    current: text.slice(0, firstIndex).trim(),
    quoted: text.slice(firstIndex).trim(),
  };
}

function stripHtmlToText(html: string) {
  return html
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeEmailHtmlForDisplay(html: string) {
  if (typeof window === "undefined") return "";

  const document = new DOMParser().parseFromString(html, "text/html");
  document
    .querySelectorAll("script, iframe, object, embed, link, meta")
    .forEach((element) => element.remove());
  document.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.toLowerCase();

      if (name.startsWith("on") || value.includes("javascript:")) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return document.body.innerHTML;
}

function buildEmailSrcDoc(message: ConsoleMessageRecord) {
  const html =
    message.email_html_body ||
    `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;">${
      (message.email_text_body || message.body || "Sin contenido")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    }</pre>`;

  return `<!doctype html><html><head><base target="_blank"><style>html{background:#f6f8fb;}body{box-sizing:border-box;width:min(800px,100%);min-height:700px;margin:0 auto;padding:24px;background:#fff;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:var(--g66-text-primary);}img{max-width:100%;height:auto;}table{max-width:100%;}pre{white-space:pre-wrap;}</style></head><body>${sanitizeEmailHtmlForDisplay(html)}</body></html>`;
}

function isValidEmailList(value: string) {
  if (!value) return false;

  return value
    .split(",")
    .map((item) => item.trim())
    .every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function getDefaultTicketComposer(
  caseItem: ConsoleCaseRecord | null | undefined,
): TicketComposerState {
  if (!caseItem) {
    return {
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: "",
    };
  }

  const customerEmail = getCustomerEmail(caseItem);

  return {
    to: customerEmail === "Sin email" ? "" : customerEmail,
    cc: "",
    bcc: "",
    subject: caseItem.subject || formatCaseNumber(caseItem.case_number, caseItem.id),
    body: "",
  };
}

function getLastActivity(
  caseItem: ConsoleCaseRecord,
  message: ConsoleMessageRecord | undefined,
) {
  return message?.created_at ?? caseItem.updated_at ?? caseItem.created_at;
}

function getTimeWithoutResponse(messages: ConsoleMessageRecord[]) {
  const latestInbound = [...messages]
    .reverse()
    .find((message) => {
      const sender = message.sender_type?.toUpperCase() ?? "";
      const direction = message.direction?.toUpperCase() ?? "";

      return sender === "CUSTOMER" || direction === "INBOUND";
    });
  const latestOutbound = [...messages]
    .reverse()
    .find((message) => {
      const sender = message.sender_type?.toUpperCase() ?? "";
      const direction = message.direction?.toUpperCase() ?? "";

      return sender === "AGENT" || sender === "AI" || direction === "OUTBOUND";
    });

  if (!latestInbound?.created_at) return "Sin mensajes entrantes";

  const inboundTime = new Date(latestInbound.created_at).getTime();
  const outboundTime = latestOutbound?.created_at
    ? new Date(latestOutbound.created_at).getTime()
    : 0;

  if (outboundTime > inboundTime) return "Al día";

  return formatRelativeTime(latestInbound.created_at);
}

function uniqueValues(
  cases: ConsoleCaseRecord[],
  key: "status" | "priority" | "channel",
) {
  return [...new Set(cases.map((caseItem) => caseItem[key]).filter(Boolean))]
    .sort()
    .map((value) => value as string);
}

function uniqueStatusValues(cases: ConsoleCaseRecord[]) {
  return [
    ...new Set(
      cases.flatMap((caseItem) => [
        normalizeLifecycleStatus(caseItem.lifecycle_status, caseItem.status),
        normalizeRoutingStatus({
          routingStatus: caseItem.routing_status,
          status: caseItem.status,
          assignedAgentId: caseItem.assigned_agent_id,
        }),
      ]),
    ),
  ].sort();
}

function isOutbound(message: ConsoleMessageRecord) {
  const sender = message.sender_type?.toUpperCase() ?? "";
  const direction = message.direction?.toUpperCase() ?? "";

  return sender === "AI" || sender === "AGENT" || direction === "OUTBOUND";
}

function getDeliveryStatusMeta(message: ConsoleMessageRecord) {
  const status = message.delivery_status?.toUpperCase() ?? "";

  if (status === "READ") {
    return {
      label: "Leído",
      title: message.read_at ? `Leído ${formatDateTime(message.read_at)}` : "Leído",
      className: "text-[var(--g66-brand-blue)]",
      icon: <CheckCheck className="h-3 w-3" aria-hidden="true" />,
    };
  }

  if (status === "DELIVERED") {
    return {
      label: "Entregado",
      title: message.delivered_at
        ? `Entregado ${formatDateTime(message.delivered_at)}`
        : "Entregado",
      className: "text-[var(--g66-accent-cyan)]",
      icon: <CheckCheck className="h-3 w-3" aria-hidden="true" />,
    };
  }

  if (status === "FAILED") {
    return {
      label: "Fallido",
      title: message.failure_reason
        ? `Fallido: ${message.failure_reason}`
        : message.failed_at
          ? `Fallido ${formatDateTime(message.failed_at)}`
          : "Fallido",
      className: "text-[var(--g66-danger)]",
      icon: <AlertTriangle className="h-3 w-3" aria-hidden="true" />,
    };
  }

  if (status === "SENT") {
    return {
      label: "Enviado",
      title: "Enviado",
      className: "text-[var(--g66-text-secondary)]",
      icon: <Check className="h-3 w-3" aria-hidden="true" />,
    };
  }

  if (message.external_message_id) {
    return {
      label: "Enviado",
      title: "Enviado",
      className: "text-[var(--g66-text-secondary)]",
      icon: <Check className="h-3 w-3" aria-hidden="true" />,
    };
  }

  return null;
}

function bubbleClass(message: ConsoleMessageRecord) {
  const sender = message.sender_type?.toUpperCase();

  if (sender === "AI") return "border border-[var(--g66-border-soft)] bg-[var(--g66-brand-blue-soft)] text-[var(--g66-text-primary)]";
  if (sender === "AGENT") return "border border-[var(--g66-success-soft)] bg-[var(--g66-success-soft)] text-[var(--g66-text-primary)]";

  return "border border-[var(--g66-border)] bg-white text-[var(--g66-text-primary)]";
}

function messageWidthClass(message: ConsoleMessageRecord) {
  const sender = message.sender_type?.toUpperCase();

  if (sender === "AI") return "max-w-[min(680px,70%)]";
  if (sender === "AGENT") return "max-w-[min(700px,72%)]";

  return "max-w-[min(600px,62%)]";
}

function getAttachmentsForMessage(
  attachments: MessageAttachmentRecord[],
  messageId: string | number,
) {
  return attachments.filter(
    (attachment) => String(attachment.message_id) === String(messageId),
  );
}

function MediaAttachmentPreview({
  attachment,
}: {
  attachment: MessageAttachmentRecord;
}) {
  const mediaType = attachment.media_type?.toLowerCase();
  const downloadUrl = `/api/attachments/${attachment.id}/download`;

  if (mediaType === "image" || mediaType === "sticker") {
    return (
      <a href={downloadUrl} target="_blank" rel="noreferrer" className="block">
        <Image
          src={downloadUrl}
          alt={attachment.filename || mediaType}
          width={640}
          height={360}
          unoptimized
          className={`mt-2 rounded-md border border-[var(--g66-border)] object-contain ${
            mediaType === "sticker" ? "max-h-28 max-w-28" : "max-h-72 w-full"
          }`}
        />
      </a>
    );
  }

  if (mediaType === "audio" || mediaType === "voice") {
    return (
      <audio controls src={downloadUrl} className="mt-2 w-full">
        <a href={downloadUrl}>Descargar audio</a>
      </audio>
    );
  }

  if (mediaType === "video") {
    return (
      <video controls src={downloadUrl} className="mt-2 max-h-72 w-full rounded-md border border-[var(--g66-border)]">
        <a href={downloadUrl}>Descargar video</a>
      </video>
    );
  }

  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-md border border-[var(--g66-border)] bg-white/80 p-2 text-[var(--g66-text-primary)]"
    >
      <Paperclip className="mt-0.5 h-4 w-4" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold">
          {attachment.filename || "Documento WhatsApp"}
        </span>
        <span className="block truncate text-[11px] font-semibold text-[var(--g66-text-secondary)]">
          {[attachment.mime_type, formatAttachmentSize(attachment.size_bytes)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </a>
  );
}

function statusTone(status: string | null) {
  if (status === "CLOSED") return "gray";
  if (status === "HUMAN_REQUIRED") return "coral";
  if (status === "ASSIGNED") return "blue";
  if (status === "AI_HANDLING") return "softBlue";
  if (status === "UNASSIGNED") return "gray";
  if (status === "RESOLVED") return "green";
  if (status === "IN_PROGRESS") return "blue";
  if (status === "STAND_BY") return "softBlue";
  if (status === "NEW") return "gray";

  return "gray";
}

function routingStatusLabel(status: string | null) {
  if (status === "AI_HANDLING") return "IA gestionando";
  if (status === "ASSIGNED") return "Ejecutivo gestionando";
  if (status === "HUMAN_REQUIRED") return "Requiere humano";
  if (status === "UNASSIGNED") return "Sin asignar";

  return status || "Sin estado";
}

function responseBadgeTone(status: CaseNotificationStatus) {
  if (status === "RED") return "coral";
  if (status === "BLUE") return "lightBlue";
  if (status === "NEUTRAL") return "gray";

  return "green";
}

function whatsappNotificationCardClass(status: CaseNotificationStatus) {
  if (status === "RED") return "border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]";
  if (status === "BLUE") return "border-[var(--g66-brand-blue-soft)] bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]";
  if (status === "NEUTRAL") return "border-[var(--g66-border)] bg-[var(--g66-background)] text-[var(--g66-text-secondary)]";

  return "border-[var(--g66-success-soft)] bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
}

function WhatsappNotificationIcon({ status }: { status: CaseNotificationStatus }) {
  if (status === "RED") {
    return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (status === "BLUE") {
    return <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (status === "NEUTRAL") {
    return <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  return <Check className="h-3.5 w-3.5" aria-hidden="true" />;
}

function listLifecycleBadgeClass(status: string | null) {
  if (status === "NEW") return "bg-[var(--g66-warning-soft)] text-[var(--g66-warning-text)]";
  if (status === "IN_PROGRESS") return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
  if (status === "CLOSED") return "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]";

  return "";
}

function mergeMessages(
  currentMessages: ConsoleMessageRecord[],
  nextMessages: ConsoleMessageRecord[],
) {
  const byId = new Map<string, ConsoleMessageRecord>();

  currentMessages.forEach((message) => {
    byId.set(String(message.id), message);
  });
  nextMessages.forEach((message) => {
    byId.set(String(message.id), message);
  });

  return [...byId.values()];
}

function getSavedViews() {
  if (typeof window === "undefined") return [];

  try {
    const storedValue = window.localStorage.getItem("casesConsoleSavedViews");

    return storedValue ? (JSON.parse(storedValue) as SavedView[]) : [];
  } catch {
    return [];
  }
}

export function CasesConsole({
  cases,
  messages,
  agents,
  rolePermissions = [],
  caseFieldPermissions = [],
  initialSelectedCaseId,
}: {
  cases: ConsoleCaseRecord[];
  messages: ConsoleMessageRecord[];
  agents: ConsoleAgentRecord[];
  rolePermissions?: CrmRolePermissionRecord[];
  caseFieldPermissions?: CrmCaseFieldPermissionRecord[];
  initialSelectedCaseId?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const { role } = useDemoRole();
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const [caseItems, setCaseItems] = useState(cases);
  const [messageItems, setMessageItems] = useState(messages);
  const [selectedView, setSelectedView] = useState<ViewKey>("all");
  const [selectedCaseId, setSelectedCaseId] = useState(() => {
    const initialCase = initialSelectedCaseId
      ? cases.find((caseItem) => caseItem.id === initialSelectedCaseId)
      : null;

    if (initialCase) return initialCase.id;
    if (typeof window === "undefined") return cases[0]?.id ?? "";

    return (
      window.localStorage.getItem("casesConsoleSelectedCaseId") ??
      cases[0]?.id ??
      ""
    );
  });
  const [workTab, setWorkTab] = useState<WorkTab>(() =>
    getDefaultWorkTab(
      (initialSelectedCaseId
        ? cases.find((caseItem) => caseItem.id === initialSelectedCaseId)
        : null) ?? cases[0],
    ),
  );
  const [ticketTab, setTicketTab] = useState<TicketTab>("publish");
  const [isTicketDraftDirty, setIsTicketDraftDirty] = useState(false);
  const [isCustomLayoutDirty, setIsCustomLayoutDirty] = useState(false);
  const [ticketComposer, setTicketComposer] = useState<TicketComposerState>(() =>
    getDefaultTicketComposer(
      cases.find((caseItem) => caseItem.id === selectedCaseId) ?? cases[0],
    ),
  );
  const [selectedEmailMessage, setSelectedEmailMessage] =
    useState<ConsoleMessageRecord | null>(null);
  const [attachmentItems, setAttachmentItems] = useState<MessageAttachmentRecord[]>([]);
  const [, setLayoutTabs] = useState<CaseLayoutTabWithSections[]>([]);
  const [areaLayoutTab, setAreaLayoutTab] = useState<CaseLayoutTabWithSections | null>(null);
  const [customValues, setCustomValues] = useState<CaseCustomValue[]>([]);
  const [auditEvents, setAuditEvents] = useState<CaseAuditEvent[]>([]);
  const [aircallCalls, setAircallCalls] = useState<AircallCallRecord[]>([]);
  const [aiHistoryPayload, setAiHistoryPayload] =
    useState<CaseAiHistoryResponse | null>(null);
  const [isAiHistoryLoading, setIsAiHistoryLoading] = useState(false);
  const [isAiHistoryGenerating, setIsAiHistoryGenerating] = useState(false);
  const [aiHistoryError, setAiHistoryError] = useState<string | null>(null);
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>(
    {},
  );
  const [activeMacros, setActiveMacros] = useState<ActiveMacroRecord[]>([]);
  const [selectedMacroId, setSelectedMacroId] = useState("");
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [whatsappNotificationCases, setWhatsappNotificationCases] = useState<
    WhatsappNotificationCase[]
  >([]);
  const [whatsappPendingCount, setWhatsappPendingCount] = useState(0);
  const [relatedView, setRelatedView] = useState<RelatedView>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [savedViews, setSavedViews] = useState<SavedView[]>(getSavedViews);
  const [newViewName, setNewViewName] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isCaseInfoEditing, setIsCaseInfoEditing] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [agentSession] = useState(() => {
    if (typeof window === "undefined") return { id: "", name: "", email: "" };

    return {
      id: window.localStorage.getItem("agentId") ?? "",
      name: window.localStorage.getItem("agentName") ?? "Agente",
      email: window.localStorage.getItem("agentEmail") ?? "",
    };
  });
  const auditActor: CaseAuditActor = useMemo(
    () => ({
      userId: agentSession.id || null,
      name: agentSession.name || null,
      email: agentSession.email || null,
      role,
    }),
    [agentSession.email, agentSession.id, agentSession.name, role],
  );
  const canEditCaseFields = hasPermission(
    role,
    "edit_case_fields",
    rolePermissions,
  );
  const canTakeCases = hasPermission(role, "takeQueueCases", rolePermissions);
  const canCloseCases = hasPermission(role, "closeCases", rolePermissions);
  const canRespondToCustomers = hasPermission(
    role,
    "respondToCustomers",
    rolePermissions,
  );
  const canExecuteMacros = hasPermission(role, "manage_macros", rolePermissions);
  const canUseAircall = hasPermission(role, "use_aircall", rolePermissions);
  const canViewCallHistory = hasPermission(
    role,
    "view_call_history",
    rolePermissions,
  );
  const canViewAiCaseSummary = hasPermission(
    role,
    "view_ai_case_summary",
    rolePermissions,
  );
  const canGenerateAiCaseSummary =
    hasPermission(role, "generate_ai_case_summary", rolePermissions) &&
    hasPermission(role, "use_ai", rolePermissions);
  const canViewCaseInfoField = useCallback(
    (fieldKey: string) => canViewCaseField(role, fieldKey, caseFieldPermissions),
    [caseFieldPermissions, role],
  );
  const canEditCaseInfoField = useCallback(
    (fieldKey: string) =>
      canEditCaseFields && canEditCaseField(role, fieldKey, caseFieldPermissions),
    [canEditCaseFields, caseFieldPermissions, role],
  );
  const canEditAnyCaseInfoField = standardCaseFieldKeys.some((fieldKey) =>
    canEditCaseInfoField(fieldKey),
  );
  const refreshCaseAuditEvents = useCallback(async (caseId: string) => {
    const { data, error } = await supabaseBrowser
      .from("case_audit_events")
      .select(
        "id, case_id, actor_user_id, actor_name, actor_email, actor_role, event_type, field_key, field_label, old_value, new_value, source, metadata, created_at",
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .returns<CaseAuditEvent[]>();

    if (error) {
      console.error("[case-audit] Error loading audit events", {
        caseId,
        message: error.message,
        error,
      });
      return;
    }

    setAuditEvents(data ?? []);
  }, []);

  const refreshAircallCalls = useCallback(async (caseId: string) => {
    const { data, error } = await supabaseBrowser
      .from("aircall_calls")
      .select(
        "id, aircall_call_id, case_id, customer_id, crm_user_id, aircall_user_id, aircall_user_name, aircall_user_email, direction, phone_number, customer_phone, aircall_number_id, aircall_number, status, result, started_at, answered_at, ended_at, duration_seconds, recording_url, asset_url, voicemail_url, tags, notes, created_at, updated_at",
      )
      .eq("case_id", caseId)
      .order("started_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .returns<AircallCallRecord[]>();

    if (error) {
      console.error("[aircall] Error loading calls", {
        caseId,
        message: error.message,
        error,
      });
      return;
    }

    setAircallCalls(data ?? []);
  }, []);

  const refreshWhatsappNotifications = useCallback(async () => {
    if (!agentSession.id) {
      setWhatsappNotificationCases([]);
      setWhatsappPendingCount(0);
      return;
    }

    const searchParams = new URLSearchParams({
      agentId: agentSession.id,
      channel: "WHATSAPP",
      openOnly: "true",
    });
    const response = await fetch(`/api/notifications/cases?${searchParams}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as WhatsappNotificationsResponse;

    if (!response.ok) {
      throw new Error(payload.error || "No se pudieron cargar casos WhatsApp.");
    }

    setWhatsappNotificationCases(payload.cases ?? []);
    setWhatsappPendingCount(
      (payload.summary?.red ?? 0) + (payload.summary?.blue ?? 0),
    );
  }, [agentSession.id]);

  const loadAiHistorySummary = useCallback(
    async (caseId: string) => {
      if (!agentSession.id || !canViewAiCaseSummary) return;

      setIsAiHistoryLoading(true);
      setAiHistoryError(null);

      try {
        const searchParams = new URLSearchParams({
          crmUserId: agentSession.id,
        });
        const response = await fetch(
          `/api/cases/${caseId}/ai-history-summary?${searchParams}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as CaseAiHistoryResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "No se pudo cargar el resumen IA.");
        }

        setAiHistoryPayload(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setAiHistoryError(message);
        console.error("[case-ai-history] UI load error", {
          caseId,
          message,
          error,
        });
      } finally {
        setIsAiHistoryLoading(false);
      }
    },
    [agentSession.id, canViewAiCaseSummary],
  );

  const generateAiHistorySummary = useCallback(async () => {
    if (!selectedCaseId || !agentSession.id) return;

    setIsAiHistoryGenerating(true);
    setAiHistoryError(null);

    try {
      const response = await fetch(
        `/api/cases/${selectedCaseId}/ai-history-summary`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ crmUserId: agentSession.id }),
        },
      );
      const payload = (await response.json()) as CaseAiHistoryResponse;

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo actualizar el resumen IA.");
      }

      setAiHistoryPayload(payload);

      if (!payload.ok && !payload.aiConfigured) {
        setAiHistoryError(payload.reason || "IA no configurada.");
        toast.info("IA no configurada. Se mantiene visible el historial.");
        return;
      }

      if (!payload.ok) {
        throw new Error(payload.error || payload.reason || "No se pudo actualizar el resumen IA.");
      }

      toast.success("Resumen IA actualizado");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAiHistoryError(message);
      toast.error(`Error generando resumen IA: ${message}`);
      console.error("[case-ai-history] UI generate error", {
        caseId: selectedCaseId,
        message,
        error,
      });
    } finally {
      setIsAiHistoryGenerating(false);
    }
  }, [agentSession.id, selectedCaseId, toast]);

  useEffect(() => {
    function handleGlobalSearch(event: Event) {
      const nextValue =
        event instanceof CustomEvent && typeof event.detail === "string"
          ? event.detail
          : "";
      setQuery(nextValue);
    }

    window.addEventListener("cases-global-search", handleGlobalSearch);

    return () => {
      window.removeEventListener("cases-global-search", handleGlobalSearch);
    };
  }, []);

  useEffect(() => {
    if (selectedCaseId) {
      window.localStorage.setItem("casesConsoleSelectedCaseId", selectedCaseId);
    }
  }, [selectedCaseId]);

  useEffect(() => {
    if (workTab !== "ai" || !selectedCaseId || !canViewAiCaseSummary) return;

    const timeoutId = window.setTimeout(() => {
      void loadAiHistorySummary(selectedCaseId);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canViewAiCaseSummary, loadAiHistorySummary, selectedCaseId, workTab]);

  useEffect(() => {
    if (!selectedCaseId) return;

    function handleAuditRefresh() {
      void refreshCaseAuditEvents(selectedCaseId);
    }

    const timeoutId = window.setTimeout(() => {
      void refreshCaseAuditEvents(selectedCaseId);
    }, 0);
    window.addEventListener("case-audit-refresh", handleAuditRefresh);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("case-audit-refresh", handleAuditRefresh);
    };
  }, [refreshCaseAuditEvents, selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId || !canViewCallHistory) {
      return;
    }

    const refreshTimeout = window.setTimeout(() => {
      void refreshAircallCalls(selectedCaseId);
    }, 0);

    const channel = supabaseBrowser
      .channel(`case-aircall-${selectedCaseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "aircall_calls",
          filter: `case_id=eq.${selectedCaseId}`,
        },
        () => {
          void refreshAircallCalls(selectedCaseId);
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimeout);
      void supabaseBrowser.removeChannel(channel);
    };
  }, [canViewCallHistory, refreshAircallCalls, selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return;

    let isMounted = true;

    async function pollMessages() {
      try {
        const response = await fetch(`/api/cases/${selectedCaseId}/messages`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as MessagesResponse;

        if (!response.ok || !payload.ok || !payload.messages || !isMounted) {
          return;
        }

        setMessageItems((currentMessages) =>
          mergeMessages(currentMessages, payload.messages ?? []),
        );
      } catch (error) {
        console.error("[cases-console] Error polling selected case messages", {
          caseId: selectedCaseId,
          message: error instanceof Error ? error.message : String(error),
          error,
        });
      }
    }

    const intervalId = window.setInterval(pollMessages, 60000);
    window.addEventListener("case-messages-refresh", pollMessages);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("case-messages-refresh", pollMessages);
    };
  }, [selectedCaseId]);

  useEffect(() => {
    const selectedArea = caseItems.find((caseItem) => caseItem.id === selectedCaseId)?.area;
    if (!selectedArea) {
      void Promise.resolve().then(() => setAreaLayoutTab(null));
      return;
    }
    const area = selectedArea;

    let isMounted = true;
    async function loadAreaLayout() {
      const response = await fetch(`/api/case-layouts/${encodeURIComponent(area)}`, {
        cache: "no-store",
      });
      if (response.status === 404) {
        if (isMounted) setAreaLayoutTab(null);
        return;
      }
      const layout = (await response.json()) as ResolvedCaseAreaLayout & { error?: string };
      if (!response.ok) throw new Error(layout.error || "No se pudo cargar el layout del área.");

      const definitionsByKey = new Map(
        layout.fieldDefinitions.map((definition) => [definition.field_key, definition]),
      );
      const fields = [...layout.fields]
        .sort((left, right) => left.order - right.order)
        .flatMap((configuredField) => {
          const definition = definitionsByKey.get(configuredField.fieldKey);
          if (!definition) return [];
          return [{
            id: `${layout.id}:${definition.id}`,
            section_id: layout.id,
            field_definition_id: definition.id,
            sort_order: configuredField.order,
            column_span: 1,
            is_readonly: !configuredField.editable,
            field_definition: {
              ...definition,
              label: configuredField.label || definition.label,
              is_required: configuredField.required,
            },
          }];
        });

      if (isMounted) {
        setAreaLayoutTab({
          id: layout.id,
          tab_key: `area:${layout.area}`,
          label: layout.name,
          sort_order: 0,
          is_active: layout.is_active,
          sections: [{
            id: layout.id,
            tab_id: layout.id,
            label: layout.name,
            sort_order: 0,
            is_active: true,
            fields,
          }],
        });
      }
    }

    void loadAreaLayout().catch((error) => {
      console.error("[cases-console] Error loading area layout", error);
      if (isMounted) setAreaLayoutTab(null);
    });
    return () => { isMounted = false; };
  }, [caseItems, selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return;

    let isMounted = true;

    async function loadAttachments() {
      try {
        const response = await fetch(`/api/cases/${selectedCaseId}/attachments`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as AttachmentsResponse;

        if (!response.ok || !payload.ok || !isMounted) return;

        setAttachmentItems(payload.attachments ?? []);
      } catch (error) {
        console.error("[cases-console] Error loading case attachments", {
          caseId: selectedCaseId,
          message: error instanceof Error ? error.message : String(error),
          error,
        });
      }
    }

    loadAttachments();
    const intervalId = window.setInterval(loadAttachments, 60000);
    window.addEventListener("case-attachments-refresh", loadAttachments);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("case-attachments-refresh", loadAttachments);
    };
  }, [selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return;

    let isMounted = true;

    async function loadCaseMetadata() {
      const [layoutResult, valuesResult] = await Promise.all([
        supabaseBrowser
          .from("case_layout_tabs")
          .select(
            "id, tab_key, label, sort_order, is_active, created_at, sections:case_layout_sections(id, tab_id, label, sort_order, is_active, fields:case_layout_fields(id, section_id, field_definition_id, sort_order, column_span, is_readonly, field_definition:case_field_definitions(id, field_key, label, field_type, description, is_required, is_active, picklist_values, default_value, created_at, updated_at)))",
          )
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .returns<CaseLayoutTabWithSections[]>(),
        supabaseBrowser
          .from("case_custom_values")
          .select("*")
          .eq("case_id", selectedCaseId)
          .returns<CaseCustomValue[]>(),
      ]);

      if (!isMounted) return;

      if (layoutResult.error) {
        console.error("[case-metadata] Error loading layout", {
          caseId: selectedCaseId,
          message: layoutResult.error.message,
          error: layoutResult.error,
        });
        return;
      }

      if (valuesResult.error) {
        console.error("[case-metadata] Error loading custom values", {
          caseId: selectedCaseId,
          message: valuesResult.error.message,
          error: valuesResult.error,
        });
        return;
      }

      const activeTabs = (layoutResult.data ?? [])
        .filter((tab) => !tab.is_system)
        .map((tab) => ({
          ...tab,
          sections: (tab.sections ?? [])
            .filter((section) => section.is_active !== false)
            .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
            .map((section) => ({
              ...section,
              fields: (section.fields ?? [])
                .filter((layoutField) => layoutField.field_definition?.is_active !== false)
                .sort(
                  (left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0),
                ),
            })),
        }))
        .filter((tab) => tab.sections.some((section) => section.fields.length > 0));

      setLayoutTabs(activeTabs);
      setCustomValues(valuesResult.data ?? []);
      setCustomFieldErrors({});
    }

    void loadCaseMetadata();
    window.addEventListener("case-custom-values-refresh", loadCaseMetadata);

    return () => {
      isMounted = false;
      window.removeEventListener("case-custom-values-refresh", loadCaseMetadata);
    };
  }, [selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return;

    let isMounted = true;

    async function loadCaseRecord() {
      const { data, error } = await supabaseBrowser
        .from("cases")
        .select(
          "id, case_number, customer_id, subject, channel, contact_type, status, lifecycle_status, routing_status, priority, area, category, product, subproduct, is_edge_case, assigned_agent_id, assigned_to, assigned_at, contact_name, contact_email, contact_phone, created_at, updated_at, closed_at, resolution_type, ai_summary, ai_category, ai_sentiment, ai_confidence, ai_resolution, customer:customers(name, email, phone, public_id)",
        )
        .eq("id", selectedCaseId)
        .single<ConsoleCaseRecord>();

      if (error || !data || !isMounted) {
        if (error) {
          console.error("[cases-console] Error loading realtime case record", {
            caseId: selectedCaseId,
            message: error.message,
            error,
          });
        }
        return;
      }

      setCaseItems((currentCases) =>
        currentCases.map((caseItem) =>
          caseItem.id === selectedCaseId ? { ...caseItem, ...data } : caseItem,
        ),
      );
    }

    const refreshMessages = () => {
      window.dispatchEvent(new CustomEvent("case-messages-refresh"));
      void loadCaseRecord();
      window.dispatchEvent(new CustomEvent("case-whatsapp-notifications-refresh"));
    };
    const refreshAttachments = () => {
      window.dispatchEvent(new CustomEvent("case-attachments-refresh"));
    };
    const refreshCase = () => {
      void loadCaseRecord();
      window.dispatchEvent(new CustomEvent("case-whatsapp-notifications-refresh"));
    };

    console.info("[realtime] subscribed", {
      caseId: selectedCaseId,
      channel: `case-workspace-${selectedCaseId}`,
    });

    const channel = supabaseBrowser
      .channel(`case-workspace-${selectedCaseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `case_id=eq.${selectedCaseId}`,
        },
        (payload) => {
          console.info("[realtime] message change", {
            caseId: selectedCaseId,
            eventType: payload.eventType,
          });
          refreshMessages();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_media_attachments",
          filter: `case_id=eq.${selectedCaseId}`,
        },
        (payload) => {
          console.info("[realtime] attachment change", {
            caseId: selectedCaseId,
            table: "whatsapp_media_attachments",
            eventType: payload.eventType,
          });
          refreshMessages();
          refreshAttachments();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_attachments",
          filter: `case_id=eq.${selectedCaseId}`,
        },
        (payload) => {
          console.info("[realtime] attachment change", {
            caseId: selectedCaseId,
            table: "message_attachments",
            eventType: payload.eventType,
          });
          refreshAttachments();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cases",
          filter: `id=eq.${selectedCaseId}`,
        },
        (payload) => {
          console.info("[realtime] case change", {
            caseId: selectedCaseId,
            eventType: payload.eventType,
          });
          refreshCase();
        },
      )
      .subscribe((status) => {
        console.info("[realtime] case subscription status", status);
        if (status === "SUBSCRIBED") {
          console.info("[realtime] status SUBSCRIBED", {
            caseId: selectedCaseId,
            channel: `case-workspace-${selectedCaseId}`,
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[realtime] case subscription error", {
            caseId: selectedCaseId,
            channel: `case-workspace-${selectedCaseId}`,
            status,
          });
        }
      });

    return () => {
      isMounted = false;
      void supabaseBrowser.removeChannel(channel);
      console.info("[realtime] unsubscribed", { caseId: selectedCaseId });
    };
  }, [selectedCaseId]);

  useEffect(() => {
    if (!agentSession.id) return;

    let isMounted = true;

    async function loadNotifications() {
      try {
        await refreshWhatsappNotifications();
      } catch (error) {
        if (!isMounted) return;
        console.error("[cases-console] Error loading WhatsApp notifications", {
          message: error instanceof Error ? error.message : String(error),
          error,
        });
      }
    }

    function handleRefresh() {
      void loadNotifications();
    }

    loadNotifications();
    window.addEventListener("case-whatsapp-notifications-refresh", handleRefresh);
    const intervalId = window.setInterval(loadNotifications, 60000);

    return () => {
      isMounted = false;
      window.removeEventListener(
        "case-whatsapp-notifications-refresh",
        handleRefresh,
      );
      window.clearInterval(intervalId);
    };
  }, [agentSession.id, refreshWhatsappNotifications]);

  useEffect(() => {
    if (!agentSession.id) return;

    let isMounted = true;

    function refreshWidget() {
      if (!isMounted) return;
      window.dispatchEvent(new CustomEvent("case-whatsapp-notifications-refresh"));
    }

    const messagesChannel = supabaseBrowser
      .channel(`case-whatsapp-widget-messages-${agentSession.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const record = (payload.new || payload.old || {}) as {
            channel?: string | null;
          };

          if (record.channel?.toUpperCase() === "WHATSAPP") {
            console.info("[realtime] message change", {
              scope: "whatsapp-widget",
            });
            refreshWidget();
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.info("[realtime] subscribed case", {
            scope: "whatsapp-widget",
            channel: `case-whatsapp-widget-messages-${agentSession.id}`,
          });
        }
      });
    const casesChannel = supabaseBrowser
      .channel(`case-whatsapp-widget-cases-${agentSession.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cases",
        },
        () => {
          console.info("[realtime] case change", {
            scope: "whatsapp-widget",
          });
          refreshWidget();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.info("[realtime] subscribed case", {
            scope: "whatsapp-widget",
            channel: `case-whatsapp-widget-cases-${agentSession.id}`,
          });
        }
      });

    return () => {
      isMounted = false;
      void supabaseBrowser.removeChannel(messagesChannel);
      void supabaseBrowser.removeChannel(casesChannel);
      console.info("[realtime] unsubscribed", {
        scope: "whatsapp-widget",
      });
    };
  }, [agentSession.id]);

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

    messageItems.forEach((message) => {
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
  }, [messageItems]);
  const messagesByCase = useMemo(() => {
    const groupedMessages = new Map<string, ConsoleMessageRecord[]>();

    messageItems.forEach((message) => {
      if (!message.case_id) return;

      const caseId = String(message.case_id);
      const current = groupedMessages.get(caseId) ?? [];
      current.push(message);
      groupedMessages.set(
        caseId,
        current.sort(
          (a, b) =>
            new Date(a.created_at ?? 0).getTime() -
            new Date(b.created_at ?? 0).getTime(),
        ),
      );
    });

    return groupedMessages;
  }, [messageItems]);
  const filteredCases = caseItems
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

      if (
        selectedView === "mine" &&
        (caseItem.assigned_agent_id !== agentSession.id ||
          lifecycleStatus === "CLOSED")
      ) {
        return false;
      }
      if (selectedView === "open" && lifecycleStatus === "CLOSED") return false;
      if (
        selectedView === "unassigned" &&
        routingStatus !== "UNASSIGNED" &&
        caseItem.assigned_agent_id
      ) {
        return false;
      }
      if (selectedView === "ai" && routingStatus !== "AI_HANDLING") return false;
      if (selectedView === "human" && routingStatus !== "HUMAN_REQUIRED") {
        return false;
      }
      if (selectedView === "closed" && lifecycleStatus !== "CLOSED") return false;
      if (selectedView === "whatsapp" && caseItem.channel !== "WHATSAPP") {
        return false;
      }
      if (selectedView === "email" && caseItem.channel !== "GMAIL") return false;
      if (
        statusFilter &&
        lifecycleStatus !== statusFilter &&
        routingStatus !== statusFilter
      ) {
        return false;
      }
      if (priorityFilter && caseItem.priority !== priorityFilter) return false;
      if (channelFilter && caseItem.channel !== channelFilter) return false;

      const searchableText = [
        caseItem.subject,
        caseItem.case_number,
        getCustomerLabel(caseItem),
        caseItem.customer?.email,
        caseItem.customer?.phone,
        caseItem.contact_email,
        caseItem.contact_phone,
        getAgentLabel(caseItem, agentNames),
        caseItem.status,
        caseItem.lifecycle_status,
        caseItem.routing_status,
        caseItem.priority,
        caseItem.channel,
        getMessagePreview(latestMessageByCase.get(caseItem.id)),
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
  const selectedCase =
    filteredCases.find((caseItem) => caseItem.id === selectedCaseId) ??
    filteredCases[0] ??
    null;
  const selectedCaseMessages = selectedCase
    ? messagesByCase.get(selectedCase.id) ?? []
    : [];
  const selectedWhatsappMessages = selectedCaseMessages.filter((message) => {
    const channel = message.channel?.toUpperCase() ?? "";

    return !channel || channel === "WHATSAPP" || channel === "AI";
  });
  const selectedLatestMessage = selectedCase
    ? latestMessageByCase.get(selectedCase.id)
    : undefined;
  const selectedLastActivity = selectedCase
    ? getLastActivity(selectedCase, selectedLatestMessage)
    : null;
  const selectedDaysWithoutOperation = getDaysWithoutOperation(selectedLastActivity);
  const selectedCaseSla = selectedCase
    ? computeCaseSla(selectedCase, selectedCaseMessages)
    : null;
  const selectedLifecycleStatus = selectedCase
    ? normalizeLifecycleStatus(selectedCase.lifecycle_status, selectedCase.status)
    : "NEW";
  const selectedRoutingStatus = selectedCase
    ? normalizeRoutingStatus({
        routingStatus: selectedCase.routing_status,
        status: selectedCase.status,
        assignedAgentId: selectedCase.assigned_agent_id,
      })
    : "UNASSIGNED";
  const workAreaGridClass =
    isQueueOpen && isRightPanelOpen
      ? "grid min-h-0 flex-1 items-stretch overflow-hidden gap-2 p-2 xl:grid-cols-[230px_280px_minmax(0,1fr)_310px]"
      : isQueueOpen
        ? "grid min-h-0 flex-1 items-stretch overflow-hidden gap-2 p-2 xl:grid-cols-[230px_280px_minmax(0,1fr)_30px]"
        : isRightPanelOpen
          ? "grid min-h-0 flex-1 items-stretch overflow-hidden gap-2 p-2 xl:grid-cols-[280px_minmax(0,1fr)_310px]"
          : "grid min-h-0 flex-1 items-stretch overflow-hidden gap-2 p-2 xl:grid-cols-[280px_minmax(0,1fr)_30px]";
  const selectedMacro =
    activeMacros.find((macro) => macro.id === selectedMacroId) ?? null;

  useEffect(() => {
    if (workTab !== "whatsapp") return;

    conversationEndRef.current?.scrollIntoView({ block: "end" });
  }, [workTab, selectedCase?.id, selectedWhatsappMessages.length]);

  function updateLocalCase(caseId: string, values: Partial<ConsoleCaseRecord>) {
    setCaseItems((currentCases) =>
      currentCases.map((caseItem) =>
        caseItem.id === caseId ? { ...caseItem, ...values } : caseItem,
      ),
    );
  }

  async function refreshCaseMessages(caseId: string) {
    const response = await fetch(`/api/cases/${caseId}/messages`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as MessagesResponse;

    if (!response.ok || !payload.ok || !payload.messages) {
      throw new Error("No se pudieron refrescar los mensajes del caso.");
    }

    setMessageItems((currentMessages) =>
      mergeMessages(currentMessages, payload.messages ?? []),
    );
  }

  async function refreshCaseAttachments(caseId: string) {
    const response = await fetch(`/api/cases/${caseId}/attachments`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as AttachmentsResponse;

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "No se pudieron refrescar los adjuntos.");
    }

    setAttachmentItems(payload.attachments ?? []);
  }

  async function recordAuditEvents(events: CaseAuditEventInput[]) {
    if (!selectedCase || events.length === 0) {
      return;
    }

    try {
      await createCaseAuditEvents(supabaseBrowser, events);
      await refreshCaseAuditEvents(selectedCase.id);
    } catch (error) {
      console.error("[case-audit] Error creating audit events", {
        caseId: selectedCase.id,
        message: error instanceof Error ? error.message : String(error),
        error,
      });
    }
  }

  function getAssignmentAuditMetadata(fieldKey: string, newValue: unknown) {
    if (fieldKey !== "assigned_agent_id" && fieldKey !== "assigned_to") {
      return null;
    }

    const oldAssignedAgentId = selectedCase?.assigned_agent_id || null;
    const newAssignedAgentId =
      fieldKey === "assigned_agent_id"
        ? formatAuditValue(newValue)
        : oldAssignedAgentId;

    return {
      old_assigned_agent_id: oldAssignedAgentId,
      old_assigned_agent_name: oldAssignedAgentId
        ? agentNames.get(oldAssignedAgentId) || selectedCase?.assigned_to || null
        : null,
      new_assigned_agent_id: newAssignedAgentId,
      new_assigned_agent_name: newAssignedAgentId
        ? agentNames.get(newAssignedAgentId) || null
        : fieldKey === "assigned_to"
          ? formatAuditValue(newValue)
          : null,
    };
  }

  async function saveCustomLayoutFields(
    event: FormEvent<HTMLFormElement>,
    tab: CaseLayoutTabWithSections,
  ) {
    event.preventDefault();
    if (!selectedCase || !canEditCaseFields || pendingAction) return;

    const formData = new FormData(event.currentTarget);
    const fields = tab.sections.flatMap((section) =>
      section.fields
        .map((layoutField) => layoutField.field_definition)
        .filter(
          (field): field is CaseFieldDefinition =>
            field !== null && canViewCaseInfoField(field.field_key),
        ),
    );
    const readonlyFieldIds = new Set(
      tab.sections.flatMap((section) =>
        section.fields
          .filter((layoutField) => layoutField.is_readonly)
          .map((layoutField) => layoutField.field_definition_id),
      ),
    );
    const editableFields = fields.filter((field) =>
      canEditCaseInfoField(field.field_key) && !readonlyFieldIds.has(field.id),
    );
    const nextErrors: Record<string, string> = {};
    const standardCaseUpdates: Partial<ConsoleCaseRecord> = {};
    const customUpdates = editableFields
      .filter((field) => !field.is_standard)
      .map((field) => {
        const fieldName = `custom:${field.id}`;
        const rawValue = formData.get(fieldName);
        const validationError = validateCustomFieldValue({ field, rawValue });

        if (validationError) {
          nextErrors[field.id] = validationError;
        }

        const payload = buildCustomValuePayload({
          caseId: selectedCase.id,
          field,
          rawValue,
        });

        return {
          field,
          payload,
          oldValue: getCustomValueForField(
            field,
            customValues.find((value) => value.field_definition_id === field.id),
          ),
          newValue: getCustomPayloadAuditValue(payload),
        };
      });
    const customPayloads = customUpdates.map((update) => update.payload);

    editableFields
      .filter((field) => field.is_standard)
      .forEach((field) => {
      const fieldName = `custom:${field.id}`;
      const rawValue = formData.get(fieldName);
      const validationError = validateCustomFieldValue({ field, rawValue });

      if (validationError) {
        nextErrors[field.id] = validationError;
      }

      const stringValue = typeof rawValue === "string" ? rawValue.trim() : "";
      const value =
        field.field_type === "boolean"
          ? rawValue === "on" || rawValue === "true"
          : stringValue || null;

      if (field.field_key in selectedCase) {
        (standardCaseUpdates as Record<string, unknown>)[field.field_key] = value;
      }
    });

    setCustomFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("✗ Revisa los campos obligatorios o inválidos");
      return;
    }

    setPendingAction("custom-fields");
    let savedCustomValues: CaseCustomValue[] = [];

    if (Object.keys(standardCaseUpdates).length > 0) {
      const { error } = await supabaseBrowser
        .from("cases")
        .update({
          ...standardCaseUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedCase.id);

      if (error) {
        console.error("[case-metadata] Error saving standard values", {
          caseId: selectedCase.id,
          tabKey: tab.tab_key,
          message: error.message,
          error,
        });
        toast.error(`✗ ${error.message}`);
        setPendingAction(null);
        return;
      }

      updateLocalCase(selectedCase.id, standardCaseUpdates);
      const auditEventsToCreate = buildCaseFieldAuditEvents(
        Object.entries(standardCaseUpdates).map(([fieldKey, newValue]) => ({
          caseId: selectedCase.id,
          actor: auditActor,
          fieldKey,
          fieldLabel: caseAuditFieldLabels[fieldKey] ?? fieldKey,
          oldValue: (selectedCase as unknown as Record<string, unknown>)[fieldKey],
          newValue,
          source: "case_detail",
          metadata: getAssignmentAuditMetadata(fieldKey, newValue),
        })),
      );
      await recordAuditEvents(auditEventsToCreate);
    }

    if (customPayloads.length > 0) {
      const { data, error } = await supabaseBrowser
        .from("case_custom_values")
        .upsert(customPayloads, {
          onConflict: "case_id,field_definition_id",
        })
        .select("*")
        .returns<CaseCustomValue[]>();

      if (error) {
        console.error("[case-metadata] Error saving custom values", {
          caseId: selectedCase.id,
          tabKey: tab.tab_key,
          message: error.message,
          error,
        });
        toast.error(`✗ ${error.message}`);
        setPendingAction(null);
        return;
      }

      savedCustomValues = data ?? [];
      const auditEventsToCreate = buildCaseFieldAuditEvents(
        customUpdates.map((update) => ({
          caseId: selectedCase.id,
          actor: auditActor,
          eventType: "case_custom_field_updated",
          fieldKey: update.field.field_key,
          fieldLabel: update.field.label,
          oldValue: update.oldValue,
          newValue: update.newValue,
          source: "case_detail",
          metadata: {
            field_definition_id: update.field.id,
            field_type: update.field.field_type,
          },
        })),
      );
      await recordAuditEvents(auditEventsToCreate);
    }

    setCustomValues((currentValues) => {
      const byField = new Map(
        currentValues.map((value) => [value.field_definition_id, value]),
      );

      savedCustomValues.forEach((value) => {
        byField.set(value.field_definition_id, value);
      });

      return [...byField.values()];
    });
    window.dispatchEvent(new CustomEvent("case-custom-values-refresh"));
    setIsCustomLayoutDirty(false);
    toast.success("✓ Valores guardados correctamente");
    setPendingAction(null);
  }

  async function refreshCaseRecord(caseId: string) {
    const { data, error } = await supabaseBrowser
      .from("cases")
      .select(
        "id, case_number, customer_id, subject, channel, contact_type, status, lifecycle_status, routing_status, priority, area, category, product, subproduct, is_edge_case, assigned_agent_id, assigned_to, assigned_at, contact_name, contact_email, contact_phone, created_at, updated_at, closed_at, resolution_type, ai_summary, ai_category, ai_sentiment, ai_confidence, ai_resolution, customer:customers(name, email, phone, public_id)",
      )
      .eq("id", caseId)
      .single<ConsoleCaseRecord>();

    if (error || !data) {
      throw new Error(error?.message || "No se pudo refrescar el caso.");
    }

    updateLocalCase(caseId, data);
  }

  async function startAircallCall(caseItem: ConsoleCaseRecord) {
    if (!canUseAircall) {
      toast.error("No tienes permiso para usar Aircall.");
      return;
    }

    const phoneNumber = normalizeAircallPhone(getCustomerPhone(caseItem));
    if (!phoneNumber) {
      toast.error("Este caso no tiene teléfono para llamar.");
      return;
    }

    if (!agentSession.id) {
      toast.error("No se encontró usuario CRM en la sesión demo.");
      return;
    }

    setPendingAction("aircall");
    try {
      const response = await fetch("/api/aircall/dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseItem.id,
          phone_number: phoneNumber,
          crm_user_id: agentSession.id,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        normalized_phone_number?: string;
        pending_context_id?: string;
      };

      if (!response.ok || !payload.ok || !payload.normalized_phone_number) {
        throw new Error(payload.error || "No se pudo preparar la llamada Aircall.");
      }

      window.dispatchEvent(
        new CustomEvent("aircall-dial-request", {
          detail: {
            phoneNumber: payload.normalized_phone_number,
            pendingContextId: payload.pending_context_id,
          },
        }),
      );
      toast.success("Aircall preparado para llamar");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error iniciando Aircall");
    } finally {
      setPendingAction(null);
    }
  }

  async function loadActiveMacros() {
    const { data, error } = await supabaseBrowser
      .from("macros")
      .select(
        "id, name, description, macro_actions(id, action_type, sort_order, payload)",
      )
      .eq("target_object", "CASE")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<ActiveMacroRecord[]>();

    if (error) throw new Error(error.message);

    const macros = data ?? [];
    setActiveMacros(macros);
    setSelectedMacroId((currentMacroId) => currentMacroId || macros[0]?.id || "");
  }

  async function openMacroModal() {
    if (!canExecuteMacros) return;

    setIsMacroModalOpen(true);
    try {
      await loadActiveMacros();
    } catch (error) {
      console.error("[cases-console] Error loading active macros", {
        message: error instanceof Error ? error.message : String(error),
        error,
      });
      toast.error("✗ No se pudieron cargar las macros");
    }
  }

  async function executeSelectedMacro() {
    if (!selectedCase || !selectedMacroId || pendingAction) return;

    setPendingAction("macro");

    try {
      const response = await fetch(`/api/macros/${selectedMacroId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetObject: "CASE",
          targetId: selectedCase.id,
          executedBy: agentSession.name,
        }),
      });
      const payload = (await response.json()) as MacroRunResponse;

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo ejecutar la macro.");
      }

      await refreshCaseRecord(selectedCase.id);
      await refreshCaseMessages(selectedCase.id);
      await refreshCaseAttachments(selectedCase.id);
      await refreshWhatsappNotifications();
      setIsMacroModalOpen(false);
      toast.success(
        payload.ok
          ? "✓ Macro ejecutada correctamente"
          : "ℹ Macro ejecutada con observaciones",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.error("[cases-console] Error executing macro", {
        caseId: selectedCase.id,
        macroId: selectedMacroId,
        message,
        error,
      });
      toast.error(`✗ ${message}`);
    } finally {
      setPendingAction(null);
    }
  }

  async function updateCase(
    values: Partial<ConsoleCaseRecord>,
    successMessage: string,
  ) {
    if (!selectedCase) return false;

    const updatedAt = new Date().toISOString();
    const { error } = await supabaseBrowser
      .from("cases")
      .update({
        ...values,
        updated_at: updatedAt,
      })
      .eq("id", selectedCase.id);

    if (error) {
      console.error("[cases-console] Error updating case", {
        caseId: selectedCase.id,
        message: error.message,
        supabaseError: error,
      });
      toast.error("✗ No se pudieron guardar los cambios");
      return false;
    }

    updateLocalCase(selectedCase.id, { ...values, updated_at: updatedAt });
    const auditEventsToCreate = buildCaseFieldAuditEvents(
      Object.entries(values)
        .filter(([fieldKey]) => fieldKey !== "updated_at")
        .map(([fieldKey, newValue]) => ({
          caseId: selectedCase.id,
          actor: auditActor,
          fieldKey,
          fieldLabel: caseAuditFieldLabels[fieldKey] ?? fieldKey,
          oldValue: (selectedCase as unknown as Record<string, unknown>)[fieldKey],
          newValue,
          source: "case_detail",
          metadata: getAssignmentAuditMetadata(fieldKey, newValue),
        })),
    );
    await recordAuditEvents(auditEventsToCreate);
    toast.success(successMessage);
    void refreshWhatsappNotifications().catch((refreshError) => {
      console.error("[cases-console] Error refreshing WhatsApp notifications", {
        message:
          refreshError instanceof Error
            ? refreshError.message
            : String(refreshError),
        error: refreshError,
      });
    });
    return true;
  }

  async function changeLifecycleStatus(lifecycleStatus: LifecycleStatus) {
    if (!canEditCaseFields || !selectedCase || pendingAction) return;

    setPendingAction("status");
    const values: Partial<ConsoleCaseRecord> = {
      lifecycle_status: lifecycleStatus,
    };

    if (lifecycleStatus === "CLOSED") {
      values.status = "CLOSED";
      values.closed_at = new Date().toISOString();
      values.resolution_type =
        selectedCase.resolution_type || "HUMAN_RESOLVED";
    }

    await updateCase(values, "✓ Cambios guardados correctamente");
    setPendingAction(null);
  }

  async function assignToMe() {
    if (!selectedCase || !canTakeCases || !agentSession.id || pendingAction) {
      return;
    }

    setPendingAction("assign-me");
    const assignedAt = new Date().toISOString();
    await updateCase(
      {
        status: "ASSIGNED",
        lifecycle_status: normalizeLifecycleStatus(
          selectedCase.lifecycle_status,
          selectedCase.status,
        ),
        routing_status: "ASSIGNED",
        assigned_agent_id: agentSession.id,
        assigned_to: agentSession.name,
        assigned_at: assignedAt,
      },
      "✓ Caso asignado correctamente",
    );
    setPendingAction(null);
  }

  async function closeCase() {
    if (!selectedCase || !canCloseCases || pendingAction) return;

    setPendingAction("close");
    await updateCase(
      {
        status: "CLOSED",
        lifecycle_status: "CLOSED",
        closed_at: new Date().toISOString(),
        resolution_type: selectedCase.resolution_type || "HUMAN_RESOLVED",
      },
      "✓ Caso cerrado correctamente",
    );
    setPendingAction(null);
  }

  async function saveTicketForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCase || !canEditCaseFields || pendingAction) return;

    const formData = new FormData(event.currentTarget);
    const nextLifecycleStatus = String(
      formData.get("lifecycle_status") || selectedLifecycleStatus,
    ) as LifecycleStatus;
    const nextRoutingStatus = String(
      formData.get("routing_status") || selectedRoutingStatus,
    );

    setPendingAction("status");
    const values: Partial<ConsoleCaseRecord> = {};

    if (formData.has("subject")) {
      values.subject = String(formData.get("subject") || "");
    }
    if (formData.has("lifecycle_status")) {
      values.lifecycle_status = nextLifecycleStatus;
      values.status =
        nextLifecycleStatus === "CLOSED" ? "CLOSED" : selectedCase.status;
    }
    if (formData.has("routing_status")) {
      values.routing_status = nextRoutingStatus;
      if (nextLifecycleStatus !== "CLOSED") {
        values.status =
          nextRoutingStatus === "UNASSIGNED"
            ? selectedCase.status
            : nextRoutingStatus;
      }
    }
    if (formData.has("priority")) {
      values.priority = String(formData.get("priority") || "") || null;
    }
    if (formData.has("area")) {
      values.area = String(formData.get("area") || "") || null;
    }
    if (formData.has("category")) {
      values.category = String(formData.get("category") || "") || null;
    }
    if (formData.has("contact_type")) {
      values.contact_type = String(formData.get("contact_type") || "") || null;
    }
    if (formData.has("assigned_agent_id")) {
      const assignedAgentId = String(formData.get("assigned_agent_id") || "");
      values.assigned_agent_id = assignedAgentId || null;
      values.assigned_to =
        agentNames.get(assignedAgentId) || selectedCase.assigned_to;
      if (assignedAgentId && assignedAgentId !== selectedCase.assigned_agent_id) {
        values.assigned_at = new Date().toISOString();
      }
    }
    if (formData.has("resolution_type")) {
      values.resolution_type =
        String(formData.get("resolution_type") || "") || null;
    }
    if (formData.has("ai_summary")) {
      values.ai_summary = String(formData.get("ai_summary") || "") || null;
    }

    if (nextLifecycleStatus === "CLOSED") {
      values.closed_at = selectedCase.closed_at || new Date().toISOString();
      values.resolution_type =
        values.resolution_type || selectedCase.resolution_type || "HUMAN_RESOLVED";
    }

    await updateCase(values, "✓ Cambios guardados correctamente");
    setPendingAction(null);
  }

  async function saveCaseInfoForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCase || !canEditCaseFields || pendingAction) return;

    const formData = new FormData(event.currentTarget);
    const nextLifecycleStatus = String(
      formData.get("lifecycle_status") || selectedLifecycleStatus,
    ) as LifecycleStatus;
    const nextRoutingStatus = String(
      formData.get("routing_status") || selectedRoutingStatus,
    );
    const nextPriority = String(
      formData.get("priority") || selectedCase.priority || "",
    );

    if (
      canEditCaseInfoField("lifecycle_status") &&
      !lifecycleStatuses.includes(nextLifecycleStatus)
    ) {
      toast.error("✗ Estado operativo inválido");
      return;
    }
    if (
      canEditCaseInfoField("routing_status") &&
      !routingStatusOptions.includes(nextRoutingStatus)
    ) {
      toast.error("✗ Estado de atención inválido");
      return;
    }
    if (
      canEditCaseInfoField("priority") &&
      (!nextPriority || !priorityOptions.includes(nextPriority))
    ) {
      toast.error("✗ La prioridad es requerida");
      return;
    }

    setPendingAction("case-info");
    const assignedAgentId = String(formData.get("assigned_agent_id") || "");
    const resolutionType = String(formData.get("resolution_type") || "");
    const values: Partial<ConsoleCaseRecord> = {};

    if (canEditCaseInfoField("subject")) {
      values.subject = String(formData.get("subject") || "");
    }
    if (canEditCaseInfoField("lifecycle_status")) {
      values.lifecycle_status = nextLifecycleStatus;
    }
    if (canEditCaseInfoField("routing_status")) {
      values.routing_status = nextRoutingStatus;
    }
    if (canEditCaseInfoField("priority")) {
      values.priority = nextPriority;
    }
    if (canEditCaseInfoField("area")) {
      values.area = String(formData.get("area") || "") || null;
    }
    if (canEditCaseInfoField("category")) {
      values.category = String(formData.get("category") || "") || null;
    }
    if (canEditCaseInfoField("contact_type")) {
      values.contact_type = String(formData.get("contact_type") || "") || null;
    }
    if (canEditCaseInfoField("assigned_agent_id")) {
      values.assigned_agent_id = assignedAgentId || null;
      values.assigned_to = assignedAgentId
        ? agentNames.get(assignedAgentId) || null
        : null;
    }
    if (canEditCaseInfoField("resolution_type")) {
      values.resolution_type = resolutionType || null;
    }

    if (
      canEditCaseInfoField("assigned_agent_id") &&
      assignedAgentId &&
      assignedAgentId !== selectedCase.assigned_agent_id
    ) {
      values.assigned_at = new Date().toISOString();
    }

    if (
      canEditCaseInfoField("lifecycle_status") &&
      nextLifecycleStatus === "CLOSED"
    ) {
      values.status = "CLOSED";
      values.closed_at = selectedCase.closed_at || new Date().toISOString();
      values.resolution_type =
        values.resolution_type || selectedCase.resolution_type || "HUMAN_RESOLVED";
    } else if (
      canEditCaseInfoField("routing_status") &&
      nextRoutingStatus !== "UNASSIGNED"
    ) {
      values.status = nextRoutingStatus;
    }

    const saved = await updateCase(values, "✓ Cambios guardados correctamente");
    if (saved) {
      setIsCaseInfoEditing(false);
    }
    setPendingAction(null);
  }

  async function sendTicketEmail(
    event: FormEvent<HTMLFormElement>,
    composerSnapshot?: TicketComposerState,
  ) {
    event.preventDefault();
    if (!selectedCase || !canRespondToCustomers || pendingAction) return;

    const currentComposer = composerSnapshot ?? ticketComposer;
    const to = currentComposer.to.trim();
    const cc = currentComposer.cc.trim();
    const bcc = currentComposer.bcc.trim();
    const subject = currentComposer.subject.trim();
    const bodyText =
      currentComposer.bodyText?.trim() ||
      currentComposer.body.trim() ||
      stripHtmlToText(currentComposer.bodyHtml || currentComposer.htmlBody || "");
    const htmlBody = currentComposer.htmlBody || currentComposer.bodyHtml || "";
    const attachments = currentComposer.attachments ?? [];

    if (!to || !isValidEmailList(to)) {
      toast.error("✗ Destinatario inválido");
      return;
    }
    if (!subject) {
      toast.error("✗ El asunto es requerido");
      return;
    }
    if (!bodyText && !htmlBody.trim()) {
      toast.error("✗ No se puede enviar un correo vacío");
      return;
    }

    setPendingAction("email");

    try {
      const response = await fetch("/api/integrations/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caseId: selectedCase.id,
          to,
          cc,
          bcc,
          subject,
          body: bodyText,
          bodyText,
          htmlBody,
          attachments,
        }),
      });
      const payload = (await response.json()) as EmailSendResponse;

      if (!response.ok || !payload.ok || !payload.message) {
        console.error("[cases-console] Error sending ticket email", {
          caseId: selectedCase.id,
          message: payload.error,
          details: payload.details,
        });
        toast.error(payload.error || "✗ No se pudo enviar el correo");
        setPendingAction(null);
        return;
      }

      setMessageItems((currentMessages) =>
        mergeMessages(currentMessages, [payload.message as ConsoleMessageRecord]),
      );
      updateLocalCase(selectedCase.id, {
        updated_at: payload.message.created_at ?? new Date().toISOString(),
      });
      try {
        await refreshCaseMessages(selectedCase.id);
        await refreshCaseAttachments(selectedCase.id);
      } catch (refreshError) {
        console.error("[cases-console] Error refreshing messages after email send", {
          caseId: selectedCase.id,
          message:
            refreshError instanceof Error
              ? refreshError.message
              : String(refreshError),
          error: refreshError,
        });
      }
      setTicketComposer((currentComposer) => ({
        ...currentComposer,
        body: "",
        bodyHtml: "",
        htmlBody: "",
        attachments: [],
      }));
      setIsTicketDraftDirty(false);
      toast.success("Correo enviado correctamente");
      setPendingAction(null);
    } catch (error) {
      console.error("[cases-console] Error calling Gmail send endpoint", {
        caseId: selectedCase.id,
        message: error instanceof Error ? error.message : String(error),
        error,
      });
      toast.error("✗ No se pudo enviar el correo");
      setPendingAction(null);
    }
  }

  async function syncTicketEmails() {
    if (pendingAction) return;

    setPendingAction("email-sync");

    try {
      const response = await fetch("/api/integrations/email/sync", {
        method: "POST",
      });
      const payload = (await response.json()) as EmailSyncResponse;

      if (!response.ok || !payload.success) {
        const errorDetail =
          payload.errors?.filter(Boolean).join("; ") ||
          payload.error ||
          "Error desconocido";

        console.error("[cases-console] Error syncing emails", {
          message: errorDetail,
        });
        toast.error(`Error sincronizando correos: ${errorDetail}`);
        return;
      }

      if (payload.errors && payload.errors.length > 0) {
        console.error("[cases-console] Email sync completed with skipped errors", {
          errors: payload.errors,
        });
      }

      if (selectedCase) {
        try {
          await refreshCaseMessages(selectedCase.id);
          await refreshCaseAttachments(selectedCase.id);
        } catch (refreshError) {
          console.error("[cases-console] Error refreshing messages after email sync", {
            caseId: selectedCase.id,
            message:
              refreshError instanceof Error
                ? refreshError.message
                : String(refreshError),
            error: refreshError,
          });
        }
      }

      toast.success(
        `Sincronización completada: ${payload.inserted ?? 0} correos nuevos, ${
          payload.skipped ?? 0
        } omitidos`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error("[cases-console] Error calling email sync endpoint", {
        message: errorMessage,
        error,
      });
      toast.error(`Error sincronizando correos: ${errorMessage}`);
    } finally {
      setPendingAction(null);
    }
  }

  function handleSelectCase(caseId: string) {
    const nextCase = caseItems.find((caseItem) => caseItem.id === caseId);

    setSelectedCaseId(caseId);
    setTicketTab("publish");
    setIsTicketDraftDirty(false);
    setIsCustomLayoutDirty(false);
    setTicketComposer(getDefaultTicketComposer(nextCase));
    setSelectedEmailMessage(null);
    setRelatedView(null);
    setIsCaseInfoEditing(false);
    setWorkTab(getDefaultWorkTab(nextCase));
    router.push(`/casos/${caseId}`);
  }

  function handleViewChange(value: ViewKey) {
    setSelectedView(value);

    const savedView = value.startsWith("saved:")
      ? savedViews.find((view) => value === `saved:${view.id}`)
      : null;

    if (savedView) {
      setQuery(savedView.filters.query);
      setStatusFilter(savedView.filters.status);
      setPriorityFilter(savedView.filters.priority);
      setChannelFilter(savedView.filters.channel);
    }
  }

  function saveCurrentView(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newViewName.trim();
    if (!name) return;

    const nextViews = [
      ...savedViews,
      {
        id: `${Date.now()}`,
        name,
        filters: {
          query,
          status: statusFilter,
          priority: priorityFilter,
          channel: channelFilter,
        },
      },
    ];

    setSavedViews(nextViews);
    setNewViewName("");
    window.localStorage.setItem("casesConsoleSavedViews", JSON.stringify(nextViews));
    toast.success("ℹ Acción completada");
  }

  async function copyQuickValue(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch (error) {
      console.error("[cases-console] Error copying quick value", {
        message: error instanceof Error ? error.message : String(error),
        error,
      });
      toast.error("✗ No se pudo copiar");
    }
  }

  return (
    <section className="relative flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden bg-[linear-gradient(135deg,var(--g66-background)_0%,var(--g66-background-soft)_100%)] text-[var(--g66-text-primary)]">
      {selectedCase ? (
        <header className="mx-2 mt-2 flex h-auto min-h-[92px] shrink-0 flex-col items-stretch justify-between gap-2 rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white/95 px-3 py-1.5 shadow-[var(--g66-shadow-card)] backdrop-blur lg:h-[92px] lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--g66-brand-blue)] text-[10px] font-black text-white shadow-[0_6px_16px_rgb(32_94_241/0.2)]">
                {getCustomerLabel(selectedCase)
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-[150px]">
                <h1 className="truncate text-lg font-black leading-5 tracking-tight text-[var(--g66-text-primary)]">
                  {formatCaseNumber(selectedCase.case_number, selectedCase.id).replace(
                    /^Caso\s*/i,
                    "",
                  )}
                </h1>
                <p className="truncate text-[10px] font-semibold text-[var(--g66-text-secondary)]">
                  {getCustomerLabel(selectedCase)}
                </p>
              </div>
              <Badge tone={statusTone(selectedRoutingStatus)}>
                {routingStatusLabel(selectedRoutingStatus)}
              </Badge>
              {(selectedCase.channel || selectedCase.contact_type)?.toUpperCase() ===
              "WHATSAPP" ? (
                <Badge tone="green">
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" aria-hidden="true" />
                    WhatsApp
                  </span>
                </Badge>
              ) : null}
              {selectedCaseSla ? (
                <>
                  <Badge tone={responseBadgeTone(selectedCaseSla.notificationStatus)}>
                    {selectedCaseSla.notificationStatus === "RED"
                      ? "Sin respuesta"
                      : selectedCaseSla.notificationLabel}
                  </Badge>
                  <Badge tone="gray">
                    {selectedCaseSla.firstAgentResponseAt
                      ? `FRT: ${formatDuration(selectedCaseSla.frtSeconds)}`
                      : `FRT pendiente: ${formatDuration(selectedCaseSla.frtSeconds)}`}
                  </Badge>
                </>
              ) : null}
              {attachmentItems.length > 0 ? (
                <Badge tone="lightBlue">
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="h-3 w-3" aria-hidden="true" />
                    Adjuntos: {attachmentItems.length}
                  </span>
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 grid max-w-4xl grid-cols-2 divide-x divide-[var(--g66-border-soft)] rounded-[var(--g66-radius-md)] border border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] sm:grid-cols-3 lg:grid-cols-[1.25fr_0.8fr_1fr_0.85fr_0.7fr]">
              <HeaderMetadataItem label="Case Owner">
                <span className="truncate">{getAgentLabel(selectedCase, agentNames)}</span>
                {canEditAnyCaseInfoField ? (
                  <button
                    type="button"
                    onClick={() => setIsCaseInfoEditing(true)}
                    className="shrink-0 rounded border border-[var(--g66-border)] bg-white px-1.5 py-0.5 text-[9px] font-bold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                  >
                    Cambiar
                  </button>
                ) : null}
              </HeaderMetadataItem>
              <HeaderMetadataItem label="Área">
                <span className="truncate">{selectedCase.area || "Sin área"}</span>
              </HeaderMetadataItem>
              <HeaderMetadataItem label="Último producto">
                <span className="truncate">
                  {selectedCase.product || "Sin producto"}
                  {selectedCase.subproduct ? ` · ${selectedCase.subproduct}` : ""}
                </span>
              </HeaderMetadataItem>
              <HeaderMetadataItem label="Días sin operar">
                <span
                  className={
                    selectedDaysWithoutOperation && selectedDaysWithoutOperation > 0
                      ? "rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700"
                      : ""
                  }
                >
                  {selectedDaysWithoutOperation === null
                    ? "Sin actividad"
                    : `${selectedDaysWithoutOperation} d`}
                </span>
              </HeaderMetadataItem>
              <HeaderMetadataItem label="Prioridad">
                <span
                  className={`inline-flex items-center gap-1 ${
                    selectedCase.priority?.toUpperCase() === "HIGH" ||
                    selectedCase.priority?.toUpperCase() === "URGENT"
                      ? "text-[var(--g66-danger)]"
                      : ""
                  }`}
                >
                  {selectedCase.priority?.toUpperCase() === "HIGH" ||
                  selectedCase.priority?.toUpperCase() === "URGENT" ? (
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  ) : null}
                  {selectedCase.priority || "Sin prioridad"}
                </span>
              </HeaderMetadataItem>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-start gap-1.5">
            <Link
              href="/casos"
              className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-2.5 text-[11px] font-bold text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
            >
              Volver a listado
            </Link>
            {canExecuteMacros ? (
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={openMacroModal}
                className="inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-2.5 text-[11px] font-bold text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-[var(--g66-text-secondary)]"
              >
                <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                Ejecutar macro
              </button>
            ) : null}
            <button
              type="button"
              disabled={!canTakeCases || pendingAction !== null}
              onClick={assignToMe}
              className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-2.5 text-[11px] font-bold text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-[var(--g66-text-secondary)]"
            >
              {pendingAction === "assign-me" ? "Asignando..." : "Asignar"}
            </button>
            <button
              type="button"
              onClick={() => toast.info("ℹ Acción completada")}
              className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-2.5 text-[11px] font-bold text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
            >
              Duplicar
            </button>
            {canCloseCases ? (
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={closeCase}
                className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[var(--g66-radius-md)] border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] px-2.5 text-[11px] font-bold text-[var(--g66-danger)] transition hover:border-[var(--g66-danger)] disabled:cursor-not-allowed disabled:bg-[var(--g66-border)]"
              >
                {pendingAction === "close" ? "Cerrando..." : "Cerrar"}
              </button>
            ) : null}
          </div>
        </header>
      ) : null}

      <div className={workAreaGridClass}>
        {isQueueOpen ? (
          <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-[var(--g66-border)] bg-white/95 shadow-[var(--g66-shadow-card)]">
            <div className="border-b border-[var(--g66-border-soft)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
                  Ventana colapsable
                </span>
                <button
                  type="button"
                  onClick={() => setIsQueueOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-xs font-bold text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
                  aria-label="Ocultar cola"
                  title="Ocultar cola"
                >
                  &lt;
                </button>
              </div>
              <select
                value={selectedView}
                onChange={(event) => handleViewChange(event.target.value as ViewKey)}
                className="mt-2 h-9 w-full rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-semibold text-[var(--g66-text-primary)] outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
              >
                {baseViews.map((view) => (
                  <option key={view.key} value={view.key}>
                    {view.label}
                  </option>
                ))}
                {savedViews.length > 0 ? (
                  <optgroup label="Vistas guardadas">
                    {savedViews.map((view) => (
                      <option key={view.id} value={`saved:${view.id}`}>
                        {view.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-8 min-w-0 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs text-[var(--g66-text-primary)] outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                >
                  <option value="">Estado</option>
                  {uniqueStatusValues(caseItems).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <details className="relative">
                  <summary className="flex h-8 cursor-pointer list-none items-center rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-semibold text-[var(--g66-text-primary)] hover:bg-[var(--g66-brand-blue-soft)]">
                    Filtros
                  </summary>
                  <div className="absolute right-0 top-8 z-30 grid w-44 gap-2 rounded-md border border-[var(--g66-border)] bg-white p-2 shadow-lg">
                    <select
                      value={priorityFilter}
                      onChange={(event) => setPriorityFilter(event.target.value)}
                      className="h-7 rounded-md border border-[var(--g66-border)] bg-white px-2 text-xs text-[var(--g66-text-primary)] outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                    >
                      <option value="">Prioridad</option>
                      {uniqueValues(caseItems, "priority").map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <select
                      value={channelFilter}
                      onChange={(event) => setChannelFilter(event.target.value)}
                      className="h-7 rounded-md border border-[var(--g66-border)] bg-white px-2 text-xs text-[var(--g66-text-primary)] outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                    >
                      <option value="">Canal</option>
                      {uniqueValues(caseItems, "channel").map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </details>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {canTakeCases ? (
                  <Link
                    href="/casos/nuevo"
                    className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-2 text-xs font-bold text-white shadow-[0_8px_18px_rgb(32_94_241/0.18)] transition hover:bg-[var(--g66-brand-blue-hover)]"
                  >
                    Crear caso
                  </Link>
                ) : null}
                <form onSubmit={saveCurrentView} className="flex min-w-0 flex-1 gap-1">
                  <input
                    value={newViewName}
                    onChange={(event) => setNewViewName(event.target.value)}
                    placeholder="Vista"
                    className="h-8 min-w-0 flex-1 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-2 text-xs text-[var(--g66-text-primary)] outline-none placeholder:text-[var(--g66-text-secondary)] focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center justify-center rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-2 text-xs font-bold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                  >
                    Guardar
                  </button>
                </form>
              </div>
            </div>

            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {filteredCases.map((caseItem) => {
                const latestMessage = latestMessageByCase.get(caseItem.id);
                const isSelected = selectedCase?.id === caseItem.id;
                const lifecycleStatus = normalizeLifecycleStatus(
                  caseItem.lifecycle_status,
                  caseItem.status,
                );

                return (
                  <li key={caseItem.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectCase(caseItem.id)}
                      className={`w-full rounded-[var(--g66-radius-md)] border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue-soft)] shadow-[var(--g66-shadow-card)]"
                          : "border-[var(--g66-border-soft)] bg-white hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-surface-soft)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-bold text-[var(--g66-text-primary)]">
                          {formatCaseNumber(caseItem.case_number, caseItem.id)}
                        </p>
                        <span className="shrink-0 text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                          {formatRelativeTime(getLastActivity(caseItem, latestMessage))}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-[var(--g66-text-secondary)]">
                        {getCustomerLabel(caseItem)}
                      </p>
                      <div className="mt-1">
                        <span
                          className={`inline-flex w-fit rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            listLifecycleBadgeClass(lifecycleStatus) ||
                            "border border-[var(--g66-border)] bg-[var(--g66-background)] text-[var(--g66-text-secondary)]"
                          }`}
                        >
                          {lifecycleStatus}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
              {filteredCases.length === 0 ? (
                <li className="p-5 text-sm text-[var(--g66-text-secondary)]">
                  No hay casos para la vista o filtros actuales.
                </li>
              ) : null}
            </ul>
          </aside>
        ) : null}

        {selectedCase ? (
          <aside className="h-full min-h-0 overflow-y-auto border-r border-[var(--g66-border)] bg-[var(--g66-background)] p-2">
            {!isQueueOpen ? (
              <button
                type="button"
                onClick={() => setIsQueueOpen(true)}
                className="mb-3 flex h-8 w-full items-center justify-center rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white text-xs font-bold text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
              >
                &gt; Mostrar cola
              </button>
            ) : null}
            <div className="grid gap-2">
              <ModuleBox
                title="Información del cliente"
                icon={<User className="h-3.5 w-3.5" aria-hidden="true" />}
                action={
                  selectedCase.customer?.public_id ? (
                    <Link
                      href={`/cuentas/${selectedCase.customer.public_id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--g66-border)] bg-white px-2 py-1 text-[10px] font-black text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                    >
                      Cliente 360
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="rounded-full bg-[var(--g66-background)] px-2 py-1 text-[10px] font-black text-[var(--g66-text-muted)]">
                      Cliente no vinculado
                    </span>
                  )
                }
              >
                <div className="grid gap-1.5">
                  <QuickCopyRow label="Nombre" value={getCustomerLabel(selectedCase)} onCopy={() => copyQuickValue(getCustomerLabel(selectedCase), "Nombre copiado")} />
                  <QuickCopyRow label="Email" value={getCustomerEmail(selectedCase)} onCopy={() => copyQuickValue(getCustomerEmail(selectedCase), "Correo copiado")} />
                  <QuickCopyRow label="Teléfono" value={getCustomerPhone(selectedCase)} onCopy={() => copyQuickValue(getCustomerPhone(selectedCase), "Teléfono copiado")} />
                </div>
                {canUseAircall ? (
                  <button
                    type="button"
                    onClick={() => startAircallCall(selectedCase)}
                    disabled={pendingAction !== null}
                    className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-3 text-xs font-black text-white transition hover:bg-[var(--g66-brand-blue-hover)] disabled:cursor-not-allowed disabled:bg-[var(--g66-border)] disabled:text-[var(--g66-text-muted)]"
                  >
                    <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
                    {pendingAction === "aircall" ? "Preparando..." : "Llamar"}
                  </button>
                ) : null}
              </ModuleBox>
              <ModuleBox
                title="Información del caso"
                icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                <div className="grid gap-1.5">
                  <QuickCopyRow label="Número de caso" value={formatCaseNumber(selectedCase.case_number, selectedCase.id)} onCopy={() => copyQuickValue(formatCaseNumber(selectedCase.case_number, selectedCase.id), "Número de caso copiado")} />
                  <QuickCopyRow label="Correo" value={selectedCase.contact_email || getCustomerEmail(selectedCase)} onCopy={() => copyQuickValue(selectedCase.contact_email || getCustomerEmail(selectedCase), "Correo copiado")} />
                  <QuickCopyRow label="Asunto" value={selectedCase.subject || "Sin asunto"} onCopy={() => copyQuickValue(selectedCase.subject || "Sin asunto", "Asunto copiado")} />
                  <QuickCopyRow label="WhatsApp" value={selectedCase.contact_phone || getCustomerPhone(selectedCase)} onCopy={() => copyQuickValue(selectedCase.contact_phone || getCustomerPhone(selectedCase), "WhatsApp copiado")} />
                  <QuickCopyRow label="ID técnico del caso" value={selectedCase.id} onCopy={() => copyQuickValue(selectedCase.id, "ID técnico copiado")} />
                </div>
              </ModuleBox>
              <ModuleBox
                title="Propiedades Caso"
                icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
                action={
                  canEditAnyCaseInfoField ? (
                    <button
                      type="button"
                      onClick={() => setIsCaseInfoEditing((current) => !current)}
                      className="inline-flex items-center rounded-full border border-[var(--g66-border)] bg-white px-2 py-1 text-[10px] font-black text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                    >
                      {isCaseInfoEditing ? "Cancelar" : "Editar"}
                    </button>
                  ) : null
                }
              >
                {isCaseInfoEditing && canEditAnyCaseInfoField ? (
                  <form
                    key={`${selectedCase.id}-case-info`}
                    onSubmit={saveCaseInfoForm}
                    className="grid gap-2"
                  >
                    {canViewCaseInfoField("subject") ? (
                      <FormField label="Asunto">
                        <input
                          name="subject"
                          defaultValue={selectedCase.subject || ""}
                          disabled={!canEditCaseInfoField("subject")}
                          className={inputClassName()}
                        />
                      </FormField>
                    ) : null}
                    {canViewCaseInfoField("area") ? (
                      <FormField label="Área">
                        <select
                          name="area"
                          defaultValue={selectedCase.area || ""}
                          disabled={!canEditCaseInfoField("area")}
                          className={inputClassName()}
                        >
                          <option value="">Sin área</option>
                          {areaOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    ) : null}
                    {canViewCaseInfoField("category") ? (
                      <FormField label="Categoría">
                        <select
                          name="category"
                          defaultValue={selectedCase.category || ""}
                          disabled={!canEditCaseInfoField("category")}
                          className={inputClassName()}
                        >
                          <option value="">Sin categoría</option>
                          {categoryOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    ) : null}
                    {canViewCaseInfoField("priority") ? (
                      <FormField label="Prioridad">
                        <select
                          name="priority"
                          defaultValue={selectedCase.priority || "MEDIUM"}
                          disabled={!canEditCaseInfoField("priority")}
                          required
                          className={inputClassName()}
                        >
                          {priorityOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    ) : null}
                    {canViewCaseInfoField("lifecycle_status") ? (
                      <FormField label="Lifecycle">
                        <select
                          name="lifecycle_status"
                          defaultValue={selectedLifecycleStatus}
                          disabled={!canEditCaseInfoField("lifecycle_status")}
                          className={inputClassName()}
                        >
                          {lifecycleStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    ) : null}
                    {canViewCaseInfoField("routing_status") ? (
                      <FormField label="Routing">
                        <select
                          name="routing_status"
                          defaultValue={selectedRoutingStatus}
                          disabled={!canEditCaseInfoField("routing_status")}
                          className={inputClassName()}
                        >
                          {routingStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    ) : null}
                    {canViewCaseInfoField("contact_type") ? (
                      <FormField label="Tipo de contacto">
                        <select
                          name="contact_type"
                          defaultValue={selectedCase.contact_type || ""}
                          disabled={!canEditCaseInfoField("contact_type")}
                          className={inputClassName()}
                        >
                          <option value="">Sin tipo</option>
                          {contactTypeOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    ) : null}
                    {canViewCaseInfoField("assigned_agent_id") ? (
                      <FormField label="Agente asignado">
                        <select
                          name="assigned_agent_id"
                          defaultValue={selectedCase.assigned_agent_id || ""}
                          disabled={!canEditCaseInfoField("assigned_agent_id")}
                          className={inputClassName()}
                        >
                          <option value="">Sin asignar</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name || agent.email || agent.id}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    ) : null}
                    {canViewCaseInfoField("resolution_type") ? (
                      <FormField label="Resolución">
                        <select
                          name="resolution_type"
                          defaultValue={selectedCase.resolution_type || ""}
                          disabled={!canEditCaseInfoField("resolution_type")}
                          className={inputClassName()}
                        >
                          <option value="">Sin resolución</option>
                          {resolutionTypeOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    ) : null}
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCaseInfoEditing(false)}
                        className="inline-flex h-8 items-center justify-center rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-bold text-[var(--g66-text-secondary)] transition hover:bg-[var(--g66-background)]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={pendingAction !== null}
                        className="inline-flex h-8 items-center justify-center rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-3 text-xs font-bold text-white transition hover:bg-[var(--g66-brand-blue-hover)] disabled:cursor-not-allowed disabled:bg-[var(--g66-border)] disabled:text-[var(--g66-text-muted)]"
                      >
                        {pendingAction === "case-info" ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <dl className="grid gap-2">
                    {canViewCaseInfoField("subject") ? (
                      <Field label="Asunto" value={selectedCase.subject || "Sin asunto"} />
                    ) : null}
                    {canViewCaseInfoField("area") ? (
                      <Field label="Área" value={selectedCase.area || "Sin área"} />
                    ) : null}
                    {canViewCaseInfoField("category") ? (
                      <Field
                        label="CAT Secundaria"
                        value={selectedCase.category || "Sin categoría"}
                      />
                    ) : null}
                    <Field label="CAT Principal" value={selectedCase.area || "Sin categoría"} />
                    <Field label="CAT Extra" value={selectedCase.ai_category || "Sin categoría extra"} />
                    <Field label="Producto" value={selectedCase.product || "Sin producto"} />
                    <Field label="Subproducto" value={selectedCase.subproduct || "Sin subproducto"} />
                    {canViewCaseInfoField("priority") ? (
                      <Field
                        label="Prioridad"
                        value={selectedCase.priority || "Sin prioridad"}
                      />
                    ) : null}
                    {canViewCaseInfoField("lifecycle_status") ? (
                      <Field label="Lifecycle" value={selectedLifecycleStatus} />
                    ) : null}
                    {canViewCaseInfoField("routing_status") ? (
                      <Field label="Routing" value={selectedRoutingStatus} />
                    ) : null}
                    {canViewCaseInfoField("resolution_type") ? (
                      <Field
                        label="Resolución"
                        value={selectedCase.resolution_type || "Sin resolución"}
                      />
                    ) : null}
                    {canViewCaseInfoField("contact_type") ? (
                      <Field
                        label="Tipo de contacto"
                        value={selectedCase.contact_type || "Sin tipo"}
                      />
                    ) : null}
                    {canViewCaseInfoField("assigned_agent_id") ? (
                      <Field
                        label="Agente asignado"
                        value={getAgentLabel(selectedCase, agentNames)}
                      />
                    ) : null}
                    <Field label="Caso Borde" value={selectedCase.is_edge_case ? "Sí" : "No"} />
                  </dl>
                )}
              </ModuleBox>
              <ModuleBox
                title="CSAT"
                icon={<CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                <p className="rounded-md border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-xs font-semibold text-[var(--g66-text-secondary)]">
                  No hay resultados de CSAT asociados a este caso.
                </p>
              </ModuleBox>
            </div>
          </aside>
        ) : null}

        <main className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
          {selectedCase ? (
            <>
              <section className="shrink-0 rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white px-3 py-1.5 shadow-[var(--g66-shadow-card)]">
                <div className="flex min-h-12 items-center">
                  <div className="flex w-full items-start">
                    {lifecycleStatuses.map((status, index) => {
                      const isActive = selectedLifecycleStatus === status;
                      const isPast =
                        lifecycleStatuses.indexOf(selectedLifecycleStatus) > index;
                      const isLineComplete =
                        lifecycleStatuses.indexOf(selectedLifecycleStatus) > index;
                      const canClick =
                        canEditCaseFields && pendingAction !== "status";

                      return (
                        <div
                          key={status}
                          className="relative flex min-w-0 flex-1 flex-col items-center"
                        >
                          {index < lifecycleStatuses.length - 1 ? (
                            <span
                              className={`absolute left-[calc(50%+22px)] right-[calc(-50%+22px)] top-3 h-0.5 rounded-full ${
                                isLineComplete
                                  ? "bg-[var(--g66-brand-blue)]"
                                  : "bg-[var(--g66-border)]"
                              }`}
                              aria-hidden="true"
                            />
                          ) : null}
                          <button
                            type="button"
                            disabled={!canClick}
                            onClick={() => changeLifecycleStatus(status)}
                            title={status}
                            className="relative z-10 flex min-w-0 flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                          >
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black transition ${
                                isActive
                                  ? "border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue)] text-white shadow-[0_8px_18px_rgb(32_94_241/0.2)]"
                                  : isPast
                                    ? "border-[var(--g66-success-soft)] bg-[var(--g66-success-soft)] text-[var(--g66-success)]"
                                    : "border-[var(--g66-border-soft)] bg-[#F3F7FC] text-[var(--g66-text-muted)]"
                              }`}
                            >
                              {isPast ? (
                                <Check className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <span
                              className={`truncate text-[11px] font-bold ${
                                isActive
                                  ? "text-[var(--g66-brand-blue)]"
                                  : isPast
                                    ? "text-[var(--g66-success)]"
                                    : "text-[var(--g66-text-muted)]"
                              }`}
                            >
                              {lifecyclePathLabels[status]}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-card)]">
                <div className="flex h-10 shrink-0 items-end border-b border-[var(--g66-border-soft)] bg-white px-3">
                  {[
                    {
                      key: "whatsapp",
                      label: "WhatsApp",
                      icon: <MessageCircle className="h-4 w-4" aria-hidden="true" />,
                    },
                    {
                      key: "ticket",
                      label: "Ticket",
                      icon: <Mail className="h-4 w-4" aria-hidden="true" />,
                    },
                    ...(canViewAiCaseSummary
                      ? [
                          {
                            key: "ai",
                            label: "IA",
                            icon: <Bot className="h-4 w-4" aria-hidden="true" />,
                          },
                        ]
                      : []),
                    {
                      key: "activity",
                      label: "Actividad",
                      icon: <Activity className="h-4 w-4" aria-hidden="true" />,
                    },
                    {
                      key: "history",
                      label: "Historial",
                      icon: <History className="h-4 w-4" aria-hidden="true" />,
                    },
                    {
                      key: "form",
                      label: "Form",
                      icon: <FileText className="h-4 w-4" aria-hidden="true" />,
                    },
                  ].map((tab) => {
                    const key = tab.key as WorkTab;
                    const isActive = workTab === key;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setWorkTab(key)}
                        className={`flex h-8 items-center gap-1.5 border-b-2 px-3 text-xs font-black transition ${
                          isActive
                            ? key === "whatsapp"
                              ? "border-[var(--g66-success)] text-[var(--g66-success)]"
                              : "border-[var(--g66-brand-blue)] text-[var(--g66-brand-blue)]"
                            : key === "whatsapp"
                              ? "border-transparent text-[var(--g66-text-secondary)] hover:text-[var(--g66-success)]"
                              : "border-transparent text-[var(--g66-text-secondary)] hover:text-[var(--g66-brand-blue)]"
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {workTab === "whatsapp" ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-1.5 bg-[var(--g66-surface-soft)] p-2">
                    <div className="flex h-7 shrink-0 items-center justify-between rounded-full border border-[var(--g66-success-soft)] bg-white px-3">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[var(--g66-success)]">
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        WhatsApp
                      </span>
                      <span className="text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                        {selectedWhatsappMessages.length.toLocaleString("es-CL")} mensajes
                      </span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--g66-radius-lg)] border border-[var(--g66-border-soft)] bg-[linear-gradient(180deg,#FFFFFF_0%,var(--g66-background)_100%)] p-3">
                      {selectedWhatsappMessages.length > 0 ? (
                        <div className="space-y-2">
                          {selectedWhatsappMessages.map((message) => {
                            const outbound = isOutbound(message);
                            const deliveryStatusMeta = outbound
                              ? getDeliveryStatusMeta(message)
                              : null;
                            const mediaAttachments = getAttachmentsForMessage(
                              attachmentItems,
                              message.id,
                            ).filter((attachment) => attachment.source === "WHATSAPP");

                            return (
                              <article
                                key={message.id}
                                className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`${messageWidthClass(message)} rounded-[var(--g66-radius-lg)] px-3 py-2 shadow-[var(--g66-shadow-card)] ${bubbleClass(message)}`}
                                >
                                  <div className="mb-0.5 flex items-center justify-between gap-3">
                                    <span className="text-[11px] font-bold">
                                      {message.sender_type || "Mensaje"}
                                    </span>
                                    <span className="text-[11px] opacity-75">
                                      {formatDateTime(message.created_at)}
                                    </span>
                                  </div>
                                  <p className="whitespace-pre-wrap text-sm leading-5">
                                    {message.body || "Sin contenido"}
                                  </p>
                                  {mediaAttachments.length > 0 ? (
                                    <div className="grid gap-1">
                                      {mediaAttachments.map((attachment) => (
                                        <MediaAttachmentPreview
                                          key={attachment.id}
                                          attachment={attachment}
                                        />
                                      ))}
                                    </div>
                                  ) : null}
                                  {deliveryStatusMeta ? (
                                    <p
                                      title={deliveryStatusMeta.title}
                                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-bold ${deliveryStatusMeta.className}`}
                                    >
                                      {deliveryStatusMeta.icon}
                                      {deliveryStatusMeta.label}
                                    </p>
                                  ) : null}
                                </div>
                              </article>
                            );
                          })}
                          <div ref={conversationEndRef} />
                        </div>
                      ) : (
                        <p className="rounded-md border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-600">
                          Este caso aún no tiene mensajes.
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 rounded-[var(--g66-radius-lg)] border border-[var(--g66-border-soft)] bg-white shadow-[var(--g66-shadow-card)]">
                      <CaseReplyForm caseId={selectedCase.id} compact />
                    </div>
                  </div>
                ) : null}

                {workTab === "ai" && canViewAiCaseSummary ? (
                  <CaseAiHistoryPanel
                    selectedCase={selectedCase}
                    payload={aiHistoryPayload}
                    isLoading={isAiHistoryLoading}
                    isGenerating={isAiHistoryGenerating}
                    error={aiHistoryError}
                    canGenerate={canGenerateAiCaseSummary}
                    onGenerate={generateAiHistorySummary}
                  />
                ) : null}

                {["ticket", "activity", "history", "form"].includes(workTab) ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {workTab === "ticket" ? (
                      <CaseEmailComposer
                        key={`${selectedCase.id}-publish`}
                        caseItem={selectedCase}
                        currentUser={{
                          name: agentSession.name || "Agente CRM",
                          email: agentSession.email || "",
                        }}
                        composer={ticketComposer}
                        isDirty={isTicketDraftDirty}
                        isSending={pendingAction === "email"}
                        isSyncing={pendingAction === "email-sync"}
                        disabled={!canRespondToCustomers || pendingAction !== null}
                        onComposerChange={setTicketComposer}
                        onDirtyChange={setIsTicketDraftDirty}
                        onSubmit={sendTicketEmail}
                        onSyncEmails={syncTicketEmails}
                      />
                    ) : null}

                    {ticketTab === "details" ? (
                      <form
                        key={`${selectedCase.id}-details`}
                        onSubmit={saveTicketForm}
                        className="flex min-h-0 flex-1 flex-col bg-[var(--g66-background)]"
                      >
                        <div className="min-h-0 flex-1 overflow-y-auto p-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <FormField label="Subject">
                            <input
                              name="subject"
                              defaultValue={selectedCase.subject || ""}
                              disabled={!canEditCaseFields}
                              className={inputClassName()}
                            />
                          </FormField>
                            <FormField label="Lifecycle Status">
                            <select
                              name="lifecycle_status"
                              defaultValue={selectedLifecycleStatus}
                              disabled={!canEditCaseFields}
                              className={inputClassName()}
                            >
                              {lifecycleStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </FormField>
                            <FormField label="Routing Status">
                            <select
                              name="routing_status"
                              defaultValue={selectedRoutingStatus}
                              disabled={!canEditCaseFields}
                              className={inputClassName()}
                            >
                              {routingStatusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </FormField>
                            <FormField label="Priority">
                              <select
                                name="priority"
                                defaultValue={selectedCase.priority || ""}
                                disabled={!canEditCaseFields}
                                className={inputClassName()}
                              >
                                <option value="">Sin prioridad</option>
                                {priorityOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </FormField>
                            <FormField label="Area">
                              <select
                                name="area"
                                defaultValue={selectedCase.area || ""}
                                disabled={!canEditCaseFields}
                                className={inputClassName()}
                              >
                                <option value="">Sin área</option>
                                {areaOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </FormField>
                            <FormField label="Category">
                              <select
                                name="category"
                                defaultValue={selectedCase.category || ""}
                                disabled={!canEditCaseFields}
                                className={inputClassName()}
                              >
                                <option value="">Sin categoría</option>
                                {categoryOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </FormField>
                            <FormField label="Contact Type">
                              <select
                                name="contact_type"
                                defaultValue={selectedCase.contact_type || ""}
                                disabled={!canEditCaseFields}
                                className={inputClassName()}
                              >
                                <option value="">Sin tipo</option>
                                {contactTypeOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </FormField>
                            <FormField label="Agente asignado">
                            <select
                              name="assigned_agent_id"
                              defaultValue={selectedCase.assigned_agent_id || ""}
                              disabled={!canEditCaseFields}
                              className={inputClassName()}
                            >
                              <option value="">Sin asignar</option>
                              {agents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.name || agent.email || agent.id}
                                </option>
                              ))}
                            </select>
                          </FormField>
                            <FormField label="Resolution Type">
                            <select
                              name="resolution_type"
                              defaultValue={selectedCase.resolution_type || ""}
                              disabled={!canEditCaseFields}
                              className={inputClassName()}
                            >
                              <option value="">Sin resolución</option>
                              {resolutionTypeOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </FormField>
                            <FormField label="AI Summary">
                            <textarea
                              name="ai_summary"
                              defaultValue={selectedCase.ai_summary || ""}
                              disabled={!canEditCaseFields}
                              className={textareaClassName()}
                            />
                          </FormField>
                        </div>
                        </div>
                        <div className="flex h-12 shrink-0 items-center justify-end border-t border-[var(--g66-border)] bg-white px-3">
                          <button
                            type="submit"
                            disabled={!canEditCaseFields || pendingAction !== null}
                            className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--g66-brand-blue)] px-4 text-xs font-semibold text-white hover:bg-[var(--g66-accent-cyan)] disabled:cursor-not-allowed disabled:bg-[var(--g66-border)]"
                          >
                            {pendingAction === "status" ? "Guardando..." : "Guardar cambios"}
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {workTab === "activity" ? (
                      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--g66-background)] p-3">
                        <div className="grid gap-2">
                          {canViewCallHistory
                            ? aircallCalls.map((call) => (
                                <AircallCallCard
                                  key={`activity-aircall-${call.id}`}
                                  call={call}
                                />
                              ))
                            : null}
                          {selectedCaseMessages.map((message) => {
                            const sender = message.sender_type?.toUpperCase() ?? "";
                            const direction = message.direction?.toUpperCase() ?? "";
                            const emailMessage = isEmailMessage(message);
                            const title = emailMessage
                              ? getEmailTitle(message)
                                : sender === "CUSTOMER" || direction === "INBOUND"
                                  ? "Mensaje recibido"
                                  : sender === "AI"
                                    ? "Respuesta IA"
                                    : "Respuesta agente";

                            return (
                              <article
                                key={`activity-${message.id}`}
                                className="rounded-md border border-[var(--g66-border)] bg-white p-3 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-xs font-bold text-[var(--g66-text-primary)]">
                                    {title}
                                  </p>
                                  <span className="shrink-0 text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                                    {formatDateTime(message.created_at)}
                                  </span>
                                </div>
                                {emailMessage ? (
                                  <div className="mt-2 grid gap-1.5">
                                    <dl className="grid gap-1 text-xs font-semibold text-[var(--g66-text-secondary)] md:grid-cols-2">
                                      <Field
                                        label="De"
                                        value={message.email_from || "Sin remitente"}
                                      />
                                      <Field
                                        label="Para"
                                        value={message.email_to || "Sin destinatario"}
                                      />
                                      <Field
                                        label="CC"
                                        value={message.email_cc || "Sin CC"}
                                      />
                                      <Field
                                        label="Asunto"
                                        value={message.email_subject || "Sin asunto"}
                                      />
                                    </dl>
                                    <p className="line-clamp-2 text-xs font-semibold text-[var(--g66-text-secondary)]">
                                      {message.body || "Sin contenido"}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedEmailMessage(message)}
                                      className="mt-1 inline-flex h-7 w-fit items-center justify-center rounded-md border border-[var(--g66-border)] bg-white px-2 text-xs font-semibold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-background)]"
                                    >
                                      Ver correo completo
                                    </button>
                                  </div>
                                ) : (
                                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-[var(--g66-text-secondary)]">
                                    {message.body || "Sin contenido"}
                                  </p>
                                )}
                              </article>
                            );
                          })}
                          {selectedCaseMessages.length === 0 && aircallCalls.length === 0 ? (
                            <div className="grid gap-2">
                              <p className="rounded-md border border-dashed border-[var(--g66-border)] bg-white p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">No hay gestiones registradas.</p>
                              <p className="rounded-md border border-dashed border-[var(--g66-border)] bg-white p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">No hay llamadas asociadas.</p>
                              <p className="rounded-md border border-dashed border-[var(--g66-border)] bg-white p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">No hay correos asociados.</p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {workTab === "history" ? (
                      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--g66-background)] p-3">
                        <div className="grid gap-2 rounded-md border border-[var(--g66-border)] bg-white p-3 shadow-sm">
                          <Field label="Caso creado" value={formatDateTime(selectedCase.created_at)} />
                          <Field label="Última actualización" value={formatDateTime(selectedCase.updated_at)} />
                          <Field label="Caso cerrado" value={formatDateTime(selectedCase.closed_at)} />
                          {auditEvents.length > 0 ? (
                            <div className="mt-2 grid gap-2">
                              {auditEvents.map((event) => (
                                <AuditEventCard
                                  key={`history-audit-${event.id}`}
                                  event={event}
                                  agentNames={agentNames}
                                />
                              ))}
                            </div>
                          ) : null}
                          {auditEvents.length === 0 ? (
                            <div className="rounded-md border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">
                              No hay historial detallado de cambios para este caso todavía.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {workTab === "form" ? (
                      (() => {
                        const layoutTab = areaLayoutTab;

                        if (!layoutTab) {
                          return (
                            <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--g66-background)] p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">
                              No hay layout configurado para esta área.
                            </div>
                          );
                        }

                        const valuesByField = new Map(
                          customValues.map((value) => [
                            value.field_definition_id,
                            value,
                          ]),
                        );

                        return (
                          <form
                            key={`${selectedCase.id}-${layoutTab.id}`}
                            onSubmit={(event) =>
                              saveCustomLayoutFields(event, layoutTab)
                            }
                            onChange={() => setIsCustomLayoutDirty(true)}
                            className="flex min-h-0 flex-1 flex-col bg-[var(--g66-background)]"
                          >
                            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                              <div className="grid gap-3">
                                {layoutTab.sections.map((section) => (
                                  <section
                                    key={section.id}
                                    className="rounded-md border border-[var(--g66-border)] bg-white p-3 shadow-sm"
                                  >
                                    <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--g66-brand-blue)]">
                                      {section.label}
                                    </h3>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                      {section.fields.map((layoutField) => {
                                        const field = layoutField.field_definition;

                                        if (
                                          !field ||
                                          !canViewCaseInfoField(field.field_key)
                                        ) {
                                          return null;
                                        }

                                        const value = field.is_standard
                                          ? getStandardCaseValue(
                                              selectedCase as unknown as Record<
                                                string,
                                                unknown
                                              >,
                                              field,
                                            )
                                          : getCustomValueForField(
                                              field,
                                              valuesByField.get(field.id),
                                            );
                                        const error = customFieldErrors[field.id];

                                        return (
                                          <div
                                            key={layoutField.id}
                                            className={
                                              layoutField.column_span === 2
                                                ? "md:col-span-2"
                                                : ""
                                            }
                                          >
                                            <FormField
                                              label={`${field.label}${
                                                field.is_required ? " *" : ""
                                              }`}
                                            >
                                              <CustomFieldInput
                                                field={field}
                                                value={value}
                                                disabled={
                                                  Boolean(layoutField.is_readonly) ||
                                                  !canEditCaseInfoField(field.field_key)
                                                }
                                              />
                                            </FormField>
                                            {field.description ? (
                                              <p className="mt-1 text-xs font-semibold text-[var(--g66-text-secondary)]">
                                                {field.description}
                                              </p>
                                            ) : null}
                                            {error ? (
                                              <p className="mt-1 text-xs font-bold text-[var(--g66-danger)]">
                                                {error}
                                              </p>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </section>
                                ))}
                              </div>
                            </div>
                            <div className="flex h-12 shrink-0 items-center justify-end border-t border-[var(--g66-border)] bg-white px-3">
                              <button
                                type="submit"
                                disabled={
                                  pendingAction !== null ||
                                  !isCustomLayoutDirty ||
                                  !layoutTab.sections.some((section) =>
                                    section.fields.some((layoutField) => {
                                      const field = layoutField.field_definition;

                                      return (
                                        field &&
                                        !layoutField.is_readonly &&
                                        canViewCaseInfoField(field.field_key) &&
                                        canEditCaseInfoField(field.field_key)
                                      );
                                    }),
                                  )
                                }
                                className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--g66-brand-blue)] px-4 text-xs font-semibold text-white hover:bg-[var(--g66-accent-cyan)] disabled:cursor-not-allowed disabled:bg-[var(--g66-border)]"
                              >
                                {pendingAction === "custom-fields"
                                  ? "Guardando..."
                                  : "Guardar valores"}
                              </button>
                            </div>
                          </form>
                        );
                      })()
                    ) : null}
                  </div>
                ) : null}
              </section>
            </>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-[var(--g66-border)] bg-white p-8 text-sm text-gray-600">
              Selecciona un caso para comenzar.
            </div>
          )}
        </main>

        <aside className="h-full min-h-0 overflow-y-auto border-l border-[var(--g66-border)] bg-[var(--g66-background)] p-2">
          <div className="mb-3 flex h-8 items-center justify-between">
            {isRightPanelOpen ? (
              <>
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
                  Relacionados
                </span>
                <button
                  type="button"
                  onClick={() => setIsRightPanelOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-xs font-bold text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
                  aria-label="Ocultar panel derecho"
                  title="Ocultar panel derecho"
                >
                  &gt;
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsRightPanelOpen(true)}
                className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-xs font-bold text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
                aria-label="Mostrar panel derecho"
                title="Mostrar panel derecho"
              >
                &lt;
              </button>
            )}
          </div>

          {selectedCase && isRightPanelOpen ? (
            <div className="grid gap-2">
              <ModuleBox
                title={`Casos WhatsApp${
                  whatsappPendingCount > 0 ? ` · ${whatsappPendingCount}` : ""
                }`}
                icon={<MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                {whatsappNotificationCases.length > 0 ? (
                  <div className="grid gap-1.5">
                    {whatsappNotificationCases.map((caseItem) => (
                      <Link
                        key={caseItem.caseId}
                        href={`/casos/${caseItem.caseId}`}
                        className={`block rounded-[var(--g66-radius-md)] border p-3 transition hover:-translate-y-0.5 hover:shadow-[var(--g66-shadow-card)] ${whatsappNotificationCardClass(
                          caseItem.notificationStatus,
                        )}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/70">
                              <WhatsappNotificationIcon
                                status={caseItem.notificationStatus}
                              />
                            </span>
                            <span className="truncate text-xs font-bold">
                              {caseItem.caseNumber}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] font-bold">
                            WA
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[11px] font-semibold">
                          {caseItem.notificationStatus === "RED"
                            ? "Sin primera respuesta"
                            : caseItem.notificationLabel}
                        </p>
                        <p className="mt-1 truncate text-[11px] font-semibold opacity-80">
                          Última actividad:{" "}
                          {formatRelativeTime(
                            caseItem.lastActivityAt || caseItem.createdAt,
                          )}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-[var(--g66-text-secondary)]">
                    No hay casos WhatsApp abiertos asignados a tu sesión.
                  </p>
                )}
              </ModuleBox>
              <ModuleBox
                title="Links con información del caso"
                icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                <div className="grid gap-1.5">
                  {[
                    {
                      key: "cases",
                      label: "Casos",
                      icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    {
                      key: "qa",
                      label: "Notas QA",
                      icon: <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    {
                      key: "ai",
                      label: "IA",
                      icon: <Bot className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    {
                      key: "history",
                      label: "Historial",
                      icon: <History className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    {
                      key: "activity",
                      label: "Actividad",
                      icon: <Activity className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    {
                      key: "email",
                      label: "Correos",
                      icon: <Mail className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    ...(canViewCallHistory
                      ? [
                          {
                            key: "aircall",
                            label: "Aircall",
                            icon: (
                              <PhoneCall
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            ),
                          },
                        ]
                      : []),
                    {
                      key: "sla",
                      label: "SLA",
                      icon: <Activity className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setRelatedView(item.key as Exclude<RelatedView, null>)
                      }
                      className="flex h-8 items-center justify-between rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-2.5 text-[11px] font-bold text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                    >
                      <span className="flex items-center gap-1.5">
                        {item.icon}
                        {item.label}
                      </span>
                      <span>&gt;</span>
                    </button>
                  ))}
                </div>
              </ModuleBox>
              <ModuleBox
                title="Historial de casos del cliente"
                icon={<History className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                <div className="grid gap-1.5">
                  {caseItems
                    .filter((caseItem) => selectedCase.customer_id && caseItem.customer_id === selectedCase.customer_id)
                    .map((caseItem) => (
                      <Link key={caseItem.id} href={`/casos/${caseItem.id}`} className="rounded-md border border-[var(--g66-border-soft)] bg-[var(--g66-background)] p-2 text-xs font-bold text-[var(--g66-brand-blue)] hover:underline">
                        {formatCaseNumber(caseItem.case_number, caseItem.id)} · {caseItem.subject || "Sin asunto"}
                      </Link>
                    ))}
                  {!selectedCase.customer_id ? <p className="text-xs font-semibold text-[var(--g66-text-secondary)]">Cliente no relacionado.</p> : null}
                </div>
              </ModuleBox>
              <ModuleBox
                title="Información transaccional"
                icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                <dl className="grid gap-2">
                  <Field label="Tiempo sin respuesta" value={getTimeWithoutResponse(selectedCaseMessages)} />
                  <Field label="Mensajes" value={selectedCaseMessages.length.toLocaleString("es-CL")} />
                  <Field label="Última actividad" value={formatDateTime(selectedLastActivity)} />
                </dl>
              </ModuleBox>
              <ModuleBox
                title="Adjuntos"
                icon={<Paperclip className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                {attachmentItems.length > 0 ? (
                  <div className="grid gap-1.5">
                    <p className="text-xs font-bold text-[var(--g66-text-primary)]">
                      {attachmentItems.length.toLocaleString("es-CL")} adjuntos
                    </p>
                    {attachmentItems.slice(0, 6).map((attachment) => (
                      <div
                        key={attachment.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[var(--g66-text-primary)]">
                            {attachment.filename || "Adjunto"}
                          </p>
                          <p className="truncate text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                            {[attachment.mime_type, formatAttachmentSize(attachment.size_bytes)]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                            {formatDateTime(attachment.created_at)}
                          </p>
                        </div>
                        <a
                          href={`/api/attachments/${attachment.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white px-3 text-[11px] font-bold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                        >
                          Ver
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-[var(--g66-text-secondary)]">
                    No hay adjuntos para este caso.
                  </p>
                )}
              </ModuleBox>
              <ModuleBox
                title="Información de Sistema"
                icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                <dl className="grid gap-2">
                  <Field label="ID técnico" value={selectedCase.id} />
                  <Field label="Creado" value={formatDateTime(selectedCase.created_at)} />
                  <Field label="Actualizado" value={formatDateTime(selectedCase.updated_at)} />
                </dl>
              </ModuleBox>
            </div>
          ) : null}
        </aside>
      </div>

      {canUseAircall ? <AircallPhoneWidget /> : null}

      {relatedView && selectedCase ? (
        <div className="absolute inset-y-0 right-0 z-30 w-96 border-l border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-soft)]">
          <div className="flex h-12 items-center justify-between border-b border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] px-4">
            <h2 className="text-sm font-black text-[var(--g66-text-primary)]">
              {relatedView === "ai"
                ? "IA"
                : relatedView === "cases"
                  ? "Casos"
                  : relatedView === "qa"
                    ? "Notas QA"
                    : relatedView === "email"
                      ? "Correos"
                : relatedView === "history"
                  ? "Historial"
                  : relatedView === "activity"
                    ? "Actividad"
                    : relatedView === "aircall"
                      ? "Aircall"
                      : "SLA"}
            </h2>
            <button
              type="button"
              onClick={() => setRelatedView(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-xs font-bold text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
            >
              ×
            </button>
          </div>
          <div className="grid gap-3 p-3">
            {relatedView === "cases" ? (
              <div className="grid gap-2">
                {caseItems.filter((caseItem) => selectedCase.customer_id && caseItem.customer_id === selectedCase.customer_id).map((caseItem) => (
                  <Link key={`related-case-${caseItem.id}`} href={`/casos/${caseItem.id}`} className="rounded-md border border-[var(--g66-border)] p-3 text-sm font-bold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]">
                    {formatCaseNumber(caseItem.case_number, caseItem.id)} · {caseItem.subject || "Sin asunto"}
                  </Link>
                ))}
              </div>
            ) : null}
            {relatedView === "qa" ? (
              <p className="rounded-md border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">No hay notas QA asociadas.</p>
            ) : null}
            {relatedView === "email" ? (
              <div className="grid gap-2">
                {selectedCaseMessages.filter(isEmailMessage).map((message) => (
                  <button key={`related-email-${message.id}`} type="button" onClick={() => setSelectedEmailMessage(message)} className="rounded-md border border-[var(--g66-border)] p-3 text-left text-sm font-bold text-[var(--g66-brand-blue)]">
                    {message.email_subject || "Email sin asunto"}
                  </button>
                ))}
                {selectedCaseMessages.filter(isEmailMessage).length === 0 ? <p className="rounded-md border border-dashed p-3 text-sm text-[var(--g66-text-secondary)]">No hay correos asociados.</p> : null}
              </div>
            ) : null}
            {relatedView === "ai" ? (
              <>
                <Field label="Resumen IA" value={selectedCase.ai_summary || "Sin resumen IA"} />
                <Field label="AI Category" value={selectedCase.ai_category || "Sin categoría IA"} />
                <Field label="AI Sentiment" value={selectedCase.ai_sentiment || "Sin sentimiento IA"} />
                <Field label="AI Resolution" value={selectedCase.ai_resolution || "Sin resolución IA"} />
                <Field
                  label="AI Confidence"
                  value={
                    selectedCase.ai_confidence === null ||
                    selectedCase.ai_confidence === undefined
                      ? "Sin confianza IA"
                      : `${Math.round(selectedCase.ai_confidence * 100)}%`
                  }
                />
              </>
            ) : null}
            {relatedView === "history" ? (
              <>
                <Field label="Caso creado" value={formatDateTime(selectedCase.created_at)} />
                <Field label="Última actualización" value={formatDateTime(selectedCase.updated_at)} />
                <Field label="Caso cerrado" value={formatDateTime(selectedCase.closed_at)} />
                <div className="grid gap-2">
                  {auditEvents.length > 0 ? (
                    auditEvents.slice(0, 10).map((event) => (
                      <AuditEventCard
                        key={`related-history-audit-${event.id}`}
                        event={event}
                        agentNames={agentNames}
                      />
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">
                      No hay historial detallado de cambios para este caso todavía.
                    </div>
                  )}
                </div>
              </>
            ) : null}
            {relatedView === "activity" ? (
              <>
                <Field label="Estado del caso" value={selectedLifecycleStatus} />
                <Field label="Estado de atención" value={selectedRoutingStatus} />
                <Field label="Agente asignado" value={getAgentLabel(selectedCase, agentNames)} />
                <Field label="Último mensaje" value={getMessagePreview(selectedLatestMessage)} />
                {auditEvents.slice(0, 5).map((event) => (
                  <AuditEventCard
                    key={`related-activity-audit-${event.id}`}
                    event={event}
                    agentNames={agentNames}
                  />
                ))}
                {canViewCallHistory && aircallCalls.slice(0, 5).map((call) => (
                  <AircallCallCard key={`related-activity-aircall-${call.id}`} call={call} />
                ))}
              </>
            ) : null}
            {relatedView === "aircall" ? (
              <div className="grid gap-2">
                {aircallCalls.length > 0 ? (
                  aircallCalls.map((call) => (
                    <AircallCallCard key={`related-aircall-${call.id}`} call={call} />
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">
                    No hay llamadas Aircall registradas para este caso.
                  </div>
                )}
              </div>
            ) : null}
            {relatedView === "sla" && selectedCaseSla ? (
              <>
                <Field
                  label="FRT"
                  value={
                    selectedCaseSla.firstAgentResponseAt
                      ? formatDuration(selectedCaseSla.frtSeconds)
                      : `Pendiente · ${formatDuration(selectedCaseSla.frtSeconds)}`
                  }
                />
                <Field
                  label="AHT Total"
                  value={formatDuration(selectedCaseSla.ahtTotalSeconds)}
                />
                <Field
                  label="AHT Ejecutivo"
                  value={formatDuration(selectedCaseSla.ahtAgentSeconds)}
                />
                <Field
                  label="TTC"
                  value={
                    selectedCaseSla.ttcSeconds === null
                      ? "En curso"
                      : formatDuration(selectedCaseSla.ttcSeconds)
                  }
                />
                <Field
                  label="Estado SLA"
                  value={
                    getFrtSlaState(
                      selectedCaseSla.frtSeconds,
                      Boolean(selectedCaseSla.firstAgentResponseAt),
                    ) === "Breached"
                      ? "Vencido"
                      : getFrtSlaState(
                          selectedCaseSla.frtSeconds,
                          Boolean(selectedCaseSla.firstAgentResponseAt),
                        )
                  }
                />
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {isMacroModalOpen ? (
        <div className="absolute inset-0 z-40 bg-black/20">
          <div className="absolute right-4 top-16 flex w-[min(520px,92vw)] flex-col rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-soft)]">
            <div className="flex h-12 items-center justify-between border-b border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] px-4">
              <h2 className="text-sm font-black text-[var(--g66-text-primary)]">
                Ejecutar macro
              </h2>
              <button
                type="button"
                onClick={() => setIsMacroModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-xs font-bold text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
              >
                ×
              </button>
            </div>
            <div className="grid gap-3 p-3">
              {activeMacros.length > 0 ? (
                <>
                  <label className="grid gap-1 text-sm font-semibold text-[var(--g66-text-primary)]">
                    Macro activa
                    <select
                      value={selectedMacroId}
                      onChange={(event) => setSelectedMacroId(event.target.value)}
                      className="h-9 rounded-md border border-[var(--g66-border)] bg-white px-3 text-sm outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
                    >
                      {activeMacros.map((macro) => (
                        <option key={macro.id} value={macro.id}>
                          {macro.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedMacro?.description ? (
                    <p className="rounded-md bg-[var(--g66-background)] p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">
                      {selectedMacro.description}
                    </p>
                  ) : null}
                  <div className="rounded-md border border-[var(--g66-border)]">
                    <div className="border-b border-[var(--g66-border)] bg-[var(--g66-background)] px-3 py-2">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
                        Resumen de acciones
                      </h3>
                    </div>
                    <ol className="divide-y divide-[var(--g66-border)]">
                      {(selectedMacro?.macro_actions ?? [])
                        .slice()
                        .sort(
                          (actionA, actionB) =>
                            (actionA.sort_order ?? 0) -
                            (actionB.sort_order ?? 0),
                        )
                        .map((action, index) => (
                          <li
                            key={action.id}
                            className="px-3 py-2 text-sm font-semibold text-[var(--g66-text-primary)]"
                          >
                            {index + 1}. {getMacroActionSummary(action)}
                          </li>
                        ))}
                      {(selectedMacro?.macro_actions ?? []).length === 0 ? (
                        <li className="px-3 py-4 text-sm font-semibold text-[var(--g66-text-secondary)]">
                          Esta macro no tiene acciones configuradas.
                        </li>
                      ) : null}
                    </ol>
                  </div>
                </>
              ) : (
                <p className="rounded-md border border-dashed border-[var(--g66-border)] p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">
                  No hay macros activas para casos.
                </p>
              )}
            </div>
            <div className="flex h-12 items-center justify-end gap-2 border-t border-[var(--g66-border)] px-4">
              <button
                type="button"
                onClick={() => setIsMacroModalOpen(false)}
                className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--g66-border)] bg-white px-3 text-xs font-semibold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-background)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  pendingAction !== null ||
                  !selectedMacroId ||
                  activeMacros.length === 0
                }
                onClick={executeSelectedMacro}
                className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--g66-brand-blue)] px-3 text-xs font-semibold text-white hover:bg-[var(--g66-accent-cyan)] disabled:cursor-not-allowed disabled:bg-[var(--g66-border)]"
              >
                {pendingAction === "macro" ? "Ejecutando..." : "Ejecutar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedEmailMessage ? (
        <div className="absolute inset-0 z-40 bg-black/20">
          <div className="absolute inset-y-0 right-0 flex w-[min(720px,92vw)] flex-col border-l border-[var(--g66-border)] bg-white shadow-2xl">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--g66-border)] px-3">
              <h2 className="truncate text-sm font-bold text-[var(--g66-text-primary)]">
                {selectedEmailMessage.email_subject || "Correo completo"}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedEmailMessage(null)}
                className="flex h-7 w-7 items-center justify-center rounded border border-[var(--g66-border)] text-xs font-bold text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)]"
              >
                ×
              </button>
            </div>
            <div className="shrink-0 border-b border-[var(--g66-border)] bg-[var(--g66-background)] p-3">
              <dl className="grid gap-2 text-xs md:grid-cols-2">
                <Field
                  label="De"
                  value={selectedEmailMessage.email_from || "Sin remitente"}
                />
                <Field
                  label="Para"
                  value={selectedEmailMessage.email_to || "Sin destinatario"}
                />
                <Field label="CC" value={selectedEmailMessage.email_cc || "Sin CC"} />
                <Field
                  label="Fecha"
                  value={formatDateTime(selectedEmailMessage.created_at)}
                />
                <div className="md:col-span-2">
                  <Field
                    label="Asunto"
                    value={selectedEmailMessage.email_subject || "Sin asunto"}
                  />
                </div>
              </dl>
            </div>
            {attachmentItems.filter(
              (attachment) =>
                String(attachment.message_id) === String(selectedEmailMessage.id),
            ).length > 0 ? (
              <div className="shrink-0 border-b border-[var(--g66-border)] bg-white p-3">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
                  <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                  Adjuntos
                </h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {attachmentItems
                    .filter(
                      (attachment) =>
                        String(attachment.message_id) ===
                        String(selectedEmailMessage.id),
                    )
                    .map((attachment) => (
                      <div
                        key={attachment.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[var(--g66-border)] bg-[var(--g66-background)] p-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[var(--g66-text-primary)]">
                            {attachment.filename || "Adjunto"}
                          </p>
                          <p className="truncate text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                            {[attachment.mime_type, formatAttachmentSize(attachment.size_bytes)]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <a
                          href={`/api/attachments/${attachment.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-7 items-center justify-center rounded border border-[var(--g66-border)] bg-white px-2 text-[11px] font-bold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-background)]"
                        >
                          Ver/Descargar
                        </a>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto bg-white">
              <iframe
                title="Correo completo"
                sandbox=""
                srcDoc={buildEmailSrcDoc(selectedEmailMessage)}
                className="h-full min-h-[420px] w-full border-0"
              />
            </div>
            {(() => {
              const quoted = splitQuotedEmailText(
                selectedEmailMessage.email_text_body ||
                  selectedEmailMessage.body ||
                  "",
              ).quoted;

              return quoted ? (
                <details className="shrink-0 border-t border-[var(--g66-border)] bg-[var(--g66-background)] p-3">
                  <summary className="cursor-pointer text-xs font-bold text-[var(--g66-brand-blue)]">
                    Mostrar conversación anterior
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-[var(--g66-border)] bg-white p-2 text-xs text-[var(--g66-text-secondary)]">
                    {quoted}
                  </pre>
                </details>
              ) : null;
            })()}
          </div>
        </div>
      ) : null}
    </section>
  );
}
