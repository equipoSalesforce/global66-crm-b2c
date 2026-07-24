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
  formatDuration,
  type CaseNotificationStatus,
} from "@/lib/case-sla";
import { computeCaseInfoSla } from "@/lib/case-sla-service";
import { getCaseAssignmentAuthorization } from "@/lib/case-assignment-authorization";
import type {
  CaseCallRecord,
  CaseInfoLinkView,
} from "@/lib/case-info-links-types";
import {
  buildCustomValuePayload,
  getCustomValueForField,
  isCustomValueCaseField,
  validateCustomFieldValue,
  type CaseCustomValue,
  type CaseFieldDefinition,
  type CaseLayoutTabWithSections,
  type ResolvedCaseAreaLayout,
} from "@/lib/case-metadata";
import type { CaseAssignmentResult, CaseOwnerType, DuplicateCaseResult } from "@/lib/case-ownership-types";
import type {
  CaseDetailFormSection,
  CaseDetailSidebarField,
  CaseDetailSidebarViewModel,
} from "@/lib/case-detail-sidebar-types";
import type { KnowledgeSuggestionPayload } from "@/lib/ai-knowledge-types";
import { normalizeAircallPhone } from "@/lib/aircall";
import {
  canEditCaseField,
  canViewCaseField,
  hasPermission,
  type CrmCaseFieldPermissionRecord,
  type CrmRolePermissionRecord,
} from "@/lib/permissions";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bot,
  BookOpen,
  Check,
  CheckCheck,
  CornerDownLeft,
  Copy,
  FileText,
  FileSpreadsheet,
  History,
  Layers3,
  Mail,
  MessageCircle,
  Paperclip,
  PhoneCall,
  Search,
  Star,
  User,
  UserPlus,
  Wand2,
  X,
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
import { CaseCallsSection } from "./cases/case-calls-section";
import {
  ActivityIconBadge,
  ActivityListControls,
  type ActivityActor,
  type ActivityChannel,
} from "./cases/activity-event-ui";
import { CaseAttentionTime } from "./cases/case-attention-time";
import { CaseInfoLinksPanel } from "./cases/case-info-links-panel";
import {
  CaseMacroModal,
  type CaseMacro,
  type CaseMacroAction,
} from "./cases/case-macro-modal";
import { CasePriorityIndicator } from "./cases/case-priority-indicator";
import { CaseQaNotesSection } from "./cases/case-qa-notes-section";
import { CaseRelatedCasesSection } from "./cases/case-related-cases-section";
import { CaseSlaSection } from "./cases/case-sla-section";
import {
  CaseAssignmentModal,
  DuplicateCaseModal,
  type DuplicateModalCustomField,
} from "./cases/case-header-action-modals";
import originalStyles from "./cases/case-detail-original.module.css";
import { caseDetailManrope, caseDetailMono } from "./cases/case-detail-fonts";
import { useToast } from "./toast-provider";
import { useDemoRole } from "./use-demo-role";

export type ConsoleCaseRecord = {
  id: string;
  case_number: string | null;
  customer_id: string | number | null;
  subject: string | null;
  description?: string | null;
  numero_caso_seguimiento?: string | null;
  channel: string | null;
  contact_type: string | null;
  status: string | null;
  lifecycle_status: string | null;
  routing_status: string | null;
  priority: string | null;
  area: string | null;
  category: string | null;
  cat_secundaria?: string | null;
  assigned_agent_id: string | null;
  owner_type?: CaseOwnerType | null;
  assigned_queue_id?: string | null;
  assigned_to: string | null;
  assigned_at?: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at?: string | null;
  resolved_at?: string | null;
  resolution_type?: string | null;
  ai_summary?: string | null;
  ai_category?: string | null;
  ai_sentiment?: string | null;
  ai_confidence?: number | null;
  ai_resolution?: string | null;
  product?: string | null;
  subproduct?: string | null;
  is_edge_case?: boolean | null;
  is_merged?: boolean | null;
  merged_into_case_id?: string | null;
  merged_into_case?: {
    id: string;
    case_number: string | null;
  } | null;
  duplicated_from_case_id?: string | null;
  owner_queue?: { name: string | null; key: string | null } | null;
  customer: {
    name: string | null;
    email?: string | null;
    phone?: string | null;
    public_id?: string | null;
  } | null;
};

async function loadMergedIntoCaseReference(
  caseItem: Pick<
    ConsoleCaseRecord,
    "id" | "lifecycle_status" | "status"
  >,
): Promise<
  Pick<
    ConsoleCaseRecord,
    "is_merged" | "merged_into_case_id" | "merged_into_case"
  >
> {
  const isMergedByStatus =
    caseItem.lifecycle_status === "MERGED" || caseItem.status === "MERGED";

  if (!isMergedByStatus) {
    return {
      is_merged: false,
      merged_into_case_id: null,
      merged_into_case: null,
    };
  }

  const { data: mergeMetadata, error: mergeMetadataError } =
    await supabaseBrowser
      .from("cases")
      .select("is_merged, merged_into_case_id")
      .eq("id", caseItem.id)
      .maybeSingle<{
        is_merged: boolean | null;
        merged_into_case_id: string | null;
      }>();

  if (mergeMetadataError || !mergeMetadata?.merged_into_case_id) {
    if (mergeMetadataError) {
      console.warn("[cases-console] Merge metadata is not available", {
        caseId: caseItem.id,
        message: mergeMetadataError.message,
      });
    }
    return {
      is_merged: true,
      merged_into_case_id: null,
      merged_into_case: null,
    };
  }

  const { data, error } = await supabaseBrowser
    .from("cases")
    .select("id, case_number")
    .eq("id", mergeMetadata.merged_into_case_id)
    .maybeSingle<{ id: string; case_number: string | null }>();

  if (error) {
    console.warn("[cases-console] Could not load merged destination case", {
      mergedIntoCaseId: mergeMetadata.merged_into_case_id,
      message: error.message,
    });
  }

  return {
    is_merged: mergeMetadata.is_merged ?? true,
    merged_into_case_id: mergeMetadata.merged_into_case_id,
    merged_into_case: error ? null : data,
  };
}

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
type PendingAction =
  | "status"
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
const lifecyclePathStatuses = [
  "NEW",
  "IN_PROGRESS",
  "STAND_BY",
  "RESOLVED",
  "CLOSED",
] as const satisfies readonly LifecycleStatus[];
type LifecyclePathStatus = (typeof lifecyclePathStatuses)[number];
const lifecyclePathLabels: Record<LifecyclePathStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In Progress",
  STAND_BY: "Stand By",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
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

