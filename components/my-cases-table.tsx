"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";

type CaseRecord = {
  id: string | number | null;
  subject: string | null;
  status: string | null;
  priority: string | null;
  area: string | null;
  category: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string | null;
  customer: {
    name: string | null;
  } | null;
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

function getCaseCustomerLabel(caseItem: CaseRecord) {
  return (
    caseItem.customer?.name ??
    caseItem.contact_name ??
    caseItem.contact_email ??
    "Sin cliente"
  );
}

function isClosedCase(caseItem: CaseRecord) {
  return caseItem.status === "CLOSED";
}

function CasesSection({
  title,
  cases,
  emptyText,
}: {
  title: string;
  cases: CaseRecord[];
  emptyText: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-950">{title}</h2>
      </div>

      {cases.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[1.5fr_1fr_0.9fr_0.8fr_0.8fr_0.9fr_0.8fr] gap-4 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase text-gray-500">
              <span>Asunto</span>
              <span>Cliente</span>
              <span>Estado</span>
              <span>Prioridad</span>
              <span>Área</span>
              <span>Categoría</span>
              <span>Fecha</span>
            </div>

            <ul className="divide-y divide-gray-200 bg-white">
              {cases.map((caseItem, index) => (
                <li key={caseItem.id ?? `case-${index}`}>
                  <Link
                    href={`/casos/${caseItem.id}`}
                    className="grid grid-cols-[1.5fr_1fr_0.9fr_0.8fr_0.8fr_0.9fr_0.8fr] gap-4 px-5 py-4 text-sm transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
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
                      {formatDate(caseItem.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="p-6 text-sm text-gray-600">{emptyText}</p>
      )}
    </section>
  );
}

export function MyCasesTable() {
  const [agentName, setAgentName] = useState("");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCases() {
      const agentId = window.localStorage.getItem("agentId");
      const storedAgentName = window.localStorage.getItem("agentName");

      setAgentName(storedAgentName || "Agente");

      if (!agentId) {
        setError("No hay agente seleccionado.");
        setIsLoading(false);
        return;
      }

      const { data, error: casesError } = await supabase
        .from("cases")
        .select(
          "id, subject, status, priority, area, category, contact_name, contact_email, created_at, customer:customers(name)",
        )
        .eq("assigned_agent_id", agentId)
        .order("created_at", { ascending: false })
        .returns<CaseRecord[]>();

      if (casesError) {
        console.error("[my-cases] Error loading cases", {
          message: casesError.message,
          supabaseError: casesError,
        });
        setError(casesError.message);
        setIsLoading(false);
        return;
      }

      setCases(data ?? []);
      setIsLoading(false);
    }

    loadCases();
  }, []);

  const openCases = cases.filter((caseItem) => !isClosedCase(caseItem));
  const closedCases = cases.filter(isClosedCase);

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-600">
          Mostrando casos asignados a{" "}
          <span className="font-semibold text-gray-950">{agentName}</span>
        </p>
      </section>

      {isLoading ? (
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <p className="p-6 text-sm text-gray-600">Cargando casos...</p>
        </section>
      ) : error ? (
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <p className="p-6 text-sm text-[var(--g66-danger)]">{error}</p>
        </section>
      ) : (
        <>
          <CasesSection
            title="Casos abiertos"
            cases={openCases}
            emptyText="No hay casos abiertos asignados para tu sesión demo."
          />
          <CasesSection
            title="Casos cerrados"
            cases={closedCases}
            emptyText="No hay casos cerrados asignados para tu sesión demo."
          />
        </>
      )}
    </>
  );
}
