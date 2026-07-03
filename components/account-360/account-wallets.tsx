"use client";

import type { AccountActivityItem, AccountWallet } from "@/lib/account-360-api";
import { ArrowRight, Layers3, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { displayValue, formatDate, formatMoney } from "./account-360-format";

export function AccountWallets({
  wallets,
  accountId,
  movements,
}: {
  wallets: AccountWallet[];
  accountId: string;
  movements: AccountActivityItem[];
}) {
  const [isMovementsOpen, setIsMovementsOpen] = useState(false);
  const total = wallets.reduce((sum, wallet) => sum + (wallet.balance_usd || 0), 0);
  const transactionMovements = movements.filter(
    (item) =>
      item.amount !== null &&
      item.amount !== undefined,
  );

  return (
    <section className="rounded-2xl border border-[#e3e8f2] bg-white p-4 shadow-[0_2px_8px_rgb(15_23_42/0.03)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600"><WalletCards className="h-4 w-4" /></span>
          <div>
          <h2 className="text-sm font-extrabold text-[var(--g66-text-primary)]">Billeteras multimoneda</h2>
          <p className="text-[10px] text-[var(--g66-text-muted)]">Saldos disponibles por moneda</p>
          </div>
        </div>
        <button type="button" onClick={() => setIsMovementsOpen(true)} className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--g66-brand-blue)] hover:underline">Movimientos <ArrowRight className="h-3 w-3" /></button>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
        <span className="flex items-center gap-2"><Layers3 className="h-4 w-4" /> Saldo total en billeteras</span>
        <span>{formatMoney(total)}</span>
      </div>

      {wallets.length ? (
        <div className="mt-2.5 grid gap-2.5 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <article key={wallet.currency} className="rounded-xl border border-[var(--g66-border-soft)] bg-[#fcfdff] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--g66-text-muted)]">Moneda <span className="ml-1 text-xs text-[var(--g66-text-secondary)]">{wallet.currency}</span></p>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-emerald-600 ring-1 ring-slate-100">{displayValue(wallet.status)}</span>
              </div>
              <p className="mt-2 text-lg font-extrabold text-[var(--g66-text-primary)]">{formatMoney(wallet.available_balance, wallet.currency)}</p>
              <p className="mt-0.5 text-[10px] text-[var(--g66-text-muted)]">≈ {formatMoney(wallet.balance_usd)} USD</p>
              <dl className="mt-2.5 space-y-1 border-t border-[var(--g66-border-soft)] pt-2 text-[10px]">
                <div className="flex justify-between gap-3"><dt className="font-bold uppercase tracking-wide text-[var(--g66-text-muted)]">N° cuenta</dt><dd className="font-semibold text-[var(--g66-text-secondary)]">{displayValue(wallet.account_number)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-bold uppercase tracking-wide text-[var(--g66-text-muted)]">Account ID</dt><dd className="max-w-36 truncate font-semibold text-[var(--g66-text-secondary)]">{displayValue(wallet.account_id || accountId)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-bold uppercase tracking-wide text-[var(--g66-text-muted)]">Branch</dt><dd className="font-semibold text-[var(--g66-text-secondary)]">{displayValue(wallet.branch)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No hay billeteras disponibles.</p>
      )}
      {isMovementsOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="movements-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsMovementsOpen(false); }}>
          <section className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--g66-border)] bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-[var(--g66-border)] px-4 py-3">
              <div><h3 id="movements-title" className="text-sm font-extrabold text-[var(--g66-text-primary)]">Movimientos de la cuenta</h3><p className="mt-0.5 text-[10px] text-[var(--g66-text-muted)]">Actividad transaccional disponible</p></div>
              <button type="button" onClick={() => setIsMovementsOpen(false)} className="rounded-lg border border-[var(--g66-border)] p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Cerrar movimientos"><X className="h-4 w-4" /></button>
            </header>
            <div className="max-h-[65vh] overflow-auto p-4">
              <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-[10px]">
                <thead><tr className="text-[9px] uppercase tracking-wide text-[var(--g66-text-muted)]"><th className="border-b border-[var(--g66-border)] px-2 py-2">ID movimiento</th><th className="border-b border-[var(--g66-border)] px-2 py-2">Fecha</th><th className="border-b border-[var(--g66-border)] px-2 py-2">Tipo</th><th className="border-b border-[var(--g66-border)] px-2 py-2">Moneda</th><th className="border-b border-[var(--g66-border)] px-2 py-2 text-right">Monto</th><th className="border-b border-[var(--g66-border)] px-2 py-2">Estado</th></tr></thead>
                <tbody>{transactionMovements.map((movement) => <tr key={movement.activity_id} className="text-[var(--g66-text-secondary)]"><td className="border-b border-[var(--g66-border-soft)] px-2 py-2 font-semibold">{movement.activity_id}</td><td className="border-b border-[var(--g66-border-soft)] px-2 py-2">{formatDate(movement.occurred_at, true)}</td><td className="border-b border-[var(--g66-border-soft)] px-2 py-2">{displayValue(movement.activity_type)}</td><td className="border-b border-[var(--g66-border-soft)] px-2 py-2">{displayValue(movement.currency)}</td><td className="border-b border-[var(--g66-border-soft)] px-2 py-2 text-right font-bold">{formatMoney(movement.amount || 0, movement.currency || "USD")}</td><td className="border-b border-[var(--g66-border-soft)] px-2 py-2">{displayValue(movement.status)}</td></tr>)}</tbody>
              </table>
              {!transactionMovements.length ? <p className="py-8 text-center text-xs text-[var(--g66-text-muted)]">No hay movimientos disponibles.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
