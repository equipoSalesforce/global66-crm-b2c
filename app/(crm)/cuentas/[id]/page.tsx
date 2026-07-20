import { Account360Header } from "@/components/account-360/account-360-header";
import { AccountActivityTimeline } from "@/components/account-360/account-activity-timeline";
import { AccountKycHistory } from "@/components/account-360/account-kyc-history";
import { AccountProducts } from "@/components/account-360/account-products";
import { AccountSidePanel } from "@/components/account-360/account-side-panel";
import { AccountSummaryMetrics } from "@/components/account-360/account-summary-metrics";
import { AccountWallets } from "@/components/account-360/account-wallets";
import {
  Account360ApiError,
  getAccount360,
  type Account360View,
} from "@/lib/account-360-api";
import {
  CustomerAccountActivityError,
  getCustomerCrmActivity,
} from "@/lib/customer-account-activity-service";
import {
  CustomerIdentityError,
  resolveCustomerIdentityByPublicId,
} from "@/lib/customer-identity-service";
import { BriefcaseBusiness, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function buildAccount360View(
  account: Awaited<ReturnType<typeof getAccount360>>,
  publicId: string,
  customerId: string,
  crmActivity: Awaited<ReturnType<typeof getCustomerCrmActivity>>,
): Account360View {
  const transactionalActivity = account.activity.map((item) => ({
    ...item,
    activity_category: item.activity_category || inferActivityCategory(item),
  }));

  return {
    ...account,
    publicId,
    customerId,
    displayCustomerId: customerId,
    activity: [...crmActivity, ...transactionalActivity].sort(
      (left, right) =>
        new Date(right.occurred_at).getTime() -
        new Date(left.occurred_at).getTime(),
    ),
  };
}

function inferActivityCategory(
  item: Awaited<ReturnType<typeof getAccount360>>["activity"][number],
) {
  const value = `${item.activity_type} ${item.channel} ${item.title}`.toUpperCase();
  if (/TRANSACTION|EXCHANGE|PAYMENT|CARD|P2P|REM/.test(value)) {
    return "transaction" as const;
  }
  if (/EMAIL|MAIL/.test(value)) return "email" as const;
  if (/WHATSAPP|AI|IA/.test(value)) return "whatsapp_ai" as const;
  if (/CALL|PHONE|LLAMADA/.test(value)) return "call" as const;
  if (/CASE|CASO|SUPPORT/.test(value)) return "case" as const;
  return "other" as const;
}

export default async function Account360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let account;

  try {
    const identity = await resolveCustomerIdentityByPublicId(id);
    if (!identity) notFound();

    const [internalAccount, crmActivity] = await Promise.all([
      getAccount360(identity.customerId),
      getCustomerCrmActivity(identity.id),
    ]);
    account = buildAccount360View(
      internalAccount,
      identity.publicId,
      identity.customerId,
      crmActivity,
    );
  } catch (error) {
    if (error instanceof Account360ApiError && error.status === 404) notFound();

    const unavailableMessage =
      error instanceof CustomerIdentityError ||
      error instanceof CustomerAccountActivityError
        ? "No pudimos resolver la identidad interna de esta cuenta."
        : "Verifica que FastAPI esté ejecutándose e inténtalo nuevamente.";

    return (
      <section className="rounded-2xl border border-[var(--g66-danger-soft)] bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--g66-danger)]">
          Account 360 no disponible
        </p>
        <h1 className="mt-3 text-2xl font-bold text-[var(--g66-text-primary)]">
          No pudimos cargar esta cuenta
        </h1>
        <p className="mt-2 text-sm text-[var(--g66-text-secondary)]">
          {unavailableMessage}
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
            accountId={account.customerId}
            movements={account.activity}
          />
          <AccountProducts products={account.products} />
          <AccountKycHistory items={account.kyc_history} />
          <AccountActivityTimeline items={account.activity} />
        </main>
        <AccountSidePanel account={account} />
      </div>
    </div>
  );
}
