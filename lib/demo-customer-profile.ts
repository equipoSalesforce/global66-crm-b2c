import "server-only";

import type { Account360 } from "@/lib/account-360-api";

export type DemoCustomerIdentity = {
  id: string;
  customer_id: string | null;
  public_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type DemoOperationalCustomerProfile = {
  publicId: string | null;
  customerId: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  customerType: string;
  segment: string;
  country: string;
  geolocation: string;
  complianceStatus: string;
  plan: string;
  accountManager: string;
  documentNumber: string;
};

const countries = [
  { name: "Chile", code: "CL", city: "Santiago", nationality: "Chilena", currency: "CLP" },
  { name: "Perú", code: "PE", city: "Lima", nationality: "Peruana", currency: "PEN" },
  { name: "Colombia", code: "CO", city: "Bogotá", nationality: "Colombiana", currency: "COP" },
  { name: "Argentina", code: "AR", city: "Buenos Aires", nationality: "Argentina", currency: "ARS" },
  { name: "México", code: "MX", city: "Ciudad de México", nationality: "Mexicana", currency: "MXN" },
] as const;
const segments = ["Masivo", "High", "Ultra High", "Premium", "Empresas"] as const;
const customerTypes = ["B2C", "B2C", "B2X", "B2B"] as const;
const complianceStatuses = ["NORMAL", "NORMAL", "NORMAL", "REVIEW", "BLOCKED"] as const;
const plans = ["None", "Start", "Pro", "Ultra"] as const;
const accountManagers = ["Agente Demo", "Katherine Demo", "Equipo CX", "Equipo Compliance"] as const;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seedFor(customer: DemoCustomerIdentity) {
  return customer.id || customer.email || customer.customer_id || customer.public_id || "demo-customer";
}

function pick<T>(values: readonly T[], seed: number, offset: number) {
  return values[(seed + offset * 7919) % values.length];
}

function nonEmpty(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function deterministicDate(seed: number, offsetDays = 0) {
  const anchor = Date.UTC(2026, 6, 1, 12, 0, 0);
  return new Date(anchor - ((seed % 240) + offsetDays) * 86_400_000).toISOString();
}

export function isDemoCustomer(customer: DemoCustomerIdentity) {
  const email = customer.email?.trim().toLowerCase() || "";
  const customerId = customer.customer_id?.trim().toUpperCase() || "";
  const name = customer.name?.trim().toLowerCase() || "";
  const publicId = customer.public_id?.trim().toLowerCase() || "";
  const explicitDemoIdentity =
    email.includes(".demo@") ||
    email.endsWith("@global66.test") ||
    email.endsWith("@example.com") ||
    customerId.startsWith("DEMO") ||
    name.includes("demo");
  const demoEnvironment =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return explicitDemoIdentity || (demoEnvironment && publicId.startsWith("cus_"));
}

export function buildDemoCustomerProfile(
  customer: DemoCustomerIdentity,
): DemoOperationalCustomerProfile {
  const seed = stableHash(seedFor(customer));
  const country = pick(countries, seed, 1);

  return {
    publicId: customer.public_id,
    customerId: customer.customer_id,
    fullName: customer.name || "Cliente Demo",
    email: customer.email,
    phone: customer.phone,
    customerType: pick(customerTypes, seed, 2),
    segment: pick(segments, seed, 3),
    country: country.name,
    geolocation: `${country.city}, ${country.name}`,
    complianceStatus: pick(complianceStatuses, seed, 4),
    plan: pick(plans, seed, 5),
    accountManager: pick(accountManagers, seed, 6),
    documentNumber: `DEMO-${country.code}-${String(seed % 100_000_000).padStart(8, "0")}`,
  };
}

export function buildDemoAccount360(customer: DemoCustomerIdentity): Account360 {
  const seed = stableHash(seedFor(customer));
  const demo = buildDemoCustomerProfile(customer);
  const country = countries.find((item) => item.name === demo.country) ?? countries[0];
  const accountId = customer.customer_id || `DEMO-${seed}`;
  const balance = 120 + (seed % 4_800);
  const historicalVolume = 8_000 + (seed % 92_000);
  const lastActivityAt = deterministicDate(seed, 2);
  const transactionId = `demo-tx-${seed.toString(16)}`;

  return {
    account_id: accountId,
    data_source: "CRM_DEMO_PROFILE",
    account_manager: demo.accountManager,
    profile: {
      account_id: accountId,
      full_name: demo.fullName || "Cliente Demo",
      email: demo.email,
      phone: demo.phone,
      country: demo.country,
      customer_type: demo.customerType,
      account_type: demo.customerType === "B2B" ? "Empresa" : "Persona",
      segment: demo.segment,
      username: `DEMO_${seed.toString(16).slice(0, 8).toUpperCase()}`,
      document: demo.documentNumber,
      document_type: country.code === "CL" ? "RUT" : "Documento",
      document_number: demo.documentNumber,
      nationality: country.nationality,
      kyc_stage_1: "APPROVED",
      kyc_stage_2: demo.complianceStatus === "BLOCKED" ? "REVIEW" : "APPROVED",
      kyc_stage_3: demo.complianceStatus === "NORMAL" ? "APPROVED" : "PENDING",
      compliance_status: demo.complianceStatus,
      account_manager: demo.accountManager,
      plan: demo.plan,
      status: demo.complianceStatus === "BLOCKED" ? "RESTRICTED" : "ACTIVE",
      kyc_status: demo.complianceStatus === "NORMAL" ? "APPROVED" : "REVIEW",
      created_at: deterministicDate(seed, 420),
      last_activity_at: lastActivityAt,
      days_without_activity: 2 + (seed % 24),
    },
    badges: [
      { code: "kyc", label: "KYC", value: demo.complianceStatus === "NORMAL" ? "Aprobado" : "En revisión", tone: demo.complianceStatus === "NORMAL" ? "success" : "warning" },
      { code: "plan", label: "Plan", value: demo.plan, tone: "info" },
      { code: "inactivity", label: "Días sin operar", value: String(2 + (seed % 24)), tone: "neutral" },
    ],
    metrics: {
      total_balance_usd: balance,
      historical_volume_usd: historicalVolume,
      interactions_count: 8 + (seed % 42),
      attachments_count: seed % 7,
      transactions_count: 12 + (seed % 130),
    },
    wallets: [
      {
        currency: "USD",
        balance,
        available_balance: balance,
        balance_usd: balance,
        status: "ACTIVE",
        updated_at: lastActivityAt,
        account_number: `****${String(seed % 10_000).padStart(4, "0")}`,
        account_id: accountId,
        branch: "Global66 Demo",
      },
      {
        currency: country.currency,
        balance: Math.round(balance * 850),
        available_balance: Math.round(balance * 850),
        balance_usd: balance,
        status: "ACTIVE",
        updated_at: lastActivityAt,
        account_number: `****${String((seed + 73) % 10_000).padStart(4, "0")}`,
        account_id: accountId,
        branch: country.city,
      },
    ],
    products: [
      {
        code: "GLOBAL_ACCOUNT",
        label: "Cuenta Global",
        family: "ACCOUNT",
        movement_count: 5 + (seed % 20),
        volume_usd: historicalVolume * 0.45,
        last_transaction_at: lastActivityAt,
        last_activity_at: lastActivityAt,
        transactions: [{
          transaction_id: transactionId,
          product: "Cuenta Global",
          product_family: "ACCOUNT",
          transaction_datetime: lastActivityAt,
          customer_id: accountId,
          origin_amount: 250,
          origin_amount_usd: 250,
          destination_amount: 250,
          destination_amount_usd: 250,
          origin_currency: "USD",
          destiny_currency: "USD",
        }],
      },
      {
        code: "TRANSFERS",
        label: "Transferencias",
        family: "TRANSFER",
        movement_count: 3 + (seed % 16),
        volume_usd: historicalVolume * 0.55,
        last_transaction_at: deterministicDate(seed, 8),
        last_activity_at: deterministicDate(seed, 8),
        transactions: [],
      },
    ],
    kyc_history: [
      { event_id: `demo-kyc-${seed}-1`, status: "APPROVED", description: "Identidad validada correctamente.", occurred_at: deterministicDate(seed, 390), source: "CRM_DEMO" },
      { event_id: `demo-kyc-${seed}-2`, status: "APPROVED", description: "Perfil operacional habilitado.", occurred_at: deterministicDate(seed, 380), source: "CRM_DEMO" },
    ],
    activity: [
      { activity_id: `demo-activity-${seed}-1`, activity_type: "TRANSACTION", title: "Transferencia demo completada", description: "Operación procesada correctamente.", occurred_at: lastActivityAt, channel: "APP", status: "COMPLETED", amount: 250, currency: "USD", product_code: "TRANSFERS", activity_category: "transaction" },
      { activity_id: `demo-activity-${seed}-2`, activity_type: "WHATSAPP", title: "Consulta atendida", description: "Interacción de soporte asociada a la cuenta.", occurred_at: deterministicDate(seed, 5), channel: "WHATSAPP", status: "CLOSED", activity_category: "whatsapp_ai" },
    ],
    compliance: {
      risk_level: demo.complianceStatus === "NORMAL" ? "LOW" : "MEDIUM",
      pep_status: "CLEAR",
      sanctions_status: "CLEAR",
      review_status: demo.complianceStatus,
      last_review_at: deterministicDate(seed, 40),
      next_review_at: deterministicDate(seed, -120),
      notes: ["Perfil generado para validación funcional en entorno demo."],
    },
    banking: {
      bank_name: "Global66 Demo",
      account_type: "DIGITAL",
      account_number_masked: `****${String(seed % 10_000).padStart(4, "0")}`,
      country: demo.country,
      currency: country.currency,
      status: "ACTIVE",
    },
    benefits: {
      cashback_balance_usd: Number(((seed % 1_500) / 100).toFixed(2)),
      accrued_interest_usd: Number(((seed % 700) / 100).toFixed(2)),
      benefits_tier: demo.plan,
      updated_at: lastActivityAt,
    },
    device: {
      platform: seed % 2 === 0 ? "iOS" : "Android",
      app_version: `6.${seed % 10}.${seed % 5}`,
      device_model: seed % 2 === 0 ? "iPhone Demo" : "Android Demo",
      last_login_at: lastActivityAt,
      last_ip_country: demo.country,
      security_status: "TRUSTED",
    },
    terms: [
      { terms_code: "general_terms", terms_name: "Términos y condiciones generales", version: "3.1", status: "ACCEPTED", accepted_at: deterministicDate(seed, 360) },
      { terms_code: "privacy_policy", terms_name: "Política de privacidad", version: "2.4", status: "ACCEPTED", accepted_at: deterministicDate(seed, 360) },
      { terms_code: "global_card_terms", terms_name: "Contrato tarjeta Global", version: "1.8", status: "ACCEPTED", accepted_at: deterministicDate(seed, 180) },
      { terms_code: "data_processing_consent", terms_name: "Consentimiento tratamiento de datos", version: "2.0", status: "ACCEPTED", accepted_at: deterministicDate(seed, 360) },
    ],
  };
}

function fillMissing<T extends object>(actual: T, fallback: T): T {
  const result = { ...fallback } as Record<string, unknown>;
  Object.entries(actual).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") result[key] = value;
  });
  return result as T;
}

