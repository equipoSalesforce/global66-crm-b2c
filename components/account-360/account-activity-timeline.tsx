"use client";

import type { AccountActivityItem } from "@/lib/account-360-api";
import { History } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate, formatMoney } from "./account-360-format";

const filters = ["Todo", "Casos", "WhatsApp · IA", "Llamadas", "Emails", "Transacciones"] as const;

function matches(item: AccountActivityItem, filter: (typeof filters)[number]) {
  const haystack = `${item.activity_type} ${item.channel} ${item.title}`.toUpperCase();
  if (filter === "Todo") return true;
  if (filter === "Casos") return /CASE|CASO|SUPPORT/.test(haystack);
  if (filter === "WhatsApp · IA") return /WHATSAPP|AI|IA/.test(haystack);
  if (filter === "Llamadas") return /CALL|PHONE|LLAMADA/.test(haystack);
  if (filter === "Emails") return /EMAIL|MAIL/.test(haystack);
  return /TRANSACTION|EXCHANGE|PAYMENT|CARD|P2P|REM/.test(haystack);
}

export function AccountActivityTimeline({ items }: { items: AccountActivityItem[] }) {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("Todo");
  const visibleItems = useMemo(() => items.filter((item) => matches(item, activeFilter)), [activeFilter, items]);

  return (
    <section className="rounded-2xl border border-[#e3e8f2] bg-white p-4 shadow-[0_2px_8px_rgb(15_23_42/0.03)]">
      <div className="flex items-center gap-2.5"><span className="rounded-lg bg-blue-50 p-1.5 text-blue-600"><History className="h-4 w-4" /></span><div><h2 className="text-sm font-extrabold text-[var(--g66-text-primary)]">Actividad unificada</h2><p className="text-[10px] text-[var(--g66-text-muted)]">Casos, canales y transacciones en una sola línea de tiempo</p></div></div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {filters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${activeFilter === filter ? "border-blue-600 bg-blue-600 text-white" : "border-[var(--g66-border)] bg-white text-[var(--g66-text-secondary)] hover:bg-blue-50"}`}>{filter}</button>)}
      </div>
      {visibleItems.length ? (
        <ol className="mt-3 space-y-0">
          {visibleItems.map((item, index) => (
            <li key={item.activity_id} className="relative grid grid-cols-[14px_minmax(0,1fr)_auto] gap-2.5 pb-3 last:pb-0">
              {index < visibleItems.length - 1 ? <span className="absolute left-[7px] top-4 h-full w-px bg-[var(--g66-border)]" /> : null}
              <span className="relative mt-1 h-3.5 w-3.5 rounded-full border-[3px] border-cyan-100 bg-cyan-500" />
              <div><div className="flex flex-wrap items-center gap-1.5"><p className="text-xs font-bold text-[var(--g66-text-primary)]">{item.title}</p><span className="rounded-full bg-cyan-50 px-1.5 py-0.5 text-[9px] font-bold text-cyan-700">{item.activity_type.replaceAll("_", " ")}</span></div><p className="mt-0.5 text-[10px] text-[var(--g66-text-muted)]">{item.description || "Sin descripción"}{item.amount !== null && item.amount !== undefined ? ` · ${formatMoney(item.amount, item.currency || "USD")}` : ""}</p></div>
              <time className="text-right text-[10px] font-semibold text-[var(--g66-text-muted)]">{formatDate(item.occurred_at, true)}</time>
            </li>
          ))}
        </ol>
      ) : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay actividad para este filtro.</p>}
    </section>
  );
}
