"use client";

import type {
  RelatedCaseRecord,
  RelatedCasesResponse,
} from "@/lib/case-info-links-types";
import { formatCaseNumber } from "@/lib/case-status";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const reportPageSize = 10;

function shortDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short" }).format(date);
}

function visibleValue(value: string | null) {
  return value?.trim() || "—";
}

async function requestRelatedCases(caseId: string, page: number, pageSize: number) {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(`/api/cases/${caseId}/related-cases?${searchParams}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as RelatedCasesResponse & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "No se pudieron cargar los casos del cliente.");
  }

  return payload;
}

export function CaseRelatedCasesSection({ caseId }: { caseId: string }) {
  const [recentCases, setRecentCases] = useState<RelatedCaseRecord[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [report, setReport] = useState<RelatedCasesResponse | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cases/${caseId}/related-cases?limit=5`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as RelatedCasesResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "No se pudieron cargar los casos del cliente.");
        setRecentCases(payload.items);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los casos del cliente.");
      })
      .finally(() => setIsLoadingRecent(false));

    return () => controller.abort();
  }, [caseId]);

  useEffect(() => {
    if (!isReportOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsReportOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isReportOpen]);

  async function loadReportPage(page: number) {
    setIsLoadingReport(true);
    setError(null);
    try {
      const payload = await requestRelatedCases(caseId, page, reportPageSize);
      setReport(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los casos del cliente.");
    } finally {
      setIsLoadingReport(false);
    }
  }

  function openReport() {
    setIsReportOpen(true);
    void loadReportPage(1);
  }

  const totalPages = report ? Math.max(1, Math.ceil(report.total / report.pageSize)) : 1;

  return (
    <>
      <div className="grid gap-2">
        {recentCases.map((caseItem) => (
          <Link
            key={caseItem.id}
            href={`/casos/${caseItem.id}`}
            className="rounded-lg border border-[var(--g66-border)] bg-white p-3 transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--g66-brand-blue)]">
                {formatCaseNumber(caseItem.case_number, caseItem.id)}
              </span>
              <span className="text-[10px] text-[var(--g66-text-muted)]">{shortDate(caseItem.created_at)}</span>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
              <div><dt className="text-[var(--g66-text-muted)]">Área</dt><dd className="truncate text-[var(--g66-text-secondary)]">{visibleValue(caseItem.area)}</dd></div>
              <div><dt className="text-[var(--g66-text-muted)]">Canal</dt><dd className="truncate text-[var(--g66-text-secondary)]">{visibleValue(caseItem.channel)}</dd></div>
              <div><dt className="text-[var(--g66-text-muted)]">Estado</dt><dd className="truncate text-[var(--g66-text-secondary)]">{visibleValue(caseItem.lifecycle_status || caseItem.status)}</dd></div>
            </dl>
          </Link>
        ))}
        {isLoadingRecent ? <p className="text-xs text-[var(--g66-text-secondary)]">Cargando casos...</p> : null}
        {!isLoadingRecent && recentCases.length === 0 && !error ? (
          <p className="rounded-lg border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-xs text-[var(--g66-text-secondary)]">No hay casos relacionados para este cliente.</p>
        ) : null}
        {error ? <p className="rounded-lg bg-[var(--g66-danger-soft)] p-3 text-xs text-[var(--g66-danger)]">{error}</p> : null}
        <button type="button" onClick={openReport} className="mt-1 h-8 rounded-lg border border-[var(--g66-brand-blue)] text-xs font-semibold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]">
          Todos los casos
        </button>
      </div>

      {isReportOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px] md:p-[60px_80px]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="related-cases-report-title"
            >
              <div className="grid max-h-[calc(100vh-64px)] w-[calc(100vw-32px)] max-w-[1280px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-[var(--g66-border)] bg-white shadow-2xl md:max-h-[calc(100vh-120px)] md:w-[calc(100vw-160px)]">
                <header className="z-20 flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--g66-border)] bg-white px-5 py-3">
                  <div className="min-w-0">
                    <h2
                      id="related-cases-report-title"
                      className="truncate text-base font-semibold text-[var(--g66-text-primary)]"
                    >
                      Todos los casos del cliente
                    </h2>
                    <p className="mt-0.5 text-[11px] text-[var(--g66-text-muted)]">
                      Casos ordenados por fecha de creación, más recientes primero
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReportOpen(false)}
                    aria-label="Cerrar reporte de casos"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] transition hover:bg-[var(--g66-background)] hover:text-[var(--g66-text-primary)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </header>

                <div className="min-h-0 overflow-x-auto overflow-y-auto overscroll-contain">
                  <table className="min-w-[1440px] border-collapse text-left text-[11px]">
                    <thead className="sticky top-0 z-10 bg-[var(--g66-surface-soft)] text-[10px] uppercase text-[var(--g66-text-muted)] shadow-[0_1px_0_var(--g66-border)]">
                      <tr>{["Propietario del caso", "Número del Caso", "Número Caso Seguimiento", "Tipo de Contacto", "Producto", "SubProducto", "Cat principal", "Cat Secundaria", "Cat Extra", "Asunto", "Descripción", "Estado"].map((column) => <th key={column} className="whitespace-nowrap px-3 py-2.5 font-semibold">{column}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--g66-border-soft)]">
                      {(report?.items ?? []).map((caseItem) => (
                        <tr key={`report-${caseItem.id}`} className="hover:bg-[var(--g66-background)]">
                          <td className="whitespace-nowrap px-3 py-2">{visibleValue(caseItem.assigned_to)}</td>
                          <td className="whitespace-nowrap px-3 py-2"><Link href={`/casos/${caseItem.id}`} className="font-semibold text-[var(--g66-brand-blue)] hover:underline">{formatCaseNumber(caseItem.case_number, caseItem.id)}</Link></td>
                          <td className="whitespace-nowrap px-3 py-2">{visibleValue(caseItem.numero_caso_seguimiento)}</td>
                          <td className="whitespace-nowrap px-3 py-2">{visibleValue(caseItem.contact_type)}</td>
                          <td className="whitespace-nowrap px-3 py-2">{visibleValue(caseItem.product)}</td>
                          <td className="whitespace-nowrap px-3 py-2">{visibleValue(caseItem.subproduct)}</td>
                          <td className="whitespace-nowrap px-3 py-2">{visibleValue(caseItem.category)}</td>
                          <td className="whitespace-nowrap px-3 py-2">{visibleValue(caseItem.cat_secundaria)}</td>
                          <td className="whitespace-nowrap px-3 py-2">{visibleValue(caseItem.ai_category)}</td>
                          <td className="w-52 max-w-52 truncate px-3 py-2" title={caseItem.subject ?? undefined}>{visibleValue(caseItem.subject)}</td>
                          <td className="w-64 max-w-64 truncate px-3 py-2" title={caseItem.description ?? undefined}>{visibleValue(caseItem.description)}</td>
                          <td className="whitespace-nowrap px-3 py-2">{visibleValue(caseItem.lifecycle_status || caseItem.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {isLoadingReport ? <p className="sticky left-0 p-6 text-center text-xs text-[var(--g66-text-secondary)]">Cargando reporte...</p> : null}
                  {!isLoadingReport && report?.items.length === 0 ? <p className="sticky left-0 p-6 text-center text-xs text-[var(--g66-text-secondary)]">No hay casos para mostrar.</p> : null}
                </div>

                <footer className="z-20 flex min-h-14 shrink-0 flex-col items-stretch justify-between gap-2 border-t border-[var(--g66-border)] bg-white px-5 py-2 text-xs text-[var(--g66-text-secondary)] sm:flex-row sm:items-center sm:gap-4">
                  <span>Página {report?.page ?? 1} de {totalPages}</span>
                  <div className="flex justify-end gap-2">
                    <button type="button" disabled={isLoadingReport || !report || report.page <= 1} onClick={() => void loadReportPage((report?.page ?? 1) - 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--g66-border)] px-3 font-medium disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Anterior</button>
                    <button type="button" disabled={isLoadingReport || !report || report.page >= totalPages} onClick={() => void loadReportPage((report?.page ?? 1) + 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--g66-border)] px-3 font-medium disabled:cursor-not-allowed disabled:opacity-40">Siguiente<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