function matchesActivityDate(value: string | null | undefined, date: string) {
  if (!date) return true;
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` === date;
}

function sortByActivityDate<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
  order: "newest" | "oldest",
) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(getDate(left) ?? 0).getTime() || 0;
    const rightTime = new Date(getDate(right) ?? 0).getTime() || 0;
    return order === "newest" ? rightTime - leftTime : leftTime - rightTime;
  });
}

function getMessageActivityChannel(message: ConsoleMessageRecord): ActivityChannel {
  const value = `${message.channel ?? ""} ${message.message_type ?? ""}`.toLowerCase();
  if (value.includes("email") || value.includes("gmail") || value.includes("ticket")) return "email";
  if (value.includes("call") || value.includes("aircall") || value.includes("phone")) return "call";
  if (value.includes("chat") || value.includes("webchat")) return "chat";
  if (value.includes("social") || value.includes("rrss")) return "rrss";
  if (value.includes("whatsapp") || !value.trim()) return "whatsapp";
  return "system";
}

function getMessageActivityActor(message: ConsoleMessageRecord): ActivityActor {
  const sender = message.sender_type?.toLowerCase() ?? "";
  const direction = message.direction?.toLowerCase() ?? "";
  if (sender.includes("ai") || sender.includes("bot")) return "ai";
  if (sender.includes("customer") || sender.includes("client") || direction === "inbound") return "customer";
  if (sender.includes("agent") || sender.includes("executive") || direction === "outbound") return "agent";
  if (sender.includes("admin") || sender.includes("system")) return "system";
  return "unknown";
}

function getAuditActivityActor(event: CaseAuditEvent): ActivityActor {
  const value = `${event.actor_role ?? ""} ${event.source ?? ""}`.toLowerCase();
  if (value.includes("ai")) return "ai";
  if (value.includes("agent") || value.includes("executive")) return "agent";
  if (event.actor_user_id || event.actor_name || event.actor_email) return "agent";
  return "system";
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={`${originalStyles.fieldLabel} uppercase`}>
        {label}
      </dt>
      <dd className={`${originalStyles.fieldValue} break-words`}>
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
    <div className={`min-w-0 ${className}`}>
      <p className={`${originalStyles.metadataItemLabel} uppercase`}>
        {label}
      </p>
      <div className={`${originalStyles.metadataItemValue} flex min-w-0 items-center`}>
        {children}
      </div>
    </div>
  );
}

function getHeaderChannelLabel(channel: string | null | undefined) {
  const normalized = channel?.trim().toUpperCase();

  if (normalized === "WHATSAPP") return "WhatsApp";
  if (normalized === "GMAIL" || normalized === "EMAIL") return "Email";
  if (normalized === "AIRCALL" || normalized === "PHONE") return "Teléfono";

  return channel?.trim() || "Sin canal";
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
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 text-[11px] font-semibold text-[var(--g66-text-secondary)]">
            {formatDateTime(event.created_at)}
          </span>
          <ActivityIconBadge kind="channel" value="system" />
          <ActivityIconBadge kind="actor" value={getAuditActivityActor(event)} />
        </div>
      </div>
    </article>
  );
}

function getAircallCallTitle(call: CaseCallRecord) {
  const direction = call.direction?.toLowerCase();

  if (direction === "inbound") return "Llamada entrante";
  if (direction === "outbound") return "Llamada saliente";

  return "Llamada Aircall";
}

function getAircallDurationLabel(seconds: number | null) {
  if (seconds === null || seconds === undefined) return "Sin duración";

  return formatDuration(seconds);
}

function AircallCallCard({ call }: { call: CaseCallRecord }) {
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
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 text-[11px] font-semibold text-[var(--g66-text-secondary)]">
            {formatDateTime(call.started_at || call.created_at)}
          </span>
          <ActivityIconBadge kind="channel" value="call" />
          <ActivityIconBadge kind="actor" value={call.aircall_user_id || call.crm_user_id ? "agent" : "unknown"} />
        </div>
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
  knowledgeSuggestion,
  onKnowledgeFeedback,
}: {
  selectedCase: ConsoleCaseRecord;
  payload: CaseAiHistoryResponse | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  canGenerate: boolean;
  onGenerate: () => void;
  knowledgeSuggestion: KnowledgeSuggestionPayload | null;
  onKnowledgeFeedback: (rating: "HELPFUL" | "NOT_HELPFUL") => void;
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
        {knowledgeSuggestion ? (
          <section className="rounded-[var(--g66-radius-lg)] border border-blue-200 bg-white p-4 shadow-[var(--g66-shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--g66-text-primary)]"><BookOpen className="h-4 w-4 text-[var(--g66-brand-blue)]" />Sugerencia basada en conocimiento</h3><p className="mt-1 text-xs text-[var(--g66-text-secondary)]">Respuesta insertada en el composer para revisión del ejecutivo.</p></div>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">Confianza {knowledgeSuggestion.confidence}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-[var(--g66-surface-soft)] p-3 text-sm leading-6 text-[var(--g66-text-primary)]">{knowledgeSuggestion.customerReply}</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div><h4 className="text-xs font-semibold">Fuentes utilizadas</h4><ul className="mt-2 grid gap-1 text-xs text-[var(--g66-text-secondary)]">{knowledgeSuggestion.sources.map((source, index) => <li key={`${source.title}-${source.version}-${index}`}>• {source.title} · {source.source} · {source.version}</li>)}{!knowledgeSuggestion.sources.length ? <li>No se encontró una fuente publicada suficiente.</li> : null}</ul></div>
              <div><h4 className="text-xs font-semibold">Próximas acciones</h4><ul className="mt-2 grid gap-1 text-xs text-[var(--g66-text-secondary)]">{knowledgeSuggestion.nextActions.map((action) => <li key={action}>• {action}</li>)}{!knowledgeSuggestion.nextActions.length ? <li>Sin acciones sugeridas.</li> : null}</ul></div>
            </div>
            {knowledgeSuggestion.warnings.length || knowledgeSuggestion.missingInfo.length ? <div className="mt-3 grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{knowledgeSuggestion.warnings.length ? <p><strong>Advertencias internas:</strong> {knowledgeSuggestion.warnings.join(" · ")}</p> : null}{knowledgeSuggestion.missingInfo.length ? <p><strong>Datos faltantes:</strong> {knowledgeSuggestion.missingInfo.join(" · ")}</p> : null}</div> : null}
            <div className="mt-3 flex items-center justify-end gap-2"><span className="text-[10px] text-[var(--g66-text-muted)]">¿Fue útil?</span><button type="button" onClick={() => onKnowledgeFeedback("HELPFUL")} className="h-7 rounded-lg border px-2 text-[10px] font-semibold text-emerald-700">Sí</button><button type="button" onClick={() => onKnowledgeFeedback("NOT_HELPFUL")} className="h-7 rounded-lg border px-2 text-[10px] font-semibold text-slate-600">No</button></div>
          </section>
        ) : null}
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
    <section className={originalStyles.sideCard}>
      <div className={`${originalStyles.sideCardHeader} flex items-center justify-between`}>
        <h3 className={`${originalStyles.sideCardTitle} flex items-center`}>
          {icon ? (
            <span className={`${originalStyles.sideCardIcon} flex items-center justify-center bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]`}>
              {icon}
            </span>
          ) : null}
          {title}
        </h3>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={originalStyles.sideCardBody}>{children}</div>
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
    <div className={`${originalStyles.quickCopyRow} grid grid-cols-[minmax(0,1fr)_auto] items-center`}>
      <div className="min-w-0">
        <p className={`${originalStyles.quickCopyLabel} uppercase`}>
          {label}
        </p>
        <p className={`${originalStyles.quickCopyValue} truncate`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className={`${originalStyles.quickCopyButton} inline-flex items-center justify-center border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]`}
        aria-label={`Copiar ${label}`}
        title={`Copiar ${label}`}
      >
        <Copy className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

function SidebarFieldRow({
  field,
  onCopy,
}: {
  field: CaseDetailSidebarField;
  onCopy: (value: string, label: string) => void;
}) {
  if (field.fieldKey === "layout_spacer") {
    return <div aria-hidden="true" className="h-3" />;
  }

  if (field.fieldType === "STARS") {
    const score = typeof field.value === "number" ? field.value : null;
    return (
      <div className={originalStyles.quickCopyRow}>
        <p className={`${originalStyles.quickCopyLabel} uppercase`}>{field.label}</p>
        <div className="mt-1 flex items-center gap-0.5" aria-label={score ? `${score} de 5` : "Sin evaluación"}>
          {[1, 2, 3, 4, 5].map((position) => (
            <Star
              key={position}
              className={`h-3.5 w-3.5 ${
                score !== null && position <= score
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-[var(--g66-border)]"
              }`}
              aria-hidden="true"
            />
          ))}
          <span className="ml-1 text-[10px] font-medium text-[var(--g66-text-muted)]">
            {score === null ? "—" : `${score}/5`}
          </span>
        </div>
      </div>
    );
  }

  if (field.fieldType === "CHECK" || field.fieldType === "BOOLEAN") {
    return (
      <div className={`${originalStyles.quickCopyRow} flex items-center justify-between gap-2`}>
        <p className={`${originalStyles.quickCopyLabel} uppercase`}>{field.label}</p>
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
            field.status === "positive"
              ? "bg-[var(--g66-success-soft)] text-[var(--g66-success)]"
              : field.status === "negative"
                ? "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]"
                : "bg-[var(--g66-surface-soft)] text-[var(--g66-text-muted)]"
          }`}
          title={field.displayValue}
        >
          {field.status === "positive" ? (
            <Check className="h-3 w-3" aria-hidden="true" />
          ) : field.status === "negative" ? (
            <X className="h-3 w-3" aria-hidden="true" />
          ) : (
            <span aria-hidden="true">—</span>
          )}
          <span className="sr-only">{field.displayValue}</span>
        </span>
      </div>
    );
  }

  if (field.fieldType === "LINK") {
    return (
      <div className={originalStyles.quickCopyRow}>
        <p className={`${originalStyles.quickCopyLabel} uppercase`}>{field.label}</p>
        {field.href ? (
          <a
            href={field.href}
            className={`${originalStyles.quickCopyValue} block truncate text-[var(--g66-brand-blue)] hover:underline`}
          >
            {field.displayValue}
          </a>
        ) : (
          <p className={originalStyles.quickCopyValue}>{field.displayValue}</p>
        )}
      </div>
    );
  }

  if (field.isCopyable && field.copyValue) {
    return (
      <QuickCopyRow
        label={field.label}
        value={field.displayValue}
        onCopy={() => onCopy(field.copyValue!, `${field.label} copiado`)}
      />
    );
  }

  return <Field label={field.label} value={field.displayValue} />;
}

