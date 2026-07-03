"use client";

import { getAccountProductDetail, type AccountProductDetail, type AccountProductSummary } from "@/lib/account-360-api";
import {
  ChevronDown,
  CircleAlert,
  CreditCard,
  LoaderCircle,
  Receipt,
  RefreshCcw,
  Send,
  ShoppingCart,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { displayValue, formatDate, formatMoney } from "./account-360-format";

const productVisuals: Record<string, { icon: LucideIcon; color: string }> = {
  remittance: { icon: Send, color: "bg-blue-50 text-blue-600" },
  p2p: { icon: UsersRound, color: "bg-violet-50 text-violet-600" },
  exchange: { icon: RefreshCcw, color: "bg-cyan-50 text-cyan-600" },
  card: { icon: CreditCard, color: "bg-amber-50 text-amber-600" },
  payments: { icon: Receipt, color: "bg-rose-50 text-rose-600" },
  card_purchases: { icon: ShoppingCart, color: "bg-slate-100 text-slate-600" },
};

export function AccountProductCard({ accountId, product }: { accountId: string; product: AccountProductSummary }) {
  const [isOpen, setIsOpen] = useState(false);
  const [detail, setDetail] = useState<AccountProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visual = productVisuals[product.product_code] || {
    icon: CreditCard,
    color: "bg-blue-50 text-blue-600",
  };
  const ProductIcon = visual.icon;

  async function toggleDetail() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (!nextOpen || detail || isLoading || !product.detail_available) return;

    setIsLoading(true);
    setError(null);
    try {
      setDetail(await getAccountProductDetail(accountId, product.product_code));
    } catch {
      setError("No pudimos cargar el detalle. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border border-[#e6eaf1] bg-white transition-shadow hover:shadow-sm">
      <button type="button" onClick={toggleDetail} className="flex min-h-14 w-full items-center gap-2.5 px-3 py-2.5 text-left" aria-expanded={isOpen}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${visual.color}`}>
          <ProductIcon className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-[var(--g66-text-primary)]">{product.product_name}</span>
          <span className="block truncate text-[10px] text-[var(--g66-text-muted)]">{product.summary} · {formatDate(product.last_activity_at)}</span>
        </span>
        <span className="text-right">
          <span className="block text-xs font-extrabold text-[var(--g66-text-primary)]">{product.active_count ?? formatMoney(product.volume_usd)}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--g66-text-muted)]">{product.active_count !== null && product.active_count !== undefined ? "activas" : "volumen"}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="border-t border-[var(--g66-border-soft)] bg-[#fafcff] p-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--g66-text-secondary)]"><LoaderCircle className="h-4 w-4 animate-spin" /> Cargando detalle…</div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>
          ) : detail ? (
            <div className="overflow-x-auto rounded-lg border border-[var(--g66-border-soft)] bg-white">
              <table className="w-full min-w-[560px] text-left text-[10px]">
                <thead className="bg-slate-50 text-[8px] uppercase tracking-wide text-[var(--g66-text-muted)]">
                  <tr><th className="px-2 py-2">ID transacción</th><th className="px-2 py-2">Fecha</th><th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Moneda</th><th className="px-2 py-2 text-right">Monto</th><th className="px-2 py-2">Estado</th></tr>
                </thead>
                <tbody>
                  {detail.recent_activity.map((transaction) => (
                    <tr key={transaction.activity_id} className="text-[var(--g66-text-secondary)]">
                      <td className="border-t border-[var(--g66-border-soft)] px-2 py-2 font-semibold">{transaction.activity_id}</td>
                      <td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{formatDate(transaction.occurred_at, true)}</td>
                      <td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{displayValue(transaction.activity_type)}</td>
                      <td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{displayValue(transaction.currency)}</td>
                      <td className="border-t border-[var(--g66-border-soft)] px-2 py-2 text-right font-bold">{transaction.amount !== null && transaction.amount !== undefined ? formatMoney(transaction.amount, transaction.currency || "USD") : "—"}</td>
                      <td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{displayValue(transaction.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!detail.recent_activity.length ? <p className="border-t border-[var(--g66-border-soft)] py-5 text-center text-[10px] text-[var(--g66-text-muted)]">No hay transacciones disponibles para este producto.</p> : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--g66-text-muted)]">Detalle no disponible.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
