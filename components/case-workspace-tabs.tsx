"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CaseCustomerSimulator } from "./case-customer-simulator";
import { CaseReplyForm } from "./case-reply-form";
import { useToast } from "./toast-provider";
import { hasPermission } from "@/lib/permissions";
import { useDemoRole } from "./use-demo-role";

type MessageRecord = {
  id?: string | number | null;
  direction?: string | null;
  sender_type?: string | null;
  role?: string | null;
  author_type?: string | null;
  content?: string | null;
  body?: string | null;
  text?: string | null;
  message?: string | null;
  created_at?: string | null;
};

type CaseWorkspaceData = {
  ai_summary: string | null;
  ai_category: string | null;
  ai_sentiment: string | null;
  ai_confidence: number | null;
  ai_resolution: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  status: string | null;
  assigned_to: string | null;
  area: string | null;
  category: string | null;
  priority: string | null;
};

type AssignmentLog = {
  id: string | number;
  reason: string | null;
  created_at: string | null;
  agent_label: string;
};

type MessageArticleTrace = {
  id: string | number;
  message_id: string | number | null;
  article_id: string | number | null;
  article_title: string | null;
  relevance_score: number | null;
};

type MessagesResponse = {
  ok?: boolean;
  error?: string;
  messages?: MessageRecord[];
};

type TabKey = "conversation" | "activity" | "history" | "ai";

const tabs: { key: TabKey; label: string }[] = [
  { key: "conversation", label: "Conversación" },
  { key: "activity", label: "Actividad" },
  { key: "history", label: "Historial" },
  { key: "ai", label: "IA" },
];

