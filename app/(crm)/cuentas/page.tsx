import { Account360ApiError, getAccount360 } from "@/lib/account-360-api";
import { ChevronRight, Search, UsersRound } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  let account = null;
  let loadError = false;

  try {
    account = await getAccount360("demo-account");
  } catch (error) {
    loadError = error instanceof Account360ApiError;
  }

  return (
    <div className="space-y-3 pb-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-[#e3e8f2] bg-white p-4 shadow-[0_2px_8px_rgb(15_23_42/0.03)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-blue-50 p-2 text-blue-600"><UsersRound className="h-5 w-5" /></span>
          <div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-blue-600">CRM</p><h1 className="text-xl font-extrabold text-[var(--g66-text-primary)]">Cuentas</h1><p className="text-xs text-[var(--g66-text-muted)]">Directorio de cuentas disponibles para consulta 360.</p></div>
        </div>
        <div className="flex h-8 w-full max-w-xs items-center gap-2 rounded-lg border border-[var(--g66-border)] bg-slate-50 px-3 text-xs text-[var(--g66-text-muted)]"><Search className="h-3.5 w-3.5" /> Buscar cuentas…</div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e3e8f2] bg-white shadow-[0_2px_8px_rgb(15_23_42/0.03)]">
        <div className="grid grid-cols-[minmax(0,1.4fr)_0.8fr_0.8fr_auto] gap-3 border-b border-[var(--g66-border)] bg-slate-50 px-4 py-2 text-[9px] font-bold uppercase tracking-wide text-[var(--g66-text-muted)]"><span>Cuenta</span><span>Tipo</span><span>Estado KYC</span><span /></div>
        {account ? (
          <Link href={`/cuentas/${account.account_id}`} className="grid grid-cols-[minmax(0,1.4fr)_0.8fr_0.8fr_auto] items-center gap-3 px-4 py-3 hover:bg-blue-50/40">
            <div className="min-w-0"><p className="truncate text-sm font-extrabold text-[var(--g66-text-primary)]">{account.profile.full_name || "Cuenta sin nombre"}</p><p className="mt-0.5 truncate text-[10px] text-[var(--g66-text-muted)]">{account.account_id} · {account.profile.email || "Email no disponible"}</p></div>
            <span className="text-xs font-semibold text-[var(--g66-text-secondary)]">{account.profile.customer_type || "—"}</span>
            <span className="w-fit rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">{account.profile.kyc_status || "—"}</span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-[var(--g66-text-muted)]">{loadError ? "No fue posible cargar las cuentas en este momento." : "No hay cuentas disponibles."}</p>
        )}
      </section>
    </div>
  );
}
