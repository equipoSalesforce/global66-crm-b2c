"use client";

import type { CaseInfoLinkView } from "@/lib/case-info-links-types";
import { X } from "lucide-react";
import type { ReactNode } from "react";

const viewTitles: Record<CaseInfoLinkView, string> = {
  cases: "Casos",
  qa: "Notas QA",
  email: "Correos",
  ai: "IA",
  history: "Historial",
  activity: "Actividades",
  sla: "SLA",
  calls: "Llamados",
};

export function CaseInfoLinksPanel({
  view,
  onClose,
  children,
}: {
  view: CaseInfoLinkView;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-[min(440px,94vw)] flex-col border-l border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-soft)]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] px-4">
        <h2 className="text-sm font-semibold text-[var(--g66-text-primary)]">
          {viewTitles[view]}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Cerrar ${viewTitles[view]}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] transition hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}
