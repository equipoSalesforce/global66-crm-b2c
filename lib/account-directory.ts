import type { Account360 } from "@/lib/account-360-api";
import { getCustomerAccount360 } from "@/lib/customer-profile-service";
import { supabase } from "@/lib/supabase";

export type AccountDirectoryEntry = {
  publicId: string;
  fullName: string;
  email: string;
  accountType: string;
  kycStatus: string;
  segment: string;
};

type CustomerDirectoryIdentity = {
  id: string;
  public_id: string;
  customer_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

function toDirectoryEntry(
  account: Account360,
  publicId: string,
): AccountDirectoryEntry {
  return {
    publicId,
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
    const { data, error } = await supabase
      .from("customers")
      .select("id, public_id, customer_id, name, email, phone")
      .not("customer_id", "is", null)
      .limit(20)
      .returns<CustomerDirectoryIdentity[]>();

    if (error) return [];

    const entries = await Promise.all(
      (data ?? []).map(async (identity) => {
        if (!identity.customer_id) return null;
        try {
          const account = await getCustomerAccount360(identity);
          return toDirectoryEntry(account, identity.public_id);
        } catch {
          return null;
        }
      }),
    );

    return entries.filter((entry): entry is AccountDirectoryEntry => entry !== null);
  } catch {
    return [];
  }
}