function formatDateTime(date: string | null | undefined) {
  if (!date) {
    return "Sin fecha";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

function getMessageText(message: MessageRecord) {
  return (
    message.content ??
    message.body ??
    message.text ??
    message.message ??
    "Mensaje sin contenido"
  );
}

function getSenderLabel(message: MessageRecord) {
  const rawSender =
    message.sender_type ?? message.author_type ?? message.role ?? "";
  const sender = rawSender.toUpperCase();
  const direction = message.direction?.toLowerCase();

  if (sender.includes("CUSTOMER") || direction === "inbound") {
    return "CUSTOMER";
  }

  if (sender.includes("AI")) {
    return "AI";
  }

  if (sender.includes("AGENT")) {
    return "AGENT";
  }

  return direction === "outbound" ? "AGENT" : "CUSTOMER";
}

function isOutbound(message: MessageRecord) {
  const direction = message.direction?.toLowerCase();
  const sender = getSenderLabel(message);

  return direction === "outbound" || sender === "AI" || sender === "AGENT";
}

function senderStyles(sender: string) {
  if (sender === "AI") {
    return "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]";
  }

  if (sender === "AGENT") {
    return "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-accent-cyan)]";
  }

  return "bg-[var(--g66-success-soft)] text-[var(--g66-success)]";
}

function messageBubbleStyles(sender: string) {
  if (sender === "AI") {
    return "bg-[var(--g66-brand-blue)] text-white";
  }

  if (sender === "AGENT") {
    return "bg-[var(--g66-accent-cyan)] text-white";
  }

  return "border border-gray-200 bg-gray-50 text-gray-950";
}

function messageTimeStyles(sender: string) {
  if (sender === "AI") {
    return "text-[var(--g66-brand-blue-soft)]";
  }

  if (sender === "AGENT") {
    return "text-[var(--g66-brand-blue-soft)]";
  }

  return "text-gray-500";
}

function getMessageKey(message: MessageRecord, index: number) {
  return message.id ? String(message.id) : `message-${index}`;
}

function mergeMessages(
  currentMessages: MessageRecord[],
  nextMessages: MessageRecord[],
) {
  const messagesByKey = new Map<string, MessageRecord>();

  currentMessages.forEach((message, index) => {
    messagesByKey.set(getMessageKey(message, index), message);
  });

  nextMessages.forEach((message, index) => {
    messagesByKey.set(getMessageKey(message, index), message);
  });

  return [...messagesByKey.values()].sort((messageA, messageB) => {
    const timeA = messageA.created_at
      ? new Date(messageA.created_at).getTime()
      : 0;
    const timeB = messageB.created_at
      ? new Date(messageB.created_at).getTime()
      : 0;

    return timeA - timeB;
  });
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-gray-950">{value}</p>
    </div>
  );
}

function TimelineItem({
  label,
  value,
  isMuted = false,
}: {
  label: string;
  value: string;
  isMuted?: boolean;
}) {
  return (
    <li className="grid grid-cols-[16px_minmax(0,1fr)] gap-3">
      <span
        className={`mt-1 h-3 w-3 rounded-full ${
          isMuted ? "bg-gray-300" : "bg-[var(--g66-brand-blue)]"
        }`}
      />
      <div>
        <p className="text-sm font-semibold text-gray-950">{label}</p>
        <p className="mt-1 text-sm text-gray-500">{value}</p>
      </div>
    </li>
  );
}

function ConversationTab({
  caseId,
  messages,
  errorMessage,
}: {
  caseId: string;
  messages: MessageRecord[];
  errorMessage: string | null;
}) {
  const [visibleMessages, setVisibleMessages] = useState(messages);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(messages.length);
  const initialMessageKeys = useMemo(
    () => new Set(messages.map((message, index) => getMessageKey(message, index))),
    [messages],
  );

  useEffect(() => {
    let isMounted = true;

    async function pollMessages() {
      try {
        const response = await fetch(`/api/cases/${caseId}/messages`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as MessagesResponse;

        if (!response.ok || !payload.ok) {
          if (isMounted) {
            setPollingError(payload.error ?? "No se pudieron actualizar mensajes.");
          }
          return;
        }

        if (!isMounted) {
          return;
        }

        setPollingError(null);
        setVisibleMessages((currentMessages) => {
          const mergedMessages = mergeMessages(
            currentMessages,
            payload.messages ?? [],
          );

          if (mergedMessages.length > currentMessages.length) {
            const hasExternalNewMessage = mergedMessages.some((message, index) => {
              const key = getMessageKey(message, index);

              return !initialMessageKeys.has(key);
            });

            setHasNewMessages(hasExternalNewMessage);
          }

          return mergedMessages;
        });
      } catch (error) {
        console.error("[case-workspace-tabs] Error polling messages", {
          caseId,
          message: error instanceof Error ? error.message : String(error),
          error,
        });

        if (isMounted) {
          setPollingError("No se pudieron actualizar mensajes.");
        }
      }
    }

    const intervalId = window.setInterval(pollMessages, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [caseId, initialMessageKeys]);

  useEffect(() => {
    if (visibleMessages.length > previousMessageCountRef.current) {
      endRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }

    previousMessageCountRef.current = visibleMessages.length;
  }, [visibleMessages.length]);

  return (
    <div>
      {errorMessage ? (
        <p className="p-6 text-sm text-[var(--g66-danger)]">{errorMessage}</p>
      ) : visibleMessages.length > 0 ? (
        <div className="space-y-5 p-6">
          {hasNewMessages ? (
            <div className="mx-auto w-fit rounded-full bg-[var(--g66-success-soft)] px-3 py-1 text-xs font-semibold text-[var(--g66-success)]">
              Nuevo mensaje recibido
            </div>
          ) : null}

          {pollingError ? (
            <p className="rounded-lg bg-[var(--g66-brand-blue-soft)] px-4 py-3 text-sm text-[var(--g66-accent-cyan)]">
              {pollingError}
            </p>
          ) : null}

          {visibleMessages.map((message, index) => {
            const sender = getSenderLabel(message);
            const outbound = isOutbound(message);
            const isCustomer = sender === "CUSTOMER";

            return (
              <article
                key={getMessageKey(message, index)}
                className={`flex ${outbound ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[min(620px,85%)] rounded-lg px-4 py-3 shadow-sm ${messageBubbleStyles(sender)}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        isCustomer ? senderStyles(sender) : "bg-white/15 text-white"
                      }`}
                    >
                      {sender}
                    </span>
                    <span className={`text-xs ${messageTimeStyles(sender)}`}>
                      {formatDateTime(message.created_at)}
                    </span>
                  </div>
                  <p className="text-sm leading-6">{getMessageText(message)}</p>
                </div>
              </article>
            );
          })}
          <div ref={endRef} />
        </div>
      ) : (
        <p className="p-6 text-sm text-gray-600">
          Este caso aún no tiene mensajes.
        </p>
      )}

      <CaseReplyForm caseId={caseId} />
      <CaseCustomerSimulator caseId={caseId} />
    </div>
  );
}

function ActivityTab({
  caseItem,
  assignmentLogs,
}: {
  caseItem: CaseWorkspaceData;
  assignmentLogs: AssignmentLog[];
}) {
  const activityItems = [
    caseItem.status ? `Estado actual: ${caseItem.status}` : null,
    caseItem.assigned_to ? `Asignado a: ${caseItem.assigned_to}` : null,
    caseItem.category ? `Categoría: ${caseItem.category}` : null,
  ].filter(Boolean);

  return (
    <div className="p-6">
      {activityItems.length > 0 || assignmentLogs.length > 0 ? (
        <div className="space-y-5">
          {activityItems.length > 0 ? (
            <ul className="space-y-3">
              {activityItems.map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          {assignmentLogs.length > 0 ? (
            <div>
              <h3 className="text-sm font-bold text-gray-950">
                Logs de asignación
              </h3>
              <ul className="mt-3 space-y-3">
                {assignmentLogs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-lg border border-[var(--g66-border)] bg-[var(--g66-brand-blue-soft)] px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-[var(--g66-brand-blue)]">
                      {log.agent_label}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--g66-brand-blue)]">
                      {log.reason || "Asignación automática registrada."}
                    </p>
                    <p className="mt-2 text-xs font-medium text-[var(--g66-accent-cyan)]">
                      {formatDateTime(log.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
          No hay actividad registrada para este caso.
        </p>
      )}
    </div>
  );
}

function HistoryTab({
  caseItem,
  assignmentLogs,
}: {
  caseItem: CaseWorkspaceData;
  assignmentLogs: AssignmentLog[];
}) {
  return (
    <div className="p-6">
      <ol className="space-y-5">
        <TimelineItem label="Caso creado" value={formatDateTime(caseItem.created_at)} />
        {assignmentLogs.map((log) => (
          <TimelineItem
            key={log.id}
            label={`Asignado a ${log.agent_label}`}
            value={`${formatDateTime(log.created_at)} · ${
              log.reason || "Asignación automática registrada."
            }`}
          />
        ))}
        <TimelineItem
          label="Última actualización"
          value={formatDateTime(caseItem.updated_at)}
        />
        <TimelineItem
          label="Caso cerrado"
          value={formatDateTime(caseItem.closed_at)}
          isMuted={!caseItem.closed_at}
        />
      </ol>
    </div>
  );
}

function formatConfidence(value: number | null) {
  if (value === null) {
    return "Sin confianza IA";
  }

  return `${Math.round(value * 100)}%`;
}

function formatRelevance(value: number | null) {
  if (value === null) {
    return "0%";
  }

  return `${Math.round(value * 100)}%`;
}

function AiTab({
  caseId,
  caseItem,
  messages,
  messageArticleTraces,
}: {
  caseId: string;
  caseItem: CaseWorkspaceData;
  messages: MessageRecord[];
  messageArticleTraces: MessageArticleTrace[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { role, isCheckingRole } = useDemoRole();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const canTriggerAiTriage = hasPermission(role, "triggerAiTriage");
  const aiMessages = messages.filter(
    (message) => getSenderLabel(message) === "AI",
  );
  const tracesByMessageId = new Map<string, MessageArticleTrace[]>();

  messageArticleTraces.forEach((trace) => {
    if (!trace.message_id) {
      return;
    }

    const key = String(trace.message_id);
    const currentTraces = tracesByMessageId.get(key) ?? [];
    currentTraces.push(trace);
    tracesByMessageId.set(
      key,
      currentTraces.sort(
        (traceA, traceB) =>
          (traceB.relevance_score ?? 0) - (traceA.relevance_score ?? 0),
      ),
    );
  });

  async function reevaluateWithAi() {
    if (!canTriggerAiTriage) {
      toast.error("✗ Tu perfil no puede reevaluar con IA");
      return;
    }

    setIsEvaluating(true);

    try {
      const response = await fetch(`/api/cases/${caseId}/triage/agent`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        toast.error(payload.error ?? "✗ No se pudo reevaluar con IA");
        setIsEvaluating(false);
        return;
      }

      toast.success("✓ Caso reevaluado con IA");
      router.refresh();
    } catch (error) {
      console.error("[case-workspace-tabs] Error reevaluating with AI", {
        message: error instanceof Error ? error.message : String(error),
        error,
      });
      toast.error("✗ No se pudo reevaluar con IA");
    } finally {
      setIsEvaluating(false);
    }
  }

  return (
    <div className="grid gap-4 p-6 md:grid-cols-2">
      <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-950">Triage IA</h3>
          <p className="mt-1 text-sm text-gray-500">
            Clasificación, confianza y decisión de resolución del caso.
          </p>
        </div>
        {canTriggerAiTriage ? (
          <button
            type="button"
            disabled={isCheckingRole || isEvaluating}
            onClick={reevaluateWithAi}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--g66-accent-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--g66-brand-blue)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isEvaluating ? "Reevaluando..." : "Reevaluar con IA"}
          </button>
        ) : null}
      </div>

      <div className="md:col-span-2">
        <InfoBlock
          label="AI Summary"
          value={caseItem.ai_summary || "Sin resumen IA"}
        />
      </div>
      <InfoBlock
        label="AI Category"
        value={caseItem.ai_category || "Sin categoría IA"}
      />
      <InfoBlock
        label="AI Sentiment"
        value={caseItem.ai_sentiment || "Sin sentimiento IA"}
      />
      <InfoBlock
        label="AI Confidence"
        value={formatConfidence(caseItem.ai_confidence)}
      />
      <InfoBlock
        label="AI Resolution"
        value={caseItem.ai_resolution || "Sin resolución IA"}
      />
      <InfoBlock label="Área" value={caseItem.area || "Sin área"} />
      <InfoBlock
        label="Categoría"
        value={caseItem.category || "Sin categoría"}
      />
      <InfoBlock
        label="Prioridad"
        value={caseItem.priority || "Sin prioridad"}
      />
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2">
        <p className="text-xs font-semibold uppercase text-gray-500">
          Trazabilidad por respuesta
        </p>
        {aiMessages.length > 0 ? (
          <ul className="mt-3 space-y-4">
            {aiMessages.map((message, index) => {
              const messageId = message.id ? String(message.id) : `ai-${index}`;
              const traces = message.id
                ? tracesByMessageId.get(String(message.id)) ?? []
                : [];

              return (
                <li
                  key={messageId}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <p className="text-sm font-semibold text-gray-950">
                      Respuesta IA
                    </p>
                    <span className="text-xs font-medium text-gray-500">
                      {formatDateTime(message.created_at)}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-700">
                    {getMessageText(message)}
                  </p>

                  {traces.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                      {traces.map((article) => {
                        const content = (
                          <>
                            <span className="font-semibold text-gray-950">
                              {article.article_title || "Artículo sin título"}
                            </span>
                            <span className="text-sm font-bold text-[var(--g66-brand-blue)]">
                              {formatRelevance(article.relevance_score)}
                            </span>
                          </>
                        );

                        return (
                          <li key={article.id}>
                            {article.article_id ? (
                              <Link
                                href={`/base-conocimiento/${article.article_id}`}
                                className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3 text-sm transition-colors hover:bg-[var(--g66-brand-blue-soft)] focus:bg-[var(--g66-brand-blue-soft)] focus:outline-none"
                              >
                                {content}
                              </Link>
                            ) : (
                              <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3 text-sm">
                                {content}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                      Sin artículos asociados
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-gray-600">
            No hay respuestas IA registradas todavía.
          </p>
        )}
      </div>
    </div>
  );
}

export function CaseWorkspaceTabs({
  caseId,
  messages,
  messagesError,
  caseItem,
  assignmentLogs,
  messageArticleTraces,
}: {
  caseId: string;
  messages: MessageRecord[];
  messagesError: string | null;
  caseItem: CaseWorkspaceData;
  assignmentLogs: AssignmentLog[];
  messageArticleTraces: MessageArticleTrace[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("conversation");

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 pt-3">
        <div role="tablist" aria-label="Workspace del caso" className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-[var(--g66-brand-blue)] text-[var(--g66-brand-blue)]"
                    : "border-transparent text-gray-500 hover:text-gray-950"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "conversation" ? (
        <ConversationTab
          key={messages.map((message, index) => getMessageKey(message, index)).join("|")}
          caseId={caseId}
          messages={messages}
          errorMessage={messagesError}
        />
      ) : null}
      {activeTab === "activity" ? (
        <ActivityTab caseItem={caseItem} assignmentLogs={assignmentLogs} />
      ) : null}
      {activeTab === "history" ? (
        <HistoryTab caseItem={caseItem} assignmentLogs={assignmentLogs} />
      ) : null}
      {activeTab === "ai" ? (
        <AiTab
          caseId={caseId}
          caseItem={caseItem}
          messages={messages}
          messageArticleTraces={messageArticleTraces}
        />
      ) : null}
    </section>
  );
}