export function completeDemoAccount360(
  account: Account360,
  customer: DemoCustomerIdentity,
): Account360 {
  const fallback = buildDemoAccount360(customer);
  const accountManager =
    typeof account.account_manager === "string"
      ? nonEmpty(account.account_manager) ? account.account_manager : fallback.account_manager
      : account.account_manager?.name
        ? account.account_manager
        : fallback.account_manager;

  return {
    ...fallback,
    ...account,
    account_id: nonEmpty(account.account_id) ? account.account_id : fallback.account_id,
    data_source: nonEmpty(account.data_source) ? account.data_source : fallback.data_source,
    account_manager: accountManager,
    profile: fillMissing(account.profile ?? fallback.profile, fallback.profile),
    badges: account.badges?.length ? account.badges : fallback.badges,
    metrics: fillMissing(account.metrics ?? fallback.metrics, fallback.metrics),
    wallets: account.wallets?.length ? account.wallets : fallback.wallets,
    products: account.products?.length ? account.products : fallback.products,
    kyc_history: account.kyc_history?.length ? account.kyc_history : fallback.kyc_history,
    activity: account.activity?.length ? account.activity : fallback.activity,
    compliance: {
      ...fillMissing(account.compliance ?? fallback.compliance, fallback.compliance),
      notes: account.compliance?.notes?.length ? account.compliance.notes : fallback.compliance.notes,
    },
    banking: fillMissing(account.banking ?? fallback.banking, fallback.banking),
    benefits: fillMissing(account.benefits ?? fallback.benefits, fallback.benefits),
    device: fillMissing(account.device ?? fallback.device, fallback.device),
    terms: account.terms?.length ? account.terms : fallback.terms,
  };
}
