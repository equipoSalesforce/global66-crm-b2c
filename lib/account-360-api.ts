export type AccountProfile = {
  account_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  customer_type: string;
  account_type?: string | null;
  segment?: string | null;
  username?: string | null;
  document_number?: string | null;
  nationality?: string | null;
  kyc_stage_1?: string | null;
  kyc_stage_2?: string | null;
  kyc_stage_3?: string | null;
  compliance_status?: string | null;
  account_manager?: string | null;
  plan: string;
  status: string;
  kyc_status: string;
  created_at?: string | null;
  last_activity_at?: string | null;
  days_without_activity?: number | null;
};

export type AccountBadge = {
  code: string;
  label: string;
  value: string;
  tone: string;
};

export type AccountSummaryMetricsData = {
  total_balance_usd: number;
  historical_volume_usd: number;
  interactions_count: number;
  attachments_count: number;
  transactions_count?: number | null;
};

export type AccountWallet = {
  currency: string;
  balance: number;
  available_balance: number;
  balance_usd: number;
  status: string;
  updated_at?: string | null;
  account_number?: string | null;
  account_id?: string | null;
  branch?: string | null;
};

export type AccountProductSummary = {
  product_code: string;
  product_name: string;
  summary: string;
  volume_usd: number;
  active_count?: number | null;
  last_activity_at?: string | null;
  status: string;
  detail_available: boolean;
};

export type AccountActivityItem = {
  activity_id: string;
  activity_type: string;
  title: string;
  description?: string | null;
  occurred_at: string;
  channel?: string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  product_code?: string | null;
};

export type Account360 = {
  account_id: string;
  data_source: string;
  account_manager?: string | { name?: string | null } | null;
  profile: AccountProfile;
  badges: AccountBadge[];
  metrics: AccountSummaryMetricsData;
  wallets: AccountWallet[];
  products: AccountProductSummary[];
  kyc_history: Array<{
    event_id: string;
    status: string;
    description: string;
    occurred_at: string;
    source: string;
  }>;
  activity: AccountActivityItem[];
  compliance: {
    risk_level: string;
    pep_status: string;
    sanctions_status: string;
    review_status: string;
    last_review_at?: string | null;
    next_review_at?: string | null;
    notes: string[];
  };
  banking: {
    bank_name?: string | null;
    account_type?: string | null;
    account_number_masked?: string | null;
    country?: string | null;
    currency?: string | null;
    status: string;
  };
  benefits: {
    cashback_balance_usd: number;
    accrued_interest_usd: number;
    benefits_tier: string;
    updated_at?: string | null;
  };
  device: {
    platform?: string | null;
    app_version?: string | null;
    device_model?: string | null;
    last_login_at?: string | null;
    last_ip_country?: string | null;
    security_status: string;
  };
  terms: Array<{
    terms_code: string;
    terms_name: string;
    version: string;
    status: string;
    accepted_at?: string | null;
  }>;
};

export type AccountProductDetail = {
  account_id: string;
  product_code: string;
  product_name: string;
  status: string;
  summary: string;
  details: Record<string, unknown>;
  recent_activity: AccountActivityItem[];
  data_source: string;
};

export class Account360ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function fastApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_FASTAPI_BASE_URL || "http://localhost:8000").replace(
    /\/$/,
    "",
  );
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Account360ApiError("No se pudo cargar Account 360.", response.status);
  }
  return (await response.json()) as T;
}

export function getAccount360(accountId: string) {
  return requestJson<Account360>(
    `${fastApiBaseUrl()}/accounts/${encodeURIComponent(accountId)}/360`,
  );
}

export function getAccountProductDetail(accountId: string, productCode: string) {
  const path = `${encodeURIComponent(accountId)}/products/${encodeURIComponent(productCode)}`;
  const url =
    typeof window === "undefined"
      ? `${fastApiBaseUrl()}/accounts/${path}`
      : `/api/account-360/${path}`;
  return requestJson<AccountProductDetail>(url);
}
