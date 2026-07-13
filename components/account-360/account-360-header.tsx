import type { Account360, AccountBadge } from "@/lib/account-360-api";
import {
  BadgeCheck,
  Clock3,
  Hash,
  IdCard,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { displayValue, initials } from "./account-360-format";

const badgeStyles: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  info: "bg-blue-50 text-blue-700 ring-blue-100",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
};

function Badge({ badge }: { badge: AccountBadge }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${badgeStyles[badge.tone] || badgeStyles.neutral}`}
    >
      {badge.code === "inactivity" ? <Clock3 className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
      {badge.label}: {displayValue(badge.value)}
    </span>
  );
}

function ProfileDatum({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.8} />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Account360Header({ account }: { account: Account360 }) {
  const { profile } = account;
  const latestProduct = [...account.products]
    .filter((product) => product.last_transaction_at)
    .sort(
      (left, right) =>
        new Date(right.last_transaction_at || 0).getTime() -
        new Date(left.last_transaction_at || 0).getTime(),
    )[0];
  const badges = account.badges.filter((badge) => badge.code !== "inactivity");
  const inactivity = account.badges.find((badge) => badge.code === "inactivity");
  const whatsappPhone = profile.phone?.replace(/\D/g, "");
  const documentLabel = profile.document_number
    ? `${profile.document_type || "Documento"} ${profile.document_number}`
    : `${profile.document_type || "Documento"} —`;
  const accountManager =
    typeof account.account_manager === "string"
      ? account.account_manager
      : account.account_manager?.name || profile.account_manager;

  return (
    <header className="overflow-hidden rounded-2xl border border-[#e3e8f2] bg-white shadow-[0_2px_8px_rgb(15_23_42/0.035)]">
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--g66-brand-blue)] text-sm font-extrabold text-white shadow-md shadow-blue-100">
            {initials(profile.full_name).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-extrabold tracking-tight text-[var(--g66-text-primary)] sm:text-xl">
                {displayValue(profile.full_name, "Cuenta sin nombre")}
              </h1>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700">
                {displayValue(profile.segment || profile.plan)}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                {displayValue(profile.account_type || profile.customer_type)}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-medium text-[var(--g66-text-secondary)]">
              <ProfileDatum icon={Mail}>{displayValue(profile.email, "Email no disponible")}</ProfileDatum>
              <ProfileDatum icon={Hash}>{displayValue(profile.account_id, "ID no disponible")}</ProfileDatum>
              <ProfileDatum icon={IdCard}>{profile.country ? `${profile.country} · ${documentLabel}` : documentLabel}</ProfileDatum>
              <ProfileDatum icon={Phone}>{displayValue(profile.phone, "Teléfono no disponible")}</ProfileDatum>
              {profile.username ? <ProfileDatum icon={UserRound}>{profile.username}</ProfileDatum> : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <div className="flex flex-wrap gap-2">
            {whatsappPhone ? (
            <a
              href={`https://wa.me/${whatsappPhone}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            ) : (
            <span className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-400">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </span>
            )}
            <Link
            href={`/casos/nuevo?customerId=${encodeURIComponent(account.account_id)}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--g66-brand-blue)] px-3 text-xs font-bold text-white shadow-sm hover:bg-[var(--g66-brand-blue-hover)]"
          >
            <Plus className="h-4 w-4" /> Nuevo caso
            </Link>
            <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--g66-border)] bg-white px-3 text-xs font-bold text-[var(--g66-text-secondary)] hover:bg-slate-50">
              <ShieldCheck className="h-4 w-4" /> Compliance
            </button>
          </div>
          <div className="text-left lg:text-right">
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--g66-text-muted)]">Account Manager</p>
            <p className="mt-0.5 text-[10px] font-bold text-[var(--g66-brand-blue)]">{displayValue(accountManager, "Sin asignar")}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--g66-border-soft)] bg-[#fbfcfe] px-4 py-2">
        {badges.map((badge) => <Badge key={badge.code} badge={badge} />)}
        <Badge
          badge={{
            code: "last_product",
            label: "Último producto",
            value: latestProduct?.label || "—",
            tone: "neutral",
          }}
        />
        {inactivity ? <Badge badge={inactivity} /> : null}
      </div>
    </header>
  );
}
