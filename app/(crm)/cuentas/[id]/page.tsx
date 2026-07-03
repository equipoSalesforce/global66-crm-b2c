import { Account360Header } from "@/components/account-360/account-360-header";
import { AccountActivityTimeline } from "@/components/account-360/account-activity-timeline";
import { AccountKycHistory } from "@/components/account-360/account-kyc-history";
import { AccountProducts } from "@/components/account-360/account-products";
import { AccountSidePanel } from "@/components/account-360/account-side-panel";
import { AccountSummaryMetrics } from "@/components/account-360/account-summary-metrics";
import { AccountWallets } from "@/components/account-360/account-wallets";
import { Account360ApiError, getAccount360 } from "@/lib/account-360-api";
import { BriefcaseBusiness, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Account360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let account;

  try {
    account = await getAccount360(id);
  } catch (error) {
    if (error instanceof Account360ApiError && error.status === 404) notFound();

    return (
      <section className="rounded-2xl border border-[var(--g66-danger-soft)] bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--g66-danger)]">
          Account 360 no disponible
        </p>
        <h1 className="mt-3 text-2xl font-bold text-[var(--g66-text-primary)]">
          No pudimos cargar esta cuenta
        </h1>
        <p className="mt-2 text-sm text-[var(--g66-text-secondary)]">
          Verifica que FastAPI esté ejecutándose e inténtalo nuevamente.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      <nav aria-label="Breadcrumb" className="flex h-6 items-center gap-1.5 px-1 text-xs font-semibold text-[var(--g66-text-muted)]">
        <BriefcaseBusiness className="h-3.5 w-3.5" />
        <span>Cuentas</span>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate font-bold text-[var(--g66-text-primary)]">{account.profile.full_name || account.account_id}</span>
      </nav>
      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(270px,1fr)]">
        <main className="min-w-0 space-y-3">
          <Account360Header account={account} />
          <AccountSummaryMetrics metrics={account.metrics} />
          <AccountWallets
            wallets={account.wallets}
            accountId={account.account_id}
            movements={account.activity}
          />
          <AccountProducts accountId={account.account_id} products={account.products} />
          <AccountKycHistory items={account.kyc_history} />
          <AccountActivityTimeline items={account.activity} />
        </main>
        <AccountSidePanel account={account} />
      </div>
    </div>
  );
}
