"use client";

import { Clock3, Plus, Search, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

export type CaseMacroAction = {
  id: string;
  action_type: string;
  sort_order: number | null;
  payload: Record<string, unknown>;
};

export type CaseMacro = {
  id: string;
  name: string;
  description: string | null;
  macro_actions?: CaseMacroAction[] | null;
};

export function CaseMacroModal({
  macros,
  selectedMacroId,
  searchQuery,
  recentMacroIds,
  isExecuting,
  onSearchChange,
  onSelect,
  onExecute,
  onClose,
  summarizeAction,
}: {
  macros: CaseMacro[];
  selectedMacroId: string;
  searchQuery: string;
  recentMacroIds: string[];
  isExecuting: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (macroId: string) => void;
  onExecute: () => void;
  onClose: () => void;
  summarizeAction: (action: CaseMacroAction) => string;
}) {
  const recentSectionRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredMacros = useMemo(
    () =>
      macros.filter((macro) =>
        `${macro.name} ${macro.description ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      ),
    [macros, normalizedQuery],
  );
  const selectedMacro = macros.find((macro) => macro.id === selectedMacroId) ?? null;
  const recentMacros = recentMacroIds
    .map((macroId) => macros.find((macro) => macro.id === macroId))
    .filter((macro): macro is CaseMacro => Boolean(macro));

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isExecuting) onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isExecuting, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-macros-title"
        className="grid h-[calc(100vh-32px)] max-h-[680px] min-h-0 w-full max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-[var(--g66-border)] bg-white shadow-2xl"
      >
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--g66-border)] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
              <Wand2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 id="case-macros-title" className="text-base font-semibold text-[var(--g66-text-primary)]">
              Macros
            </h2>
          </div>
          <button
            type="button"
            disabled={isExecuting}
            onClick={onClose}
            aria-label="Cerrar macros"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--g66-border)] text-[var(--g66-text-secondary)] hover:bg-[var(--g66-surface-soft)] disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex items-center gap-2 border-b border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] px-5 py-3">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--g66-border)] bg-white px-3 text-[var(--g66-text-muted)] focus-within:border-[var(--g66-brand-blue)]">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar macros..."
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-xs text-[var(--g66-text-primary)] outline-none placeholder:text-[var(--g66-text-muted)]"
            />
          </label>
          <button
            type="button"
            disabled
            title="Creación de macros disponible desde Configuración"
            aria-label="Crear macro"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--g66-border)] bg-white text-[var(--g66-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => recentSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
            title="Ver macros recientes"
            aria-label="Ver macros recientes"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] hover:border-[var(--g66-brand-blue)] hover:text-[var(--g66-brand-blue)]"
          >
            <Clock3 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid min-h-0 grid-rows-2 md:grid-cols-[minmax(260px,38%)_minmax(0,1fr)] md:grid-rows-none">
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] border-b border-[var(--g66-border)] md:border-b-0 md:border-r">
            <div className="min-h-0 overflow-y-auto p-3">
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--g66-text-muted)]">
                Macros disponibles
              </p>
              <div className="grid gap-1.5">
                {filteredMacros.map((macro) => (
                  <button
                    key={macro.id}
                    type="button"
                    onClick={() => onSelect(macro.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition ${selectedMacroId === macro.id ? "border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue-soft)]" : "border-transparent hover:border-[var(--g66-border)] hover:bg-[var(--g66-surface-soft)]"}`}
                  >
                    <strong className="block truncate text-xs font-semibold text-[var(--g66-text-primary)]">
                      {macro.name}
                    </strong>
                    <span className="mt-1 line-clamp-2 block text-[10px] leading-4 text-[var(--g66-text-secondary)]">
                      {macro.description || "Sin descripción"}
                    </span>
                  </button>
                ))}
                {macros.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[var(--g66-border)] p-4 text-center text-xs text-[var(--g66-text-secondary)]">
                    No hay macros configuradas.
                  </p>
                ) : null}
                {macros.length > 0 && filteredMacros.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[var(--g66-border)] p-4 text-center text-xs text-[var(--g66-text-secondary)]">
                    No hay macros que coincidan con la búsqueda.
                  </p>
                ) : null}
              </div>
            </div>

            <div ref={recentSectionRef} className="border-t border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] p-3">
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--g66-text-muted)]">
                Reciente
              </p>
              {recentMacros.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recentMacros.map((macro) => (
                    <button key={`recent-${macro.id}`} type="button" onClick={() => onSelect(macro.id)} className="max-w-full truncate rounded-md border border-[var(--g66-border)] bg-white px-2 py-1 text-[10px] font-medium text-[var(--g66-text-secondary)] hover:text-[var(--g66-brand-blue)]">
                      {macro.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 px-2 text-[10px] text-[var(--g66-text-muted)]">No hay macros recientes.</p>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            {selectedMacro ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--g66-text-muted)]">Vista previa</p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--g66-text-primary)]">{selectedMacro.name}</h3>
                <p className="mt-2 text-xs leading-5 text-[var(--g66-text-secondary)]">{selectedMacro.description || "Sin descripción"}</p>
                <div className="mt-5 overflow-hidden rounded-xl border border-[var(--g66-border)]">
                  <div className="border-b border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--g66-text-muted)]">
                    Acciones
                  </div>
                  <ol className="divide-y divide-[var(--g66-border-soft)]">
                    {(selectedMacro.macro_actions ?? [])
                      .slice()
                      .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
                      .map((action, index) => (
                        <li key={action.id} className="flex gap-3 px-4 py-3 text-xs text-[var(--g66-text-primary)]">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--g66-brand-blue-soft)] text-[10px] font-semibold text-[var(--g66-brand-blue)]">{index + 1}</span>
                          <span>{summarizeAction(action)}</span>
                        </li>
                      ))}
                    {(selectedMacro.macro_actions ?? []).length === 0 ? (
                      <li className="px-4 py-5 text-center text-xs text-[var(--g66-text-secondary)]">Esta macro no tiene acciones configuradas.</li>
                    ) : null}
                  </ol>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--g66-surface-soft)] text-[var(--g66-text-muted)]">
                  <Wand2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-[var(--g66-text-primary)]">No hay nada para realizar una vista previa</h3>
                <p className="mt-2 max-w-sm text-xs leading-5 text-[var(--g66-text-secondary)]">Para realizar una vista previa, modificar o ejecutar una macro, seleccione una de la lista.</p>
              </div>
            )}
          </div>
        </div>

        <footer className="flex min-h-14 items-center justify-end gap-2 border-t border-[var(--g66-border)] bg-white px-5 py-2.5">
          <button type="button" disabled={isExecuting} onClick={onClose} className="h-8 rounded-lg border border-[var(--g66-border)] px-3 text-xs font-medium text-[var(--g66-text-secondary)] hover:bg-[var(--g66-surface-soft)] disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" disabled={!selectedMacro || isExecuting} onClick={onExecute} className="h-8 rounded-lg bg-[var(--g66-brand-blue)] px-4 text-xs font-semibold text-white hover:bg-[var(--g66-brand-blue-hover)] disabled:cursor-not-allowed disabled:bg-[var(--g66-border)]">
            {isExecuting ? "Ejecutando..." : "Ejecutar"}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
