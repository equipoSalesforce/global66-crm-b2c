"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CaseRecord = {
  id: string | number | null;
  subject: string | null;
  status: string | null;
  priority: string | null;
  area: string | null;
  category: string | null;
  assigned_agent_id: string | null;
  assigned_to: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string | null;
  customer: {
    name: string | null;
  } | null;
};

type AgentOption = {
  id: string;
  name: string | null;
  email: string | null;
};

function formatDate(date: string | null) {
  if (!date) return "Sin fecha";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
      {children}
    </span>
  );
}

function uniqueValues(cases: CaseRecord[], key: "status" | "priority" | "area") {
  return [...new Set(cases.map((caseItem) => caseItem[key]).filter(Boolean))]
    .sort()
    .map((value) => value as string);
}

function getCaseCustomerLabel(caseItem: CaseRecord) {
  return (
    caseItem.customer?.name ??
    caseItem.contact_name ??
    caseItem.contact_email ??
    "Sin cliente"
  );
}

function isQueueVisibleCase(caseItem: CaseRecord) {
  if (caseItem.status === "ASSIGNED" && caseItem.assigned_agent_id) {
    return false;
  }

  return (
    caseItem.status === "HUMAN_REQUIRED" ||
    caseItem.status === "AI_HANDLING" ||
    !caseItem.assigned_agent_id
  );
}

export function QueueCasesTable() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQueue() {
      const [casesResult, agentsResult] = await Promise.all([
        supabase
          .from("cases")
          .select(
            "id, subject, status, priority, area, category, assigned_agent_id, assigned_to, contact_name, contact_email, created_at, customer:customers(name)",
          )
          .or(
            "status.eq.HUMAN_REQUIRED,assigned_agent_id.is.null,status.eq.AI_HANDLING",
          )
          .order("created_at", { ascending: false })
          .returns<CaseRecord[]>(),
        supabase
          .from("agents")
          .select("id, name, email")
          .returns<AgentOption[]>(),
      ]);

      if (casesResult.error) {
        console.error("[queue] Error loading cases", {
          message: casesResult.error.message,
          supabaseError: casesResult.error,
        });
        setError(casesResult.error.message);
        setIsLoading(false);
        return;
      }

      if (agentsResult.error) {
        console.error("[queue] Error loading agents", {
          message: agentsResult.error.message,
          supabaseError: agentsResult.error,
        });
      }

      setCases((casesResult.data ?? []).filter(isQueueVisibleCase));
      setAgents(agentsResult.data ?? []);
      setIsLoading(false);
    }

    loadQueue();
  }, []);

  const filteredCases = useMemo(
    () =>
      cases.filter((caseItem) => {
        if (!isQueueVisibleCase(caseItem)) return false;
        if (statusFilter && caseItem.status !== statusFilter) return false;
        if (priorityFilter && caseItem.priority !== priorityFilter) return false;
        if (areaFilter && caseItem.area !== areaFilter) return false;
        return true;
      }),
    [areaFilter, cases, priorityFilter, statusFilter],
  );

  const agentNames = new Map(
    agents.map((agent) => [agent.id, agent.name ?? agent.email ?? agent.id]),
  );

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">Estado</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
            >
              <option value="">Todos</option>
              {uniqueValues(cases, "status").map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">
              Prioridad
            </span>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
            >
              <option value="">Todas</option>
              {uniqueValues(cases, "priority").map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">Área</span>
            <select
              value={areaFilter}
              onChange={(event) => setAreaFilter(event.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
            >
              <option value="">Todas</option>
              {uniqueValues(cases, "area").map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-950">Casos pendientes</h2>
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-gray-600">Cargando cola...</p>
        ) : error ? (
          <p className="p-6 text-sm text-[var(--g66-danger)]">{error}</p>
        ) : filteredCases.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <div className="grid grid-cols-[1.5fr_1fr_0.9fr_0.8fr_0.8fr_0.9fr_1fr_0.8fr] gap-4 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase text-gray-500">
                <span>Asunto</span>
                <span>Cliente</span>
                <span>Estado</span>
                <span>Prioridad</span>
                <span>Área</span>
                <span>Categoría</span>
                <span>Asignado a</span>
                <span>Fecha</span>
              </div>

              <ul className="divide-y divide-gray-200 bg-white">
                {filteredCases.map((caseItem, index) => (
                  <li key={caseItem.id ?? `case-${index}`}>
                    <Link
                      href={`/casos/${caseItem.id}`}
                      className="grid grid-cols-[1.5fr_1fr_0.9fr_0.8fr_0.8fr_0.9fr_1fr_0.8fr] gap-4 px-5 py-4 text-sm transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    >
                      <span className="font-semibold text-gray-950">
                        {caseItem.subject || "Sin asunto"}
                      </span>
                      <span className="text-gray-600">
                        {getCaseCustomerLabel(caseItem)}
                      </span>
                      <span>
                        {caseItem.status ? (
                          <Badge>{caseItem.status}</Badge>
                        ) : (
                          "Sin estado"
                        )}
                      </span>
                      <span>
                        {caseItem.priority ? (
                          <Badge>{caseItem.priority}</Badge>
                        ) : (
                          "Sin prioridad"
                        )}
                      </span>
                      <span className="text-gray-600">
                        {caseItem.area || "Sin área"}
                      </span>
                      <span className="text-gray-600">
                        {caseItem.category || "Sin categoría"}
                      </span>
                      <span className="text-gray-600">
                        {caseItem.assigned_agent_id
                          ? agentNames.get(caseItem.assigned_agent_id) ??
                            caseItem.assigned_agent_id
                          : caseItem.assigned_to || "Sin asignar"}
                      </span>
                      <span className="text-gray-600">
                        {formatDate(caseItem.created_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="p-6 text-sm text-gray-600">
            No hay casos pendientes con los filtros actuales.
          </p>
        )}
      </section>
    </>
  );
}
