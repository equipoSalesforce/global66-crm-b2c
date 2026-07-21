"use client";

import type {
  GlobalSearchCaseResult,
  GlobalSearchCustomerResult,
  GlobalSearchResponse,
} from "@/lib/global-search-types";
import { formatCaseNumber } from "@/lib/case-status";
import { BriefcaseBusiness, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const emptyResults: GlobalSearchResponse = { cases: [], customers: [], messages: [] };

type SearchSelection =
  | { type: "case"; item: GlobalSearchCaseResult }
  | { type: "customer"; item: GlobalSearchCustomerResult };

function resultKey(selection: SearchSelection) {
  return `${selection.type}:${selection.item.id}`;
}

export function GlobalSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResponse>(emptyResults);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedQuery = query.trim();
  const selections = useMemo<SearchSelection[]>(
    () => [
      ...results.cases.map((item) => ({ type: "case" as const, item })),
      ...results.customers.map((item) => ({ type: "customer" as const, item })),
    ],
    [results.cases, results.customers],
  );

  useEffect(() => {
    if (normalizedQuery.length < 2) return;

    let controller: AbortController | null = null;
    const debounceId = window.setTimeout(async () => {
      controller = new AbortController();
      try {
        const response = await fetch(
          `/api/search/global?q=${encodeURIComponent(normalizedQuery)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as GlobalSearchResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "No se pudo realizar la búsqueda.");
        setResults(payload);
        setError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setResults(emptyResults);
        setError(caught instanceof Error ? caught.message : "No se pudo realizar la búsqueda.");
      } finally {
        if (!controller?.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(debounceId);
      controller?.abort();
    };
  }, [normalizedQuery]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function updateQuery(value: string) {
    const shouldSearch = value.trim().length >= 2;
    setQuery(value);
    setIsOpen(shouldSearch);
    setIsLoading(shouldSearch);
    setActiveIndex(-1);
    setError(null);
    setResults(emptyResults);
  }

  function selectResult(selection: SearchSelection) {
    setIsOpen(false);
    setActiveIndex(-1);
    setQuery("");
    setResults(emptyResults);

    if (selection.type === "case") {
      router.push(`/casos/${selection.item.id}`);
      return;
    }

    router.push(selection.item.publicId ? `/cuentas/${selection.item.publicId}` : "/cuentas");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (normalizedQuery.length < 2) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, selections.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      setIsOpen(true);
      if (activeIndex >= 0 && selections[activeIndex]) {
        selectResult(selections[activeIndex]);
      }
    }
  }

  const hasResults = selections.length > 0;
  const activeSelection = selections[activeIndex];

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <label className="flex h-9 w-full items-center gap-2 rounded-xl border border-[var(--g66-border)] bg-[var(--g66-surface-soft)] px-3 text-[var(--g66-text-muted)] transition focus-within:border-[var(--g66-brand-blue)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--g66-brand-blue-soft)]">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onFocus={() => normalizedQuery.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar clientes, casos, conversaciones..."
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="global-search-results"
          aria-activedescendant={activeSelection ? `global-search-${resultKey(activeSelection)}` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-normal text-[var(--g66-text-primary)] outline-none placeholder:text-[var(--g66-text-muted)]"
        />
      </label>

      {isOpen ? (
        <div id="global-search-results" className="absolute left-0 right-0 top-[calc(100%+8px)] z-[120] max-h-[min(440px,calc(100vh-90px))] overflow-y-auto rounded-xl border border-[var(--g66-border)] bg-white shadow-2xl" role="listbox">
          <div className="sticky top-0 z-10 border-b border-[var(--g66-border-soft)] bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--g66-text-muted)]">
            Resultados
          </div>
          {isLoading ? <p className="px-4 py-6 text-center text-xs text-[var(--g66-text-secondary)]">Buscando...</p> : null}
          {!isLoading && error ? <p className="px-4 py-6 text-center text-xs text-[var(--g66-danger)]">{error}</p> : null}

          {!isLoading && !error && results.cases.length ? (
            <section className="py-2">
              <h2 className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--g66-text-muted)]">Casos</h2>
              {results.cases.map((caseItem) => {
                const selection: SearchSelection = { type: "case", item: caseItem };
                const index = selections.findIndex((item) => resultKey(item) === resultKey(selection));
                return (
                  <button
                    id={`global-search-${resultKey(selection)}`}
                    key={resultKey(selection)}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectResult(selection)}
                    className={`flex w-full items-start gap-3 px-4 py-2.5 text-left ${activeIndex === index ? "bg-[var(--g66-brand-blue-soft)]" : "hover:bg-[var(--g66-surface-soft)]"}`}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]"><BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3"><strong className="truncate text-xs font-semibold text-[var(--g66-text-primary)]">{formatCaseNumber(caseItem.caseNumber, caseItem.id)}</strong><small className="shrink-0 text-[10px] text-[var(--g66-text-muted)]">{caseItem.status || "Sin estado"}</small></span>
                      <span className="mt-0.5 block truncate text-[11px] text-[var(--g66-text-secondary)]">{caseItem.subject || "Sin asunto"}</span>
                      <span className="block truncate text-[10px] text-[var(--g66-text-muted)]">{[caseItem.customerName, caseItem.customerEmail].filter(Boolean).join(" · ") || "Sin cliente asociado"}</span>
                    </span>
                  </button>
                );
              })}
            </section>
          ) : null}

          {!isLoading && !error && results.customers.length ? (
            <section className="border-t border-[var(--g66-border-soft)] py-2">
              <h2 className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--g66-text-muted)]">Clientes</h2>
              {results.customers.map((customer) => {
                const selection: SearchSelection = { type: "customer", item: customer };
                const index = selections.findIndex((item) => resultKey(item) === resultKey(selection));
                return (
                  <button
                    id={`global-search-${resultKey(selection)}`}
                    key={resultKey(selection)}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectResult(selection)}
                    className={`flex w-full items-start gap-3 px-4 py-2.5 text-left ${activeIndex === index ? "bg-[var(--g66-brand-blue-soft)]" : "hover:bg-[var(--g66-surface-soft)]"}`}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><UserRound className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-[var(--g66-text-primary)]">{customer.name || "Cliente sin nombre"}</strong><span className="mt-0.5 block truncate text-[11px] text-[var(--g66-text-secondary)]">{customer.email || "Sin email"}</span><span className="block truncate text-[10px] text-[var(--g66-text-muted)]">{customer.phone || "Sin teléfono"}</span></span>
                  </button>
                );
              })}
            </section>
          ) : null}

          {!isLoading && !error && !hasResults ? (
            <p className="px-4 py-7 text-center text-xs text-[var(--g66-text-secondary)]">No se encontraron resultados.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
