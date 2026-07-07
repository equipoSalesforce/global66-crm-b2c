"use client";

import type { AccountProductSummary } from "@/lib/account-360-api";
import {
  ChevronDown,
  CreditCard,
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
  remesa: { icon: Send, color: "bg-blue-50 text-blue-600" },
  p2p: { icon: UsersRound, color: "bg-violet-50 text-violet-600" },
  exchange: { icon: RefreshCcw, color: "bg-cyan-50 text-cyan-600" },
  tarjeta: { icon: CreditCard, color: "bg-amber-50 text-amber-600" },
  pagos: { icon: Receipt, color: "bg-rose-50 text-rose-600" },
  compras_tarjeta: { icon: ShoppingCart, color: "bg-slate-100 text-slate-600" },
};

const numberFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

function formatAmount(value?: number | null) {
  return value === null || value === undefined ? "—" : numberFormatter.format(value);
}

function currencyPair(origin?: string | null, destiny?: string | null) {
  const values = [origin, destiny].filter(Boolean);
  return values.length ? values.join("_") : null;
}

export function AccountProductCard({ product }: { product: AccountProductSummary }) {
  const [isOpen, setIsOpen] = useState(false);
  const isCardModule = product.code === "tarjeta";
  const visual = productVisuals[product.code] || {
    icon: CreditCard,
    color: "bg-blue-50 text-blue-600",
  };
  const ProductIcon = visual.icon;

  return (
    <article className="overflow-hidden rounded-xl border border-[#e6eaf1] bg-white transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex min-h-16 w-full items-center gap-2.5 px-3 py-2.5 text-left"
        aria-expanded={isOpen}
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${visual.color}`}>
          <ProductIcon className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-[var(--g66-text-primary)]">{product.label}</span>
          <span className="block truncate text-[10px] text-[var(--g66-text-muted)]">
            {isCardModule
              ? `${product.own_cards_count ?? 0} propias · ${product.third_party_cards_count ?? 0} de terceros · última ${formatDate(product.last_activity_at)}`
              : `${product.movement_count} movimientos · Última ${formatDate(product.last_transaction_at)}`}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-xs font-extrabold text-[var(--g66-text-primary)]">
            {isCardModule ? product.active_cards_count ?? 0 : formatMoney(product.volume_usd)}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--g66-text-muted)]">
            {isCardModule ? "activas" : "volumen US$"}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="border-t border-[var(--g66-border-soft)] bg-[#fafcff] p-3">
          {isCardModule ? (
            <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 px-4 py-5 text-center">
              <CreditCard className="mx-auto h-5 w-5 text-amber-500" />
              <p className="mt-2 text-xs font-bold text-[var(--g66-text-secondary)]">
                Detalle de tarjetas no disponible todavía
              </p>
              <p className="mt-1 text-[10px] text-[var(--g66-text-muted)]">
                Este módulo quedará disponible cuando se conecte su fuente de datos.
              </p>
            </div>
          ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--g66-border-soft)] bg-white">
            <table className="w-full min-w-[1120px] text-left text-[10px]">
              <thead className="bg-slate-50 text-[8px] uppercase tracking-wide text-[var(--g66-text-muted)]">
                <tr>
                  <th className="px-2 py-2">ID transacción</th>
                  <th className="px-2 py-2">Producto</th>
                  <th className="px-2 py-2">Fecha</th>
                  <th className="px-2 py-2">Cliente</th>
                  <th className="px-2 py-2 text-right">Monto origen</th>
                  <th className="px-2 py-2 text-right">Origen US$</th>
                  <th className="px-2 py-2 text-right">Monto destino</th>
                  <th className="px-2 py-2 text-right">Destino US$</th>
                  <th className="px-2 py-2">Par de monedas</th>
                </tr>
              </thead>
              <tbody>
                {product.transactions.map((transaction) => (
                  <tr key={transaction.transaction_id} className="text-[var(--g66-text-secondary)]">
                    <td className="max-w-36 truncate border-t border-[var(--g66-border-soft)] px-2 py-2 font-semibold" title={transaction.transaction_id}>
                      {transaction.transaction_id}
                    </td>
                    <td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{displayValue(transaction.product)}</td>
                    <td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{formatDate(transaction.transaction_datetime, true)}</td>
                    <td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{transaction.customer_id}</td>
                    <td className="border-t border-[var(--g66-border-soft)] px-2 py-2 text-right font-semibold">{formatAmount(transaction.origin_amount)}</td>
                    <td className="border-t border-[var(--g66-border-soft)] px-2 py-2 text-right">{transaction.origin_amount_usd === null || transaction.origin_amount_usd === undefined ? "—" : formatMoney(transaction.origin_amount_usd)}</td>
                    <td className="border-t border-[var(--g66-border-soft)] px-2 py-2 text-right font-semibold">{formatAmount(transaction.destination_amount)}</td>
                    <td className="border-t border-[var(--g66-border-soft)] px-2 py-2 text-right">{transaction.destination_amount_usd === null || transaction.destination_amount_usd === undefined ? "—" : formatMoney(transaction.destination_amount_usd)}</td>
                    <td className="border-t border-[var(--g66-border-soft)] px-2 py-2">{displayValue(currencyPair(transaction.origin_currency, transaction.destiny_currency))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!product.transactions.length ? (
              <p className="border-t border-[var(--g66-border-soft)] py-5 text-center text-[10px] text-[var(--g66-text-muted)]">
                No hay transacciones disponibles para este producto.
              </p>
            ) : null}
          </div>
          )}
        </div>
      ) : null}
    </article>
  );
}