function SidebarSectionFields({
  fields,
  onCopy,
}: {
  fields: CaseDetailSidebarField[];
  onCopy: (value: string, label: string) => void;
}) {
  if (fields.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-2 text-[11px] text-[var(--g66-text-secondary)]">
        No hay campos visibles configurados.
      </p>
    );
  }

  return (
    <div className="grid gap-1.5">
      {fields.map((field) => (
        <SidebarFieldRow key={`${field.sourceType}:${field.fieldKey}`} field={field} onCopy={onCopy} />
      ))}
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

function formSectionsToSaveTab(
  sections: CaseDetailFormSection[],
): CaseLayoutTabWithSections {
  return {
    id: "configured-case-form",
    tab_key: "configured-case-form",
    label: "Form",
    sort_order: 0,
    is_active: true,
    sections: sections.map((section, sectionIndex) => ({
      id: section.id,
      tab_id: "configured-case-form",
      label: section.name,
      sort_order: (sectionIndex + 1) * 10,
      is_active: true,
      fields: section.items.flatMap((item, itemIndex) => {
        if (item.type !== "FIELD" || item.field.sourceType !== "CASE") return [];
        const definition = item.field.caseDefinition;
        if (!definition) return [];
        return [{
          id: item.id,
          section_id: section.id,
          field_definition_id: definition.id,
          sort_order: (itemIndex + 1) * 10,
          column_span: item.columnSpan,
          is_readonly: !item.editable,
          field_definition: {
            ...definition,
            is_required: item.required,
          },
        }];
      }),
    })),
  };
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

function getMacroActionSummary(action: CaseMacroAction) {
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

function HighlightedMessageText({ text, query }: { text: string; query: string }) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return text;

  const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));

  return parts.map((part, index) =>
    part.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase()) ? (
      <mark key={`${part}-${index}`} className="rounded bg-amber-200 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function getExportDateParts(value: string | null | undefined) {
  if (!value) return { date: "Sin fecha", time: "Sin hora" };

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return { date: "Sin fecha", time: "Sin hora" };
  }

  return {
    date: new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parsedDate),
    time: new Intl.DateTimeFormat("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(parsedDate),
  };
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getWhatsappExportFields(message: ConsoleMessageRecord) {
  const outbound = isOutbound(message);
  const { date, time } = getExportDateParts(message.created_at);

  return {
    date,
    time,
    direction: message.direction || (outbound ? "Saliente" : "Entrante"),
    author: message.sender_type || (outbound ? "Agente" : "Cliente"),
    body: message.body || "Sin contenido",
    channel: message.channel || "WHATSAPP",
    type: message.message_type || message.media_type || "Texto",
  };
}

function sortMessagesChronologically(messages: ConsoleMessageRecord[]) {
  return [...messages].sort((messageA, messageB) => {
    const timestampA = new Date(messageA.created_at ?? 0).getTime();
    const timestampB = new Date(messageB.created_at ?? 0).getTime();

    return (Number.isNaN(timestampA) ? 0 : timestampA) -
      (Number.isNaN(timestampB) ? 0 : timestampB);
  });
}

export function CasesConsole({
  cases,
  messages,
  agents,
  currentUser,
  rolePermissions = [],
  caseFieldPermissions = [],
  initialSelectedCaseId,
  initialSidebarViewModel,
}: {
  cases: ConsoleCaseRecord[];
  messages: ConsoleMessageRecord[];
  agents: ConsoleAgentRecord[];
  currentUser: { id: string; role: string };
  rolePermissions?: CrmRolePermissionRecord[];
  caseFieldPermissions?: CrmCaseFieldPermissionRecord[];
  initialSelectedCaseId?: string;
  initialSidebarViewModel: CaseDetailSidebarViewModel;
}) {
  const toast = useToast();
  const router = useRouter();
  const { role } = useDemoRole();
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
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
  const [isWhatsappSearchOpen, setIsWhatsappSearchOpen] = useState(false);
  const [whatsappSearchQuery, setWhatsappSearchQuery] = useState("");
  const [whatsappSearchIndex, setWhatsappSearchIndex] = useState(0);
  const [isWhatsappExpanded, setIsWhatsappExpanded] = useState(false);
  const [isWhatsappAtBottom, setIsWhatsappAtBottom] = useState(true);
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
  const [sidebarViewModel, setSidebarViewModel] = useState(initialSidebarViewModel);
  const [auditEvents, setAuditEvents] = useState<CaseAuditEvent[]>([]);
  const [aircallCalls, setAircallCalls] = useState<CaseCallRecord[]>([]);
  const [aiHistoryPayload, setAiHistoryPayload] =
    useState<CaseAiHistoryResponse | null>(null);
  const [isAiHistoryLoading, setIsAiHistoryLoading] = useState(false);
  const [isAiHistoryGenerating, setIsAiHistoryGenerating] = useState(false);
  const [aiHistoryError, setAiHistoryError] = useState<string | null>(null);
  const [knowledgeSuggestions, setKnowledgeSuggestions] = useState<Record<string, KnowledgeSuggestionPayload>>({});
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>(
    {},
  );
  const [activeMacros, setActiveMacros] = useState<CaseMacro[]>([]);
  const [selectedMacroId, setSelectedMacroId] = useState("");
  const [macroSearchQuery, setMacroSearchQuery] = useState("");
  const [recentMacroIds, setRecentMacroIds] = useState<string[]>([]);
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [whatsappNotificationCases, setWhatsappNotificationCases] = useState<
    WhatsappNotificationCase[]
  >([]);
  const [whatsappPendingCount, setWhatsappPendingCount] = useState(0);
  const [relatedView, setRelatedView] = useState<CaseInfoLinkView | null>(null);
  const [activityQuery, setActivityQuery] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [activityOrder, setActivityOrder] = useState<"newest" | "oldest">("oldest");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyDate, setHistoryDate] = useState("");
  const [historyOrder, setHistoryOrder] = useState<"newest" | "oldest">("newest");
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

  useEffect(() => {
    function handleKnowledgeSuggestion(event: Event) {
      const detail = (event as CustomEvent<KnowledgeSuggestionPayload & { caseId?: string }>).detail;
      if (!detail?.caseId || !detail.customerReply) return;
      setKnowledgeSuggestions((current) => ({
        ...current,
        [detail.caseId!]: {
          customerReply: detail.customerReply,
          agentSummary: detail.agentSummary || "",
          nextActions: detail.nextActions || [],
          sources: detail.sources || [],
          confidence: detail.confidence || "LOW",
          missingInfo: detail.missingInfo || [],
          warnings: detail.warnings || [],
        },
      }));
    }
    window.addEventListener("case-ai-knowledge-suggestion", handleKnowledgeSuggestion);
    return () => window.removeEventListener("case-ai-knowledge-suggestion", handleKnowledgeSuggestion);
  }, []);

  async function submitKnowledgeFeedback(rating: "HELPFUL" | "NOT_HELPFUL") {
    if (!selectedCaseId) return;
    try {
      const response = await fetch("/api/knowledge/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: selectedCaseId, rating }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo registrar el feedback.");
      toast.success("Feedback de conocimiento registrado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el feedback.");
    }
  }
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
      .returns<CaseCallRecord[]>();

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
        const response = await fetch(
          `/api/cases/${caseId}/ai-history-summary`,
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
          body: JSON.stringify({}),
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
    if (selectedCaseId) {
      window.localStorage.setItem("casesConsoleSelectedCaseId", selectedCaseId);
    }
  }, [selectedCaseId]);

  useEffect(() => {
    if (
      (workTab !== "ai" && relatedView !== "ai") ||
      !selectedCaseId ||
      !canViewAiCaseSummary
    ) return;

    const timeoutId = window.setTimeout(() => {
      void loadAiHistorySummary(selectedCaseId);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canViewAiCaseSummary, loadAiHistorySummary, relatedView, selectedCaseId, workTab]);

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
            "id, tab_key, label, sort_order, is_active, created_at, sections:case_layout_sections(id, tab_id, label, sort_order, is_active, fields:case_layout_fields(id, section_id, field_definition_id, sort_order, column_span, is_readonly, field_definition:case_field_definitions(id, field_key, label, field_type, description, is_required, is_active, is_standard, storage_type, column_name, is_editable, is_filterable, is_list_visible, is_form_eligible, is_detail_eligible, is_system, sort_order, picklist_values, default_value, created_at, updated_at)))",
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
          "id, case_number, customer_id, subject, description, numero_caso_seguimiento, channel, contact_type, status, lifecycle_status, routing_status, priority, area, category, cat_secundaria, product, subproduct, is_edge_case, assigned_agent_id, owner_type, assigned_queue_id, assigned_to, assigned_at, duplicated_from_case_id, contact_name, contact_email, contact_phone, created_at, updated_at, closed_at, resolution_type, ai_summary, ai_category, ai_sentiment, ai_confidence, ai_resolution, customer:customers(name, email, phone, public_id), owner_queue:crm_queues(name, key)",
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

      const mergedContext = await loadMergedIntoCaseReference(data);
      if (!isMounted) return;

      setCaseItems((currentCases) =>
        currentCases.map((caseItem) =>
          caseItem.id === selectedCaseId
            ? { ...caseItem, ...data, ...mergedContext }
            : caseItem,
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
  const sidebarSectionsByKey = new Map(
    sidebarViewModel.sections.map((section) => [section.sectionKey, section]),
  );
  const sidebarPermissionFieldByKey: Record<string, string> = {
    email: "contact_email",
    whatsapp: "contact_phone",
    case_owner: "assigned_agent_id",
    caso_borde: "is_edge_case",
  };
  const sidebarFields = (sectionKey: "CUSTOMER_INFO" | "CASE_INFO" | "CASE_PROPERTIES" | "CSAT") => {
    const fields = sidebarSectionsByKey.get(sectionKey)?.fields ?? [];
    if (sectionKey === "CUSTOMER_INFO" || sectionKey === "CSAT") return fields;
    return fields.filter((field) =>
      canViewCaseInfoField(sidebarPermissionFieldByKey[field.fieldKey] ?? field.fieldKey),
    );
  };
  const editablePropertyFields = sidebarFields("CASE_PROPERTIES").filter(
    (field) =>
      field.sourceType === "CASE" &&
      field.isEditable &&
      field.caseDefinition &&
      canEditCaseInfoField(field.fieldKey),
  );
  const canEditAnyCaseInfoField = editablePropertyFields.length > 0;
  const selectedCaseMessages = selectedCase
    ? messagesByCase.get(selectedCase.id) ?? []
    : [];
  const selectedWhatsappMessages = selectedCaseMessages.filter((message) => {
    const channel = message.channel?.toUpperCase() ?? "";

    return !channel || channel === "WHATSAPP" || channel === "AI";
  });
  const selectedEmailMessages = selectedCaseMessages.filter(isEmailMessage);
  const normalizedActivityQuery = activityQuery.trim().toLocaleLowerCase();
  const filteredActivityMessages = sortByActivityDate(
    selectedCaseMessages.filter((message) => {
      const searchable = [
        message.sender_type,
        message.direction,
        message.channel,
        message.email_subject,
        message.email_from,
        message.email_to,
        message.body,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!normalizedActivityQuery || searchable.includes(normalizedActivityQuery)) &&
        matchesActivityDate(message.created_at, activityDate)
      );
    }),
    (message) => message.created_at,
    activityOrder,
  );
  const filteredActivityCalls = sortByActivityDate(
    aircallCalls.filter((call) => {
      const searchable = [
        call.aircall_user_name,
        call.aircall_user_email,
        call.customer_phone,
        call.phone_number,
        call.status,
        call.result,
        call.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!normalizedActivityQuery || searchable.includes(normalizedActivityQuery)) &&
        matchesActivityDate(call.started_at || call.created_at, activityDate)
      );
    }),
    (call) => call.started_at || call.created_at,
    activityOrder,
  );
  const normalizedHistoryQuery = historyQuery.trim().toLocaleLowerCase();
  const filteredAuditEvents = sortByActivityDate(
    auditEvents.filter((event) => {
      const searchable = [
        getAuditActionLabel(event),
        event.actor_name,
        event.actor_email,
        event.actor_role,
        event.source,
        event.field_label,
        event.field_key,
        event.old_value,
        event.new_value,
        event.metadata ? JSON.stringify(event.metadata) : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!normalizedHistoryQuery || searchable.includes(normalizedHistoryQuery)) &&
        matchesActivityDate(event.created_at, historyDate)
      );
    }),
    (event) => event.created_at,
    historyOrder,
  );
  const filteredActivityAuditEvents = sortByActivityDate(
    auditEvents.filter((event) => {
      const searchable = [
        getAuditActionLabel(event),
        event.actor_name,
        event.actor_email,
        event.actor_role,
        event.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!normalizedActivityQuery || searchable.includes(normalizedActivityQuery)) &&
        matchesActivityDate(event.created_at, activityDate)
      );
    }),
    (event) => event.created_at,
    activityOrder,
  );
  const filteredEmailMessages = filteredActivityMessages.filter(isEmailMessage);
  const normalizedWhatsappSearchQuery = whatsappSearchQuery.trim().toLocaleLowerCase();
  const whatsappSearchMatches = normalizedWhatsappSearchQuery
    ? selectedWhatsappMessages.filter((message) =>
        [message.sender_type, message.body]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedWhatsappSearchQuery),
      )
    : [];
  const effectiveWhatsappSearchIndex = whatsappSearchMatches.length > 0
    ? Math.min(whatsappSearchIndex, whatsappSearchMatches.length - 1)
    : 0;
  const currentWhatsappSearchMessage = whatsappSearchMatches[effectiveWhatsappSearchIndex] ?? null;
  const selectedLatestMessage = selectedCase
    ? latestMessageByCase.get(selectedCase.id)
    : undefined;
  const selectedLastActivity = selectedCase
    ? getLastActivity(selectedCase, selectedLatestMessage)
    : null;
  const selectedDaysWithoutOperation = getDaysWithoutOperation(selectedLastActivity);
  const selectedCaseInfoSla = selectedCase
    ? computeCaseInfoSla(selectedCase, selectedCaseMessages, auditEvents)
    : null;
  const selectedCaseAssignmentAuthorization = selectedCase
    ? getCaseAssignmentAuthorization({
        ownerType: selectedCase.owner_type,
        assignedAgentId: selectedCase.assigned_agent_id,
        assignedQueueId: selectedCase.assigned_queue_id,
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        configuredPermissions: rolePermissions,
      })
    : { allowed: false, reason: null, basis: "OTHER_AGENT" as const };
  const selectedLifecycleStatus = selectedCase
    ? normalizeLifecycleStatus(selectedCase.lifecycle_status, selectedCase.status)
    : "NEW";
  const selectedCaseIsMerged = Boolean(
    selectedCase?.is_merged || selectedLifecycleStatus === "MERGED",
  );
  const selectedLifecyclePathStatus: LifecyclePathStatus =
    selectedCaseIsMerged || selectedLifecycleStatus === "MERGED"
      ? "CLOSED"
      : selectedLifecycleStatus;
  const selectedLifecyclePathIndex = lifecyclePathStatuses.indexOf(
    selectedLifecyclePathStatus,
  );
  const selectedRoutingStatus = selectedCase
    ? normalizeRoutingStatus({
        routingStatus: selectedCase.routing_status,
        status: selectedCase.status,
        assignedAgentId: selectedCase.assigned_agent_id,
      })
    : "UNASSIGNED";
  const selectedCaseNumberLabel = selectedCase
    ? formatCaseNumber(selectedCase.case_number, selectedCase.id).replace(/^Caso\s*/i, "")
    : "";
  const selectedChannelLabel = selectedCase
    ? getHeaderChannelLabel(selectedCase.channel || selectedCase.contact_type)
    : "Sin canal";
  const workAreaGridClass =
    isQueueOpen && isRightPanelOpen
      ? `${originalStyles.detailBody} grid min-h-0 flex-1 items-stretch xl:grid-cols-[230px_259.2px_minmax(0,1fr)_259.2px]`
      : isQueueOpen
        ? `${originalStyles.detailBody} grid min-h-0 flex-1 items-stretch xl:grid-cols-[230px_259.2px_minmax(0,1fr)_27px]`
        : isRightPanelOpen
          ? `${originalStyles.detailBody} grid min-h-0 flex-1 items-stretch xl:grid-cols-[259.2px_minmax(0,1fr)_259.2px]`
          : `${originalStyles.detailBody} grid min-h-0 flex-1 items-stretch xl:grid-cols-[259.2px_minmax(0,1fr)_27px]`;
  const updateWhatsappScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsWhatsappAtBottom(distanceFromBottom <= 120);
  }, []);

  const scrollWhatsappToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    } else {
      conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    setIsWhatsappAtBottom(true);
  }, []);

  useEffect(() => {
    if (!selectedCase) return;

    const detail = { caseNumber: selectedCaseNumberLabel };
    const publishHeaderContext = () => {
      window.dispatchEvent(new CustomEvent("case-header-context", { detail }));
    };

    window.addEventListener("request-case-header-context", publishHeaderContext);
    publishHeaderContext();

    return () => {
      window.removeEventListener("request-case-header-context", publishHeaderContext);
    };
  }, [selectedCase, selectedCaseNumberLabel]);

  useEffect(() => {
    if (workTab !== "whatsapp") return;

    conversationEndRef.current?.scrollIntoView({ block: "end" });
    const animationFrame = window.requestAnimationFrame(updateWhatsappScrollPosition);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [workTab, selectedCase?.id, selectedWhatsappMessages.length, updateWhatsappScrollPosition]);

  useEffect(() => {
    if (workTab !== "whatsapp") return;

    const animationFrame = window.requestAnimationFrame(updateWhatsappScrollPosition);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isWhatsappExpanded, workTab, updateWhatsappScrollPosition]);

  useEffect(() => {
    if (!currentWhatsappSearchMessage) return;
    document
      .getElementById(`whatsapp-message-${String(currentWhatsappSearchMessage.id)}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentWhatsappSearchMessage]);

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

  function getWhatsappExportFileBase() {
    const caseReference = (selectedCaseNumberLabel || selectedCase?.id || "caso")
      .replace(/^#/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-");
    const exportDate = new Date().toISOString().slice(0, 10);

    return `conversacion-whatsapp-${caseReference}-${exportDate}`;
  }

  function exportWhatsappConversationCsv() {
    const headers = ["Fecha", "Hora", "Dirección", "Autor", "Mensaje", "Canal", "Tipo"];
    const rows = sortMessagesChronologically(selectedWhatsappMessages).map((message) => {
      const fields = getWhatsappExportFields(message);

      return [
        fields.date,
        fields.time,
        fields.direction,
        fields.author,
        fields.body,
        fields.channel,
        fields.type,
      ].map(escapeCsvCell).join(";");
    });
    const csv = [headers.map(escapeCsvCell).join(";"), ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");

    downloadLink.href = downloadUrl;
    downloadLink.download = `${getWhatsappExportFileBase()}.csv`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    toast.success("Conversación exportada para Excel.");
  }

  function printWhatsappConversation() {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("El navegador bloqueó la vista imprimible.");
      return;
    }

    printWindow.opener = null;
    const caseLabel = selectedCaseNumberLabel || selectedCase?.id || "Sin número";
    const chronologicalMessages = sortMessagesChronologically(selectedWhatsappMessages);
    const messageHtml = chronologicalMessages.map((message) => {
      const fields = getWhatsappExportFields(message);

      return `
        <article class="message">
          <div class="metadata">
            <span>${escapeHtml(fields.date)} · ${escapeHtml(fields.time)}</span>
            <span>${escapeHtml(fields.direction)} · ${escapeHtml(fields.author)}</span>
          </div>
          <p>${escapeHtml(fields.body)}</p>
        </article>
      `;
    }).join("");
    const exportedAt = new Intl.DateTimeFormat("es-CL", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date());

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Conversación WhatsApp - ${escapeHtml(caseLabel)}</title>
          <style>
            @page { margin: 18mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #101828; font: 13px/1.5 Arial, sans-serif; }
            header { margin-bottom: 20px; border-bottom: 1px solid #dfe5ee; padding-bottom: 14px; }
            h1 { margin: 0 0 6px; font-size: 20px; font-weight: 600; }
            .summary { margin: 0; color: #667085; font-size: 12px; }
            .message { break-inside: avoid; margin-bottom: 10px; border: 1px solid #dfe5ee; border-radius: 8px; padding: 10px 12px; }
            .metadata { display: flex; justify-content: space-between; gap: 16px; color: #667085; font-size: 11px; }
            .message p { margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
          </style>
        </head>
        <body>
          <header>
            <h1>Conversación WhatsApp</h1>
            <p class="summary">Caso: ${escapeHtml(caseLabel)}</p>
            <p class="summary">Fecha de exportación: ${escapeHtml(exportedAt)}</p>
            <p class="summary">Total de mensajes: ${chronologicalMessages.length.toLocaleString("es-CL")}</p>
          </header>
          <main>${messageHtml || '<p class="summary">No hay mensajes cargados.</p>'}</main>
        </body>
      </html>`);
    printWindow.document.close();
    printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
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
      .filter(isCustomValueCaseField)
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
    try {
      await refreshSidebarViewModel(selectedCase.id);
    } catch (refreshError) {
      console.error("[cases-console] Error refreshing configured Form", {
        caseId: selectedCase.id,
        message: refreshError instanceof Error ? refreshError.message : String(refreshError),
      });
    }
    setIsCustomLayoutDirty(false);
    toast.success("✓ Valores guardados correctamente");
    setPendingAction(null);
  }

  async function refreshCaseRecord(caseId: string) {
    const { data, error } = await supabaseBrowser
      .from("cases")
      .select(
        "id, case_number, customer_id, subject, description, numero_caso_seguimiento, channel, contact_type, status, lifecycle_status, routing_status, priority, area, category, cat_secundaria, product, subproduct, is_edge_case, assigned_agent_id, owner_type, assigned_queue_id, assigned_to, assigned_at, duplicated_from_case_id, contact_name, contact_email, contact_phone, created_at, updated_at, closed_at, resolution_type, ai_summary, ai_category, ai_sentiment, ai_confidence, ai_resolution, customer:customers(name, email, phone, public_id), owner_queue:crm_queues(name, key)",
      )
      .eq("id", caseId)
      .single<ConsoleCaseRecord>();

    if (error || !data) {
      throw new Error(error?.message || "No se pudo refrescar el caso.");
    }

    const mergedContext = await loadMergedIntoCaseReference(data);
    updateLocalCase(caseId, { ...data, ...mergedContext });
    await refreshSidebarViewModel(caseId);
  }

  async function refreshSidebarViewModel(caseId: string) {
    const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/sidebar`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as CaseDetailSidebarViewModel & { error?: string };
    if (!response.ok) throw new Error(payload.error || "No se pudo refrescar el sidebar.");
    setSidebarViewModel(payload);
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
      .returns<CaseMacro[]>();

    if (error) throw new Error(error.message);

    const macros = data ?? [];
    setActiveMacros(macros);
    setSelectedMacroId((currentMacroId) =>
      macros.some((macro) => macro.id === currentMacroId) ? currentMacroId : "",
    );
  }

  async function openMacroModal() {
    if (!canExecuteMacros) return;

    setMacroSearchQuery("");
    setSelectedMacroId("");
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
      setRecentMacroIds((currentIds) => [
        selectedMacroId,
        ...currentIds.filter((macroId) => macroId !== selectedMacroId),
      ].slice(0, 5));
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
    void refreshSidebarViewModel(selectedCase.id).catch((refreshError) => {
      console.error("[cases-console] Error refreshing configurable sidebar", {
        caseId: selectedCase.id,
        message: refreshError instanceof Error ? refreshError.message : String(refreshError),
      });
    });
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

  function handleCaseAssigned(assignment: CaseAssignmentResult) {
    updateLocalCase(assignment.id, {
      owner_type: assignment.ownerType,
      assigned_agent_id: assignment.assignedAgentId,
      assigned_queue_id: assignment.assignedQueueId,
      assigned_to: assignment.assignedTo,
      owner_queue: assignment.ownerType === "QUEUE"
        ? { name: assignment.owner.name, key: assignment.owner.key ?? null }
        : null,
      status: "ASSIGNED",
      routing_status: "ASSIGNED",
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsAssignmentModalOpen(false);
    toast.success("✓ Caso asignado correctamente");
    if (assignment.notificationStatus === "failed") {
      toast.info("El caso fue asignado, pero no se pudo crear la notificación.");
    }
    void refreshCaseAuditEvents(assignment.id);
    window.dispatchEvent(new CustomEvent("case-whatsapp-notifications-refresh"));
  }

  function handleCaseDuplicated(result: DuplicateCaseResult) {
    setIsDuplicateModalOpen(false);
    toast.success("Caso duplicado correctamente");
    router.push(result.url);
    router.refresh();
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
      values.owner_type = "USER";
      values.assigned_agent_id = assignedAgentId || null;
      values.assigned_queue_id = null;
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
    const errors: Record<string, string> = {};
    const standardUpdates: Record<string, unknown> = {};
    const customUpdates = editablePropertyFields.flatMap((sidebarField) => {
      const field = sidebarField.caseDefinition;
      if (!field) return [];
      const fieldName = `detail:${field.id}`;
      const rawValue = formData.get(fieldName);
      const validationError = validateCustomFieldValue({ field, rawValue });
      if (validationError) errors[field.id] = validationError;

      if (!isCustomValueCaseField(field)) {
        const stringValue = typeof rawValue === "string" ? rawValue.trim() : "";
        standardUpdates[field.field_key] = field.field_type === "boolean"
          ? rawValue === "on" || rawValue === "true"
          : field.field_type === "number" || field.field_type === "currency"
            ? stringValue ? Number(stringValue) : null
            : stringValue || null;
        return [];
      }

      return [{
        field,
        payload: buildCustomValuePayload({ caseId: selectedCase.id, field, rawValue }),
      }];
    });

    setCustomFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("✗ Revisa los campos obligatorios o inválidos");
      return;
    }

    setPendingAction("case-info");
    try {
      if (Object.keys(standardUpdates).length > 0) {
        const { error } = await supabaseBrowser.from("cases").update({
          ...standardUpdates,
          updated_at: new Date().toISOString(),
        }).eq("id", selectedCase.id);
        if (error) throw error;
        updateLocalCase(selectedCase.id, standardUpdates as Partial<ConsoleCaseRecord>);
      }

      if (customUpdates.length > 0) {
        const { data, error } = await supabaseBrowser.from("case_custom_values")
          .upsert(customUpdates.map((update) => update.payload), {
            onConflict: "case_id,field_definition_id",
          }).select("*").returns<CaseCustomValue[]>();
        if (error) throw error;
        setCustomValues((current) => {
          const valuesByDefinition = new Map(current.map((value) => [value.field_definition_id, value]));
          (data ?? []).forEach((value) => valuesByDefinition.set(value.field_definition_id, value));
          return [...valuesByDefinition.values()];
        });
      }

      await refreshSidebarViewModel(selectedCase.id);
      setIsCaseInfoEditing(false);
      toast.success("✓ Propiedades guardadas correctamente");
    } catch (error) {
      toast.error(`✗ ${error instanceof Error ? error.message : "No se pudieron guardar las propiedades"}`);
    } finally {
      setPendingAction(null);
    }
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
    setIsWhatsappSearchOpen(false);
    setWhatsappSearchQuery("");
    setWhatsappSearchIndex(0);
    setIsWhatsappExpanded(false);
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

  const duplicateCustomFields: DuplicateModalCustomField[] = areaLayoutTab
    ? areaLayoutTab.sections.flatMap((section) =>
        section.fields.flatMap((layoutField) => {
          const field = layoutField.field_definition;
          if (!field || !isCustomValueCaseField(field)) return [];

          return [
            {
              field,
              value: getCustomValueForField(
                field,
                customValues.find(
                  (customValue) => customValue.field_definition_id === field.id,
                ),
              ),
            },
          ];
        }),
      )
    : [];

  return (
    <section className={`${caseDetailManrope.variable} ${caseDetailMono.variable} ${originalStyles.detailRoot} relative flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden text-[var(--g66-text-primary)]`}>
      {selectedCase ? (
        <header className={`${originalStyles.caseHeader} shrink-0 bg-white`}>
          <div className={`${originalStyles.caseHeaderTop} flex flex-col xl:flex-row xl:items-center xl:justify-between`}>
            <div className={`${originalStyles.caseIdentity} flex min-w-0 flex-wrap items-center`}>
              <div className={`${originalStyles.caseAvatar} flex shrink-0 items-center justify-center bg-[var(--g66-brand-blue)] text-white`}>
                {getCustomerLabel(selectedCase)
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <h1 className={`${originalStyles.caseNumber} truncate font-mono`}>
                {selectedCaseNumberLabel}
              </h1>
              <span className={`${originalStyles.headerBadge} ${originalStyles.channelBadge} inline-flex items-center`}>
                <span className={`${originalStyles.headerBadgeLabel} uppercase opacity-80`}>Canal</span>
                <span className={`h-2 w-2 rounded-full ${selectedChannelLabel === "WhatsApp" ? "bg-[#16c75d]" : "bg-[var(--g66-brand-blue)]"}`} aria-hidden="true" />
                {selectedChannelLabel}
              </span>
              <span className={`${originalStyles.headerBadge} ${originalStyles.attentionBadge} inline-flex items-center`}>
                <span className={`${originalStyles.headerBadgeLabel} uppercase text-[var(--g66-text-muted)]`}>Tiempo atención</span>
                <CaseAttentionTime
                  createdAt={selectedCase.created_at}
                  closedAt={selectedCase.closed_at}
                  resolvedAt={selectedCase.resolved_at}
                  updatedAt={selectedCase.updated_at}
                  status={selectedCase.status}
                  lifecycleStatus={selectedCase.lifecycle_status}
                />
              </span>
            </div>

            <div className={`${originalStyles.headerActions} flex shrink-0 flex-wrap items-center`}>
              <Link
                href="/casos"
                className={`${originalStyles.headerAction} inline-flex items-center justify-center whitespace-nowrap border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-brand-blue)] hover:text-[var(--g66-brand-blue)]`}
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Volver a listado
              </Link>
              {canExecuteMacros ? (
                <button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={openMacroModal}
                  className={`${originalStyles.headerAction} inline-flex items-center justify-center whitespace-nowrap border border-[var(--g66-brand-blue)]/20 bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] disabled:cursor-not-allowed disabled:text-[var(--g66-text-secondary)]`}
                >
                  <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Ejecutar macro
                </button>
              ) : null}
              <button
                type="button"
                disabled={pendingAction !== null}
                aria-disabled={!selectedCaseAssignmentAuthorization.allowed}
                onClick={() => {
                  if (!selectedCaseAssignmentAuthorization.allowed) {
                    toast.error(selectedCaseAssignmentAuthorization.reason ?? "No tienes permiso para asignar este caso.");
                    return;
                  }
                  setIsAssignmentModalOpen(true);
                }}
                title={selectedCaseAssignmentAuthorization.reason ?? "Asignar caso"}
                className={`${originalStyles.headerAction} inline-flex items-center justify-center whitespace-nowrap border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-brand-blue)] hover:text-[var(--g66-brand-blue)] disabled:cursor-not-allowed disabled:text-[var(--g66-text-muted)] ${selectedCaseAssignmentAuthorization.allowed ? "" : "cursor-not-allowed opacity-60"}`}
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Asignar
              </button>
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={() => setIsDuplicateModalOpen(true)}
                className={`${originalStyles.headerAction} inline-flex items-center justify-center whitespace-nowrap border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-brand-blue)] hover:text-[var(--g66-brand-blue)]`}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Duplicar
              </button>
              <Link
                href="/casos"
                className={`${originalStyles.headerAction} inline-flex items-center justify-center whitespace-nowrap border border-[#f4c6cf] bg-[var(--g66-danger-soft)] text-[var(--g66-danger)] transition hover:border-[var(--g66-danger)]`}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Cerrar vista
              </Link>
            </div>
          </div>

          <div className={`${originalStyles.headerMetadata} flex flex-wrap items-start border-t`}>
              <HeaderMetadataItem label="Case Owner">
                {selectedCase.owner_type === "QUEUE" ? (
                  <Layers3 className="h-3.5 w-3.5 shrink-0 text-[var(--g66-brand-blue)]" aria-hidden="true" />
                ) : null}
                <span className="truncate">
                  {selectedCase.owner_type === "QUEUE"
                    ? selectedCase.owner_queue?.name || selectedCase.assigned_to || "Sin owner"
                    : getAgentLabel(selectedCase, agentNames) === "Sin asignar"
                      ? "Sin owner"
                      : getAgentLabel(selectedCase, agentNames)}
                </span>
                {selectedCaseAssignmentAuthorization.allowed ? (
                  <button
                    type="button"
                    onClick={() => setIsAssignmentModalOpen(true)}
                    aria-label="Cambiar case owner"
                    title="Cambiar case owner"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--g66-border)] bg-white text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                  >
                    <UserPlus className="h-3 w-3" aria-hidden="true" />
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
                      ? "text-amber-600"
                      : ""
                  }
                >
                  {selectedDaysWithoutOperation === null
                    ? "—"
                    : selectedDaysWithoutOperation}
                </span>
              </HeaderMetadataItem>
              <HeaderMetadataItem label="Prioridad">
                <CasePriorityIndicator priority={selectedCase.priority} />
              </HeaderMetadataItem>
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
                    className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-2 text-xs font-bold text-white shadow-[0_8px_18px_rgb(var(--crm-primary-rgb)/0.18)] transition hover:bg-[var(--g66-brand-blue-hover)]"
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
          <aside className={`${originalStyles.sideColumn} h-full min-h-0 overflow-y-auto`}>
            {!isQueueOpen ? (
              <button
                type="button"
                onClick={() => setIsQueueOpen(true)}
                className={`${originalStyles.showQueueButton} flex w-full items-center justify-center bg-white hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]`}
              >
                &gt; Mostrar cola
              </button>
            ) : null}
            <div className={`${originalStyles.sideStack} grid`}>
              <ModuleBox
                title={sidebarSectionsByKey.get("CUSTOMER_INFO")?.title || "Información del cliente"}
                icon={<User className="h-3.5 w-3.5" aria-hidden="true" />}
                action={
                  sidebarViewModel.customerPublicId || selectedCase.customer?.public_id ? (
                    <Link
                      href={`/cuentas/${sidebarViewModel.customerPublicId || selectedCase.customer?.public_id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--g66-border)] bg-white px-2 py-0.5 text-[9px] font-semibold text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                    >
                      Cliente 360
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="rounded-full bg-[var(--g66-background)] px-2 py-0.5 text-[9px] font-semibold text-[var(--g66-text-muted)]">
                      Cliente no vinculado
                    </span>
                  )
                }
              >
                <SidebarSectionFields
                  fields={sidebarFields("CUSTOMER_INFO")}
                  onCopy={copyQuickValue}
                />
                {canUseAircall ? (
                  <button
                    type="button"
                    onClick={() => startAircallCall(selectedCase)}
                    disabled={pendingAction !== null}
                    className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-3 text-[11px] font-semibold text-white transition hover:bg-[var(--g66-brand-blue-hover)] disabled:cursor-not-allowed disabled:bg-[var(--g66-border)] disabled:text-[var(--g66-text-muted)]"
                  >
                    <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
                    {pendingAction === "aircall" ? "Preparando..." : "Llamar"}
                  </button>
                ) : null}
              </ModuleBox>
              <ModuleBox
                title={sidebarSectionsByKey.get("CASE_INFO")?.title || "Información del caso"}
                icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                <SidebarSectionFields
                  fields={sidebarFields("CASE_INFO")}
                  onCopy={copyQuickValue}
                />
              </ModuleBox>
              <ModuleBox
                title={sidebarSectionsByKey.get("CASE_PROPERTIES")?.title || "Propiedades Caso"}
                icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
                action={
                  canEditAnyCaseInfoField ? (
                    <button
                      type="button"
                      onClick={() => setIsCaseInfoEditing((current) => !current)}
                      className="inline-flex items-center rounded-full border border-[var(--g66-border)] bg-white px-2 py-0.5 text-[9px] font-semibold text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
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
                    {editablePropertyFields.map((sidebarField) => {
                      const field = sidebarField.caseDefinition!;
                      const name = `detail:${field.id}`;
                      const value = sidebarField.value ?? "";
                      return (
                        <FormField key={field.id} label={field.label}>
                          {field.field_type === "picklist" ? (
                            <select name={name} defaultValue={String(value)} required={Boolean(field.is_required)} className={inputClassName()}>
                              <option value="">Sin valor</option>
                              {(field.picklist_values ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                          ) : field.field_type === "boolean" ? (
                            <input name={name} type="checkbox" defaultChecked={Boolean(value)} className="h-4 w-4 accent-[var(--g66-brand-blue)]" />
                          ) : field.field_type === "textarea" ? (
                            <textarea name={name} defaultValue={String(value)} required={Boolean(field.is_required)} className={`${inputClassName()} min-h-20 py-2`} />
                          ) : (
                            <input
                              name={name}
                              type={field.field_type === "number" || field.field_type === "currency" ? "number" : field.field_type === "datetime" ? "datetime-local" : field.field_type === "date" ? "date" : field.field_type === "email" ? "email" : field.field_type === "url" ? "url" : "text"}
                              step={field.field_type === "currency" ? "0.01" : undefined}
                              defaultValue={String(value)}
                              required={Boolean(field.is_required)}
                              className={inputClassName()}
                            />
                          )}
                          {customFieldErrors[field.id] ? <span className="text-[10px] text-[var(--g66-danger)]">{customFieldErrors[field.id]}</span> : null}
                        </FormField>
                      );
                    })}
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
                  <SidebarSectionFields
                    fields={sidebarFields("CASE_PROPERTIES")}
                    onCopy={copyQuickValue}
                  />
                )}
              </ModuleBox>
              <ModuleBox
                title={sidebarSectionsByKey.get("CSAT")?.title || "CSAT"}
                icon={<CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                <SidebarSectionFields
                  fields={sidebarFields("CSAT")}
                  onCopy={copyQuickValue}
                />
              </ModuleBox>
            </div>
          </aside>
        ) : null}

        <main className={`${originalStyles.centerColumn} flex h-full min-h-0 flex-col overflow-hidden bg-transparent`}>
          {selectedCase ? (
            <>
              <section className={`${originalStyles.stepperCard} shrink-0 bg-white`}>
                {selectedCaseIsMerged ? (
                  <div className={`${originalStyles.mergedNotice} flex flex-wrap items-center justify-end gap-2 border-b border-[var(--g66-border-soft)]`}>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--g66-surface-soft)] px-2 py-0.5 text-[9px] font-semibold text-[var(--g66-text-secondary)]">
                      <Layers3 className="h-3 w-3" aria-hidden="true" />
                      Caso combinado
                    </span>
                    {selectedCase.merged_into_case_id ? (
                      <Link
                        href={`/casos/${selectedCase.merged_into_case_id}`}
                        className="text-[9px] font-medium text-[var(--g66-brand-blue)] hover:underline"
                      >
                        Fusionado en{
                          selectedCase.merged_into_case?.case_number
                            ? ` #${String(selectedCase.merged_into_case.case_number).padStart(6, "0")}`
                            : " el caso destino"
                        }
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                <div className={`${originalStyles.stepperTrack} flex items-start`}>
                  <div className="flex w-full items-start">
                    {lifecyclePathStatuses.map((status, index) => {
                      const isActive = selectedLifecyclePathStatus === status;
                      const isPast = selectedLifecyclePathIndex > index;
                      const isLineComplete = selectedLifecyclePathIndex > index;
                      const canClick =
                        canEditCaseFields && pendingAction !== "status";

                      return (
                        <div
                          key={status}
                          className="contents"
                        >
                          <div className={`${originalStyles.stepperStep} flex shrink-0 flex-col items-center`}>
                            <button
                              type="button"
                              disabled={!canClick}
                              onClick={() => changeLifecycleStatus(status)}
                              title={status}
                              className={`${originalStyles.stepperButton} relative z-10 flex min-w-0 flex-col items-center disabled:cursor-not-allowed`}
                            >
                              <span
                                className={`${originalStyles.stepperCircle} flex items-center justify-center rounded-full border transition ${
                                  isActive
                                    ? "border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue)] text-white shadow-[0_8px_18px_rgb(var(--crm-primary-rgb)/0.2)]"
                                    : isPast
                                      ? "border-[var(--g66-success)] bg-[var(--g66-success)] text-white"
                                      : "border-[var(--g66-border)] bg-white text-[var(--g66-text-muted)]"
                                }`}
                              >
                                {isPast ? (
                                  <Check aria-hidden="true" />
                                ) : (
                                  index + 1
                                )}
                              </span>
                              <span
                                className={`${originalStyles.stepperLabel} truncate ${
                                  isActive
                                    ? "font-extrabold text-[var(--g66-brand-blue)]"
                                    : isPast
                                      ? "text-[var(--g66-success)]"
                                      : "text-[var(--g66-text-muted)]"
                                }`}
                              >
                                {lifecyclePathLabels[status]}
                              </span>
                            </button>
                          </div>
                          {index < lifecyclePathStatuses.length - 1 ? (
                            <span
                              className={`${originalStyles.stepperLine} rounded-full ${
                                isLineComplete
                                  ? "bg-[var(--g66-brand-blue)]"
                                  : "bg-[var(--g66-border)]"
                              }`}
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {isWhatsappExpanded && workTab === "whatsapp" ? (
                <div className="fixed inset-0 z-[60] bg-slate-950/45" aria-hidden="true" />
              ) : null}
              <section className={`${originalStyles.conversationCard} flex min-h-0 flex-1 flex-col overflow-hidden bg-white ${isWhatsappExpanded && workTab === "whatsapp" ? "fixed inset-4 z-[70] m-0 shadow-2xl" : ""}`}>
                {isWhatsappExpanded && workTab === "whatsapp" ? (
                  <div className="relative z-20 flex h-11 shrink-0 items-center justify-between border-b border-[var(--g66-border)] bg-white px-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <MessageCircle className="h-4 w-4 shrink-0 text-[var(--g66-success)]" aria-hidden="true" />
                      <span className="text-sm font-semibold text-[var(--g66-text-primary)]">WhatsApp</span>
                      <span className="text-xs text-[var(--g66-text-secondary)]">
                        {selectedWhatsappMessages.length.toLocaleString("es-CL")} mensajes
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        title="Descargar conversación en PDF"
                        aria-label="Descargar conversación en PDF"
                        onClick={printWhatsappConversation}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title="Descargar conversación en Excel"
                        aria-label="Descargar conversación en Excel"
                        onClick={exportWhatsappConversationCsv}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-success)] hover:bg-[var(--g66-success-soft)] hover:text-[var(--g66-success)]"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title="Cerrar conversación ampliada"
                        aria-label="Cerrar conversación ampliada"
                        onClick={() => setIsWhatsappExpanded(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-danger)] hover:bg-[var(--g66-danger-soft)] hover:text-[var(--g66-danger)]"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className={`${originalStyles.tabsBar} flex shrink-0 border-b bg-white`}>
                  {[
                    {
                      key: "whatsapp",
                      label: "WhatsApp",
                      icon: <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    {
                      key: "ticket",
                      label: "Ticket",
                      icon: <Mail className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    ...(canViewAiCaseSummary
                      ? [
                          {
                            key: "ai",
                            label: "IA",
                            icon: <Bot className="h-3.5 w-3.5" aria-hidden="true" />,
                          },
                        ]
                      : []),
                    {
                      key: "activity",
                      label: "Actividades",
                      icon: <Activity className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    {
                      key: "history",
                      label: "Historial",
                      icon: <History className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    {
                      key: "form",
                      label: "Form",
                      icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                  ].map((tab) => {
                    const key = tab.key as WorkTab;
                    const isActive = workTab === key;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setWorkTab(key)}
                        className={`${originalStyles.tabButton} flex items-center border-b-2 transition ${
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
                    {!isWhatsappExpanded ? (
                      <div className="flex h-7 shrink-0 items-center justify-between rounded-full border border-[var(--g66-success-soft)] bg-white px-3">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[var(--g66-success)]">
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          WhatsApp
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                          {selectedWhatsappMessages.length.toLocaleString("es-CL")} mensajes
                        </span>
                      </div>
                    ) : null}
                    {isWhatsappSearchOpen ? (
                      <div className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--g66-border)] bg-white px-2 py-1.5">
                        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--g66-text-muted)]" aria-hidden="true" />
                        <input
                          autoFocus
                          value={whatsappSearchQuery}
                          onChange={(event) => {
                            setWhatsappSearchQuery(event.target.value);
                            setWhatsappSearchIndex(0);
                          }}
                          placeholder="Buscar en esta conversación"
                          className="min-w-0 flex-1 bg-transparent text-xs text-[var(--g66-text-primary)] outline-none placeholder:text-[var(--g66-text-muted)]"
                        />
                        <span className="whitespace-nowrap text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                          {whatsappSearchMatches.length > 0 ? effectiveWhatsappSearchIndex + 1 : 0} de {whatsappSearchMatches.length}
                        </span>
                        <button type="button" disabled={whatsappSearchMatches.length === 0} onClick={() => setWhatsappSearchIndex((effectiveWhatsappSearchIndex - 1 + whatsappSearchMatches.length) % whatsappSearchMatches.length)} aria-label="Coincidencia anterior" className="h-7 w-7 rounded border border-[var(--g66-border)] text-xs disabled:opacity-40">↑</button>
                        <button type="button" disabled={whatsappSearchMatches.length === 0} onClick={() => setWhatsappSearchIndex((effectiveWhatsappSearchIndex + 1) % whatsappSearchMatches.length)} aria-label="Coincidencia siguiente" className="h-7 w-7 rounded border border-[var(--g66-border)] text-xs disabled:opacity-40">↓</button>
                        <button type="button" onClick={() => { setIsWhatsappSearchOpen(false); setWhatsappSearchQuery(""); setWhatsappSearchIndex(0); }} aria-label="Cerrar búsqueda" className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)]">
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                    <div className="relative min-h-0 flex-1">
                      <div
                        ref={messagesContainerRef}
                        onScroll={updateWhatsappScrollPosition}
                        className="h-full overflow-y-auto rounded-[var(--g66-radius-lg)] border border-[var(--g66-border-soft)] bg-[linear-gradient(180deg,#FFFFFF_0%,var(--g66-background)_100%)] p-3"
                      >
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
                            const isCurrentSearchMatch = currentWhatsappSearchMessage?.id === message.id;

                            return (
                              <article
                                key={message.id}
                                id={`whatsapp-message-${String(message.id)}`}
                                className={`flex rounded-lg transition ${outbound ? "justify-end" : "justify-start"} ${isCurrentSearchMatch ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}
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
                                    <HighlightedMessageText text={message.body || "Sin contenido"} query={whatsappSearchQuery} />
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
                      {!isWhatsappAtBottom && selectedWhatsappMessages.length > 0 ? (
                        <button
                          type="button"
                          title="Ir al final de la conversación"
                          aria-label="Ir al final de la conversación"
                          onClick={scrollWhatsappToBottom}
                          className="absolute bottom-4 right-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-brand-blue)] shadow-[0_8px_20px_rgb(15_23_42/0.18)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    <div className="shrink-0 rounded-[var(--g66-radius-lg)] border border-[var(--g66-border-soft)] bg-white shadow-[var(--g66-shadow-card)]">
                      <CaseReplyForm
                        caseId={selectedCase.id}
                        compact
                        isExpanded={isWhatsappExpanded}
                        onToggleSearch={() => setIsWhatsappSearchOpen((current) => !current)}
                        onToggleExpanded={() => setIsWhatsappExpanded((current) => !current)}
                        onRefresh={async () => {
                          await Promise.all([
                            refreshCaseMessages(selectedCase.id),
                            refreshCaseAttachments(selectedCase.id),
                          ]);
                        }}
                      />
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
                    knowledgeSuggestion={knowledgeSuggestions[selectedCase.id] ?? null}
                    onKnowledgeFeedback={submitKnowledgeFeedback}
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
                        <ActivityListControls
                          query={activityQuery}
                          onQueryChange={setActivityQuery}
                          date={activityDate}
                          onDateChange={setActivityDate}
                          order={activityOrder}
                          onOrderChange={setActivityOrder}
                          placeholder="Buscar en actividades..."
                          visibleCount={filteredActivityMessages.length + filteredActivityCalls.length}
                          totalCount={selectedCaseMessages.length + aircallCalls.length}
                        />
                        <div className="grid gap-2">
                          {canViewCallHistory
                            ? filteredActivityCalls.map((call) => (
                                <AircallCallCard
                                  key={`activity-aircall-${call.id}`}
                                  call={call}
                                />
                              ))
                            : null}
                          {filteredActivityMessages.map((message) => {
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
                                  <div className="flex shrink-0 items-center gap-1">
                                    <span className="mr-1 text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                                      {formatDateTime(message.created_at)}
                                    </span>
                                    <ActivityIconBadge kind="channel" value={getMessageActivityChannel(message)} />
                                    <ActivityIconBadge kind="actor" value={getMessageActivityActor(message)} />
                                  </div>
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
                          {filteredActivityMessages.length === 0 && filteredActivityCalls.length === 0 ? (
                            <p className="rounded-md border border-dashed border-[var(--g66-border)] bg-white p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">
                              No encontramos actividades con esos filtros.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {workTab === "history" ? (
                      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--g66-background)] p-3">
                        <ActivityListControls
                          query={historyQuery}
                          onQueryChange={setHistoryQuery}
                          date={historyDate}
                          onDateChange={setHistoryDate}
                          order={historyOrder}
                          onOrderChange={setHistoryOrder}
                          placeholder="Buscar en historial..."
                          visibleCount={filteredAuditEvents.length}
                          totalCount={auditEvents.length}
                        />
                        <div className="grid gap-2 rounded-md border border-[var(--g66-border)] bg-white p-3 shadow-sm">
                          <Field label="Caso creado" value={formatDateTime(selectedCase.created_at)} />
                          <Field label="Última actualización" value={formatDateTime(selectedCase.updated_at)} />
                          <Field label="Caso cerrado" value={formatDateTime(selectedCase.closed_at)} />
                          {filteredAuditEvents.length > 0 ? (
                            <div className="mt-2 grid gap-2">
                              {filteredAuditEvents.map((event) => (
                                <AuditEventCard
                                  key={`history-audit-${event.id}`}
                                  event={event}
                                  agentNames={agentNames}
                                />
                              ))}
                            </div>
                          ) : null}
                          {filteredAuditEvents.length === 0 ? (
                            <div className="rounded-md border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">
                              No encontramos eventos de historial con esos filtros.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {workTab === "form" ? (
                      (() => {
                        const formSections = sidebarViewModel.formSections;

                        if (formSections.length === 0) {
                          return (
                            <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--g66-background)] p-3 text-sm font-semibold text-[var(--g66-text-secondary)]">
                              No hay layout configurado para esta área.
                            </div>
                          );
                        }

                        const saveTab = formSectionsToSaveTab(formSections);
                        const hasEditableFields = formSections.some((section) =>
                          section.items.some((item) =>
                            item.type === "FIELD" &&
                            item.editable &&
                            item.field.sourceType === "CASE" &&
                            Boolean(item.field.caseDefinition) &&
                            canEditCaseInfoField(item.field.fieldKey),
                          ),
                        );

                        return (
                          <form
                            key={`${selectedCase.id}-${sidebarViewModel.area}-configured-form`}
                            onSubmit={(event) =>
                              saveCustomLayoutFields(event, saveTab)
                            }
                            onChange={() => setIsCustomLayoutDirty(true)}
                            className="flex min-h-0 flex-1 flex-col bg-[var(--g66-background)]"
                          >
                            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                              <div className="grid gap-3">
                                {formSections.map((section) => (
                                  <section
                                    key={section.id}
                                    className="rounded-md border border-[var(--g66-border)] bg-white p-3 shadow-sm"
                                  >
                                    <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--g66-brand-blue)]">
                                      {section.name}
                                    </h3>
                                    {section.description ? (
                                      <p className="mt-1 text-xs text-[var(--g66-text-secondary)]">
                                        {section.description}
                                      </p>
                                    ) : null}
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                      {section.items.map((item) => {
                                        if (item.type === "SPACER") {
                                          return (
                                            <div
                                              key={item.id}
                                              aria-hidden="true"
                                              className={`hidden min-h-9 md:block ${
                                                item.columnSpan === 2 ? "md:col-span-2" : ""
                                              }`}
                                            />
                                          );
                                        }

                                        const sidebarField = item.field;
                                        const field = sidebarField.caseDefinition;
                                        if (
                                          sidebarField.sourceType === "CASE" &&
                                          !canViewCaseInfoField(sidebarField.fieldKey)
                                        ) {
                                          return null;
                                        }
                                        const isEditable = Boolean(
                                          field &&
                                          item.editable &&
                                          sidebarField.sourceType === "CASE" &&
                                          canEditCaseInfoField(sidebarField.fieldKey),
                                        );
                                        const error = field ? customFieldErrors[field.id] : null;

                                        return (
                                          <div
                                            key={item.id}
                                            className={
                                              item.columnSpan === 2
                                                ? "md:col-span-2"
                                                : ""
                                            }
                                          >
                                            {isEditable && field ? (
                                              <FormField
                                                label={`${sidebarField.label}${item.required ? " *" : ""}`}
                                              >
                                                <CustomFieldInput
                                                  field={{ ...field, is_required: item.required }}
                                                  value={sidebarField.value}
                                                  disabled={false}
                                                />
                                              </FormField>
                                            ) : (
                                              <div className="rounded-md border border-[var(--g66-border)] bg-[var(--g66-background)] px-3 py-2">
                                                <SidebarFieldRow
                                                  field={sidebarField}
                                                  onCopy={copyQuickValue}
                                                />
                                              </div>
                                            )}
                                            {field?.description && isEditable ? (
                                              <p className="mt-1 text-xs font-medium text-[var(--g66-text-secondary)]">
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
                                  !hasEditableFields
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

        <aside className={`${originalStyles.sideColumn} h-full min-h-0 overflow-y-auto`}>
          <div className={`${originalStyles.relatedHeader} flex items-center justify-between`}>
            {isRightPanelOpen ? (
              <>
                <span className={`${originalStyles.relatedTitle} uppercase`}>
                  Relacionados
                </span>
                <button
                  type="button"
                  onClick={() => setIsRightPanelOpen(false)}
                  className={`${originalStyles.relatedToggle} flex items-center justify-center border border-[var(--g66-border)] bg-white text-[11px] font-medium text-[var(--g66-text-secondary)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]`}
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
                className="mx-auto flex h-6 w-6 items-center justify-center rounded-md border border-[var(--g66-border)] bg-white text-[11px] font-medium text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
                aria-label="Mostrar panel derecho"
                title="Mostrar panel derecho"
              >
                &lt;
              </button>
            )}
          </div>

          {selectedCase && isRightPanelOpen ? (
            <div className={`${originalStyles.sideStack} grid`}>
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
                        className={`block rounded-[var(--g66-radius-md)] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-[var(--g66-shadow-card)] ${whatsappNotificationCardClass(
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
                            <span className="truncate text-[11px] font-semibold">
                              {caseItem.caseNumber}
                            </span>
                          </span>
                          <span className="shrink-0 text-[10px] font-semibold">
                            WA
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[10px] font-medium">
                          {caseItem.notificationStatus === "RED"
                            ? "Sin primera respuesta"
                            : caseItem.notificationLabel}
                        </p>
                        <p className="mt-1 truncate text-[10px] font-medium opacity-80">
                          Última actividad:{" "}
                          {formatRelativeTime(
                            caseItem.lastActivityAt || caseItem.createdAt,
                          )}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] font-normal leading-4 text-[var(--g66-text-secondary)]">
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
                    {
                      key: "calls",
                      label: "Llamados",
                      icon: (
                        <PhoneCall
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      ),
                    },
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
                        setRelatedView(item.key as CaseInfoLinkView)
                      }
                      className="flex h-7 items-center justify-between rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-2 text-[10px] font-semibold text-[var(--g66-brand-blue)] transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
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
        <CaseInfoLinksPanel view={relatedView} onClose={() => setRelatedView(null)}>
          <div className="grid gap-3">
            {relatedView === "history" ? (
              <ActivityListControls
                query={historyQuery}
                onQueryChange={setHistoryQuery}
                date={historyDate}
                onDateChange={setHistoryDate}
                order={historyOrder}
                onOrderChange={setHistoryOrder}
                placeholder="Buscar en historial..."
                visibleCount={filteredAuditEvents.length}
                totalCount={auditEvents.length}
              />
            ) : null}
            {relatedView === "activity" || relatedView === "email" ? (
              <ActivityListControls
                query={activityQuery}
                onQueryChange={setActivityQuery}
                date={activityDate}
                onDateChange={setActivityDate}
                order={activityOrder}
                onOrderChange={setActivityOrder}
                placeholder={relatedView === "email" ? "Buscar en correos..." : "Buscar en actividades..."}
                visibleCount={
                  relatedView === "email"
                    ? filteredEmailMessages.length
                    : filteredActivityMessages.length + filteredActivityAuditEvents.length + filteredActivityCalls.length
                }
                totalCount={
                  relatedView === "email"
                    ? selectedEmailMessages.length
                    : selectedCaseMessages.length + auditEvents.length + aircallCalls.length
                }
              />
            ) : null}
            {relatedView === "cases" ? (
              <CaseRelatedCasesSection caseId={selectedCase.id} />
            ) : null}
            {relatedView === "qa" ? <CaseQaNotesSection /> : null}
            {relatedView === "email" ? (
              <div className="grid gap-2">
                {filteredEmailMessages.map((message) => (
                  <button key={`related-email-${message.id}`} type="button" onClick={() => setSelectedEmailMessage(message)} className="rounded-lg border border-[var(--g66-border)] bg-white p-3 text-left transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]">
                    <span className="block truncate text-xs font-semibold text-[var(--g66-brand-blue)]">{message.email_subject || "Email sin asunto"}</span>
                    <span className="mt-1 block truncate text-[10px] text-[var(--g66-text-secondary)]">De: {message.email_from || "Sin remitente"}</span>
                    <span className="block truncate text-[10px] text-[var(--g66-text-secondary)]">Para: {message.email_to || "Sin destinatario"}</span>
                    <span className="mt-1 line-clamp-2 block text-[11px] text-[var(--g66-text-secondary)]">{message.body || message.email_text_body || "Sin contenido"}</span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--g66-text-muted)]"><span>{message.delivery_status || "Sin estado"}</span><span className="flex items-center gap-1"><span className="mr-1">{formatDateTime(message.created_at)}</span><ActivityIconBadge kind="channel" value="email" /><ActivityIconBadge kind="actor" value={getMessageActivityActor(message)} /></span></span>
                  </button>
                ))}
                {filteredEmailMessages.length === 0 ? <p className="rounded-lg border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-sm text-[var(--g66-text-secondary)]">No encontramos correos con esos filtros.</p> : null}
              </div>
            ) : null}
            {relatedView === "ai" ? (
              selectedCase.ai_summary || aiHistoryPayload?.cachedSummary ? (
                <div className="grid gap-3">
                  <section className="rounded-lg border border-[var(--g66-border)] bg-white p-3">
                    <h3 className="text-xs font-semibold text-[var(--g66-text-primary)]">Resumen IA del caso</h3>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--g66-text-secondary)]">{aiHistoryPayload?.cachedSummary?.summary || selectedCase.ai_summary}</p>
                  </section>
                  {aiHistoryPayload?.cachedSummary?.patterns?.length ? (
                    <section className="rounded-lg border border-[var(--g66-border)] bg-white p-3"><h3 className="text-xs font-semibold text-[var(--g66-text-primary)]">Análisis e insights</h3><ul className="mt-2 grid gap-1 text-xs text-[var(--g66-text-secondary)]">{aiHistoryPayload.cachedSummary.patterns.map((pattern) => <li key={pattern}>• {pattern}</li>)}</ul></section>
                  ) : null}
                  {aiHistoryPayload?.cachedSummary?.next_best_action ? <Field label="Sugerencia" value={aiHistoryPayload.cachedSummary.next_best_action} /> : null}
                  <Field label="Categoría IA" value={selectedCase.ai_category || "No disponible"} />
                  <Field label="Sentimiento" value={selectedCase.ai_sentiment || aiHistoryPayload?.cachedSummary?.sentiment || "No disponible"} />
                  <Field label="Resolución IA" value={selectedCase.ai_resolution || "No disponible"} />
                  <Field label="Última actualización IA" value={formatDateTime(aiHistoryPayload?.cachedSummary?.generated_at || aiHistoryPayload?.cachedSummary?.updated_at)} />
                  {aiHistoryPayload?.historicalCases?.length ? <Field label="Interacciones IA relacionadas" value={`${aiHistoryPayload.historicalCases.length} casos históricos relacionados`} /> : null}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-sm text-[var(--g66-text-secondary)]">{isAiHistoryLoading ? "Cargando análisis IA..." : "No hay análisis IA disponible para este caso."}</p>
              )
            ) : null}
            {relatedView === "history" ? (
              <div className="grid gap-2">
                <Field label="Caso creado" value={formatDateTime(selectedCase.created_at)} />
                <Field label="Última actualización" value={formatDateTime(selectedCase.updated_at)} />
                <Field label="Caso cerrado" value={formatDateTime(selectedCase.closed_at)} />
                {filteredAuditEvents.map((event) => <AuditEventCard key={`related-history-audit-${event.id}`} event={event} agentNames={agentNames} />)}
                {filteredAuditEvents.length === 0 ? <p className="rounded-lg border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-sm text-[var(--g66-text-secondary)]">No encontramos eventos de historial con esos filtros.</p> : null}
              </div>
            ) : null}
            {relatedView === "activity" ? (
              <div className="grid gap-2">
                {filteredActivityMessages.map((message) => <article key={`related-activity-message-${message.id}`} className="rounded-lg border border-[var(--g66-border)] bg-white p-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-[var(--g66-text-primary)]">{isEmailMessage(message) ? getEmailTitle(message) : message.sender_type || message.direction || "Interacción"}</p><span className="flex items-center gap-1 text-[10px] text-[var(--g66-text-muted)]"><span className="mr-1">{formatDateTime(message.created_at)}</span><ActivityIconBadge kind="channel" value={getMessageActivityChannel(message)} /><ActivityIconBadge kind="actor" value={getMessageActivityActor(message)} /></span></div><p className="mt-1 line-clamp-2 text-xs text-[var(--g66-text-secondary)]">{message.body || "Sin contenido"}</p></article>)}
                {filteredActivityAuditEvents.map((event) => <AuditEventCard key={`related-activity-audit-${event.id}`} event={event} agentNames={agentNames} />)}
                {canViewCallHistory ? filteredActivityCalls.map((call) => <AircallCallCard key={`related-activity-call-${call.id}`} call={call} />) : null}
                {filteredActivityMessages.length === 0 && filteredActivityAuditEvents.length === 0 && (!canViewCallHistory || filteredActivityCalls.length === 0) ? <p className="rounded-lg border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-sm text-[var(--g66-text-secondary)]">No encontramos actividades con esos filtros.</p> : null}
              </div>
            ) : null}
            {relatedView === "calls" ? <CaseCallsSection calls={aircallCalls} /> : null}
            {relatedView === "sla" && selectedCaseInfoSla ? <CaseSlaSection summary={selectedCaseInfoSla} /> : null}
          </div>
        </CaseInfoLinksPanel>
      ) : null}

      {isAssignmentModalOpen && selectedCase ? (
        <CaseAssignmentModal
          caseId={selectedCase.id}
          onClose={() => setIsAssignmentModalOpen(false)}
          onAssigned={handleCaseAssigned}
        />
      ) : null}

      {isDuplicateModalOpen && selectedCase ? (
        <DuplicateCaseModal
          source={{
            id: selectedCase.id,
            customerLabel: getCustomerLabel(selectedCase),
            area: selectedCase.area,
            channel: selectedCase.channel,
            product: selectedCase.product ?? null,
            priority: selectedCase.priority,
            category: selectedCase.category,
            contactType: selectedCase.contact_type,
            description: selectedCase.subject,
            ownerType: selectedCase.owner_type === "QUEUE" ? "QUEUE" : "USER",
            assignedAgentId: selectedCase.assigned_agent_id,
            assignedQueueId: selectedCase.assigned_queue_id ?? null,
          }}
          customFields={duplicateCustomFields}
          onClose={() => setIsDuplicateModalOpen(false)}
          onDuplicated={handleCaseDuplicated}
        />
      ) : null}

      {isMacroModalOpen ? (
        <CaseMacroModal
          macros={activeMacros}
          selectedMacroId={selectedMacroId}
          searchQuery={macroSearchQuery}
          recentMacroIds={recentMacroIds}
          isExecuting={pendingAction === "macro"}
          onSearchChange={setMacroSearchQuery}
          onSelect={setSelectedMacroId}
          onExecute={() => void executeSelectedMacro()}
          onClose={() => setIsMacroModalOpen(false)}
          summarizeAction={getMacroActionSummary}
        />
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
