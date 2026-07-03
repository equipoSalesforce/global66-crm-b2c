"use client";

import type { Account360 } from "@/lib/account-360-api";
import { ArrowRight, Fingerprint, X } from "lucide-react";
import { useState } from "react";
import { formatDate } from "./account-360-format";

export function AccountKycHistory({ items }: { items: Account360["kyc_history"] }) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-[#e3e8f2] bg-white p-4 shadow-[0_2px_8px_rgb(15_23_42/0.03)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-violet-50 p-1.5 text-violet-600"><Fingerprint className="h-4 w-4" /></span>
          <div><h2 className="text-sm font-extrabold text-[var(--g66-text-primary)]">Historial de cambios (KYC)</h2><p className="text-[10px] text-[var(--g66-text-muted)]">Registro de modificaciones de la cuenta</p></div>
        </div>
        <button type="button" onClick={() => setIsHistoryOpen(true)} className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-[var(--g66-brand-blue)] hover:underline">Historial completo <ArrowRight className="h-3 w-3" /></button>
      </div>
      {items.length ? (
        <ol className="mt-3 space-y-0">
          {items.map((item, index) => (
            <li key={item.event_id} className="relative grid grid-cols-[14px_minmax(0,1fr)_auto] gap-2.5 pb-3 last:pb-0">
              {index < items.length - 1 ? <span className="absolute left-[7px] top-4 h-full w-px bg-[var(--g66-border)]" /> : null}
              <span className="relative mt-1 h-3.5 w-3.5 rounded-full border-[3px] border-violet-100 bg-violet-600" />
              <div><p className="text-xs font-bold text-[var(--g66-text-primary)]">{item.description}</p><p className="mt-0.5 text-[10px] text-[var(--g66-text-muted)]">{item.status.replaceAll("_", " ")} · {item.source.replaceAll("_", " ")}</p></div>
              <time className="text-[10px] font-semibold text-[var(--g66-text-muted)]">{formatDate(item.occurred_at)}</time>
            </li>
          ))}
        </ol>
      ) : <p className="mt-4 text-sm text-[var(--g66-text-muted)]">Sin cambios KYC registrados.</p>}

      {isHistoryOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="kyc-history-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsHistoryOpen(false); }}>
          <section className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--g66-border)] bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-[var(--g66-border)] px-4 py-3"><div><h3 id="kyc-history-title" className="text-sm font-extrabold text-[var(--g66-text-primary)]">Historial completo KYC</h3><p className="mt-0.5 text-[10px] text-[var(--g66-text-muted)]">Cambios registrados por fecha y origen</p></div><button type="button" onClick={() => setIsHistoryOpen(false)} className="rounded-lg border border-[var(--g66-border)] p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Cerrar historial"><X className="h-4 w-4" /></button></header>
            <div className="max-h-[65vh] overflow-auto p-4">
              <table className="w-full min-w-[680px] text-left text-[10px]"><thead className="bg-slate-50 text-[8px] uppercase tracking-wide text-[var(--g66-text-muted)]"><tr><th className="px-2 py-2">Fecha</th><th className="px-2 py-2">Campo</th><th className="px-2 py-2">Valor anterior</th><th className="px-2 py-2">Valor nuevo</th><th className="px-2 py-2">Origen</th></tr></thead><tbody>{items.map((item, index) => <tr key={item.event_id} className="text-[var(--g66-text-secondary)]"><td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{formatDate(item.occurred_at, true)}</td><td className="border-t border-[var(--g66-border-soft)] px-2 py-2 font-semibold">Estado KYC</td><td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{items[index + 1]?.status?.replaceAll("_", " ") || "—"}</td><td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{item.status.replaceAll("_", " ")}</td><td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{item.source.replaceAll("_", " ")}</td></tr>)}</tbody></table>
              {!items.length ? <p className="py-8 text-center text-xs text-[var(--g66-text-muted)]">No hay historial disponible.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
