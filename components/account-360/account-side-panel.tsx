import type { Account360 } from "@/lib/account-360-api";
import {
  BadgeDollarSign,
  Building2,
  FileCheck2,
  IdCard,
  Landmark,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { displayValue, formatDate, formatMoney } from "./account-360-format";

function Panel({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: LucideIcon;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#e3e8f2] bg-white p-3 shadow-[0_2px_8px_rgb(15_23_42/0.03)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-blue-50 p-1.5 text-blue-600"><Icon className="h-3.5 w-3.5" /></span>
          <h2 className="text-xs font-extrabold text-[var(--g66-text-primary)]">{title}</h2>
        </div>
        {badge ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-700">{badge}</span> : null}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <dt className="text-[9px] font-semibold text-[var(--g66-text-muted)]">{label}</dt>
      <dd className="text-right text-[10px] font-bold text-[var(--g66-text-secondary)]">{value}</dd>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <dt className="text-[8px] font-bold uppercase tracking-[0.06em] text-[var(--g66-text-muted)]">{label}</dt>
      <dd className="truncate text-right text-[10px] font-bold text-[var(--g66-text-secondary)]">{value}</dd>
    </div>
  );
}

function KycRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-semibold text-[var(--g66-text-secondary)]">
        <span className={`h-2 w-2 shrink-0 rounded-full ${muted ? "bg-slate-300" : "bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129/0.1)]"}`} />
        {label}
      </span>
      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${muted ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>{value}</span>
    </div>
  );
}

function approvedLabel(value?: string | null) {
  if (!value) return "—";
  return ["APPROVED", "VERIFIED"].includes(value.toUpperCase()) ? "Aprobado" : displayValue(value);
}

export function AccountSidePanel({ account }: { account: Account360 }) {
  const { profile, compliance, banking, benefits, device } = account;
  const termDefinitions = [
    { code: "general_terms", label: "Términos y condiciones generales" },
    { code: "privacy_policy", label: "Política de privacidad" },
    { code: "global_card_terms", label: "Contrato tarjeta Global" },
    { code: "data_processing_consent", label: "Consentimiento tratamiento de datos" },
  ];

  return (
    <aside className="space-y-2.5 xl:sticky xl:top-14">
      <Panel icon={IdCard} title="Detalle de cuenta (KYC)">
        <dl className="grid gap-1.5">
          <DetailField label="Tipo de cliente" value={displayValue(profile.customer_type)} />
          <DetailField label="ID interno" value={displayValue(account.account_id)} />
          <DetailField label="Segmentación" value={displayValue(profile.segment)} />
          <DetailField label="Plan" value={displayValue(profile.plan)} />
          <DetailField label="País" value={displayValue(profile.country)} />
          <DetailField label="Nacionalidad" value={displayValue(profile.nationality)} />
        </dl>
        <button type="button" className="mt-2 text-[9px] font-bold text-[var(--g66-brand-blue)] hover:underline">Ver todos los campos</button>
      </Panel>

      <Panel icon={ShieldCheck} title="KYC & Compliance" badge={profile.compliance_status ? approvedLabel(profile.compliance_status) : undefined}>
        <div className="space-y-0.5">
          <KycRow label="KYC Fase I" value={approvedLabel(profile.kyc_stage_1)} muted={!profile.kyc_stage_1} />
          <KycRow label="KYC Onboarding" value={approvedLabel(profile.kyc_status)} muted={!profile.kyc_status} />
          <KycRow label="KYC Fase II" value={approvedLabel(profile.kyc_stage_2)} muted={!profile.kyc_stage_2} />
          <KycRow label="KYC Fase III" value={approvedLabel(profile.kyc_stage_3)} muted={!profile.kyc_stage_3} />
          <div className="my-1.5 border-t border-[var(--g66-border-soft)]" />
          <Row label="Multijurisdicción" value={profile.country ? "1 jurisdicción" : "—"} />
          <Row label="Chile · principal" value={profile.country === "CL" ? approvedLabel(compliance.review_status) : "—"} />
          <Row label="Perú · secundaria" value="—" />
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--g66-border-soft)] pt-1.5">
            <div><p className="text-[8px] font-bold uppercase text-[var(--g66-text-muted)]">DNI 2ª JURISDICCIÓN</p><p className="mt-0.5 text-[9px] font-bold text-[var(--g66-text-secondary)]">—</p></div>
            <div><p className="text-[8px] font-bold uppercase text-[var(--g66-text-muted)]">VALIDACIÓN KYC</p><p className="mt-0.5 text-[9px] font-bold text-[var(--g66-text-secondary)]">{formatDate(compliance.last_review_at)}</p></div>
          </div>
        </div>
      </Panel>

      <details className="group rounded-xl border border-[#e3e8f2] bg-white p-3 shadow-[0_2px_8px_rgb(15_23_42/0.03)]">
        <summary className="flex cursor-pointer list-none items-center justify-between"><span className="flex items-center gap-2"><span className="rounded-md bg-cyan-50 p-1.5 text-cyan-600"><Building2 className="h-3.5 w-3.5" /></span><span className="text-xs font-extrabold text-[var(--g66-text-primary)]">Datos bancarios</span></span><span className="text-[10px] text-[var(--g66-text-muted)] group-open:rotate-180">⌄</span></summary>
        <dl className="mt-2 border-t border-[var(--g66-border-soft)] pt-1.5"><Row label="Estado" value={displayValue(banking.status)} /><Row label="Cuenta" value={displayValue(banking.account_number_masked)} /><Row label="Moneda" value={displayValue(banking.currency)} /></dl>
      </details>

      <Panel icon={Landmark} title="GMF acumulado">
        <div className="flex justify-end"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-bold text-slate-600">Origen: Chile</span></div>
        <div className="mt-2 rounded-lg bg-slate-50 p-2.5"><p className="text-[10px] font-bold text-[var(--g66-text-secondary)]">No aplica</p><p className="mt-1 text-[9px] leading-4 text-[var(--g66-text-muted)]">El GMF solo aplica a clientes de Colombia.</p></div>
      </Panel>

      <Panel icon={BadgeDollarSign} title="Intereses y cashback">
        <dl><Row label="Intereses acumulados" value={formatMoney(benefits.accrued_interest_usd)} /><Row label="Cashback acumulado" value={formatMoney(benefits.cashback_balance_usd)} /><div className="mt-1 border-t border-[var(--g66-border-soft)] pt-1"><Row label="Total beneficios" value={formatMoney(benefits.accrued_interest_usd + benefits.cashback_balance_usd)} /></div></dl>
      </Panel>

      <Panel icon={Smartphone} title="Dispositivo y app">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2"><div><dt className="text-[8px] font-bold uppercase text-[var(--g66-text-muted)]">VERSIÓN APP</dt><dd className="text-[9px] font-bold text-[var(--g66-text-secondary)]">{displayValue(device.app_version)}</dd></div><div><dt className="text-[8px] font-bold uppercase text-[var(--g66-text-muted)]">ÚLTIMA ACTUALIZACIÓN</dt><dd className="text-[9px] font-bold text-[var(--g66-text-secondary)]">{formatDate(device.last_login_at)}</dd></div><div><dt className="text-[8px] font-bold uppercase text-[var(--g66-text-muted)]">DISPOSITIVO</dt><dd className="text-[9px] font-bold text-[var(--g66-text-secondary)]">{displayValue(device.device_model)}</dd></div><div><dt className="text-[8px] font-bold uppercase text-[var(--g66-text-muted)]">SISTEMA OPERATIVO</dt><dd className="text-[9px] font-bold text-[var(--g66-text-secondary)]">{displayValue(device.platform)}</dd></div></dl>
      </Panel>

      <Panel icon={FileCheck2} title="Términos y condiciones">
        <ul className="space-y-1.5">{termDefinitions.map((definition) => { const term = account.terms.find((item) => item.terms_code === definition.code); return <li key={definition.code} className="rounded-lg border border-[var(--g66-border-soft)] p-2"><div className="flex items-start gap-2"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-50 text-[9px] font-bold text-emerald-600">✓</span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold leading-3 text-[var(--g66-text-primary)]">{definition.label}</p><div className="mt-0.5 flex justify-between gap-2 text-[8px] text-[var(--g66-text-muted)]"><span>v{term?.version || "—"}</span><span>{formatDate(term?.accepted_at)}</span></div></div></div></li>; })}</ul>
      </Panel>
    </aside>
  );
}
