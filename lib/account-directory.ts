import { getAccount360, type Account360 } from "@/lib/account-360-api";

export type AccountDirectoryEntry = {
  accountId: string;
  fullName: string;
  email: string;
  accountType: string;
  kycStatus: string;
  segment: string;
};

const DEMO_ACCOUNT: AccountDirectoryEntry = {
  accountId: "DEMO-CUSTOMER-001",
  fullName: "Cliente Demo Global66",
  email: "cliente.demo@global66.com",
  accountType: "Person Account",
  kycStatus: "Aprobado",
  segment: "Premium",
};

function toDirectoryEntry(account: Account360): AccountDirectoryEntry {
  return {
    accountId: account.account_id,
    fullName: account.profile.full_name || "Cuenta sin nombre",
    email: account.profile.email || "Email no disponible",
    accountType:
      account.profile.account_type || account.profile.customer_type || "—",
    kycStatus: account.profile.kyc_status || "—",
    segment: account.profile.segment || "—",
  };
}

export async function getAccountDirectory(): Promise<AccountDirectoryEntry[]> {
  try {
    const account = await getAccount360(DEMO_ACCOUNT.accountId);
    return [toDirectoryEntry(account)];
  } catch {
    return [DEMO_ACCOUNT];
  }
}
