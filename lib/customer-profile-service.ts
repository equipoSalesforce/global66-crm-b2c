import "server-only";

import { getAccount360 } from "@/lib/account-360-api";
import {
  buildDemoAccount360,
  buildDemoCustomerProfile,
  completeDemoAccount360,
  isDemoCustomer,
} from "@/lib/demo-customer-profile";

export type CaseCustomerIdentity = {
  id: string;
  customer_id: string | null;
  public_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type CustomerOperationalProfile = {
  publicId: string | null;
  customerId: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  customerType: string | null;
  segment: string | null;
  country: string | null;
  geolocation: string | null;
  complianceStatus: string | null;
  plan: string | null;
  accountManager: string | null;
  documentNumber: string | null;
  source: "ACCOUNT_360" | "CUSTOMERS" | "DEMO";
};

function localProfile(customer: CaseCustomerIdentity): CustomerOperationalProfile {
  return {
    publicId: customer.public_id,
    customerId: customer.customer_id,
    fullName: customer.name,
    email: customer.email,
    phone: customer.phone,
    customerType: null,
    segment: null,
    country: null,
    geolocation: null,
    complianceStatus: null,
    plan: null,
    accountManager: null,
    documentNumber: null,
    source: "CUSTOMERS",
  };
}

export async function getCustomerAccount360(customer: CaseCustomerIdentity) {
  const isDemo = isDemoCustomer(customer);

  try {
    const account = await getAccount360(customer.customer_id || "");
    return isDemo ? completeDemoAccount360(account, customer) : account;
  } catch (error) {
    if (isDemo) return buildDemoAccount360(customer);
    throw error;
  }
}

export async function getCustomerProfileForCase(
  customer: CaseCustomerIdentity | null,
): Promise<CustomerOperationalProfile | null> {
  if (!customer) return null;
  const demoProfile = isDemoCustomer(customer)
    ? buildDemoCustomerProfile(customer)
    : null;
  if (!customer.customer_id) {
    return demoProfile
      ? { ...demoProfile, source: "DEMO" }
      : localProfile(customer);
  }

  try {
    const account = await getCustomerAccount360(customer);
    const accountManager =
      typeof account.account_manager === "string"
        ? account.account_manager
        : account.account_manager?.name || account.profile.account_manager || null;

    return {
      publicId: customer.public_id,
      customerId: customer.customer_id,
      fullName: account.profile.full_name || customer.name,
      email: account.profile.email || customer.email,
      phone: account.profile.phone || customer.phone,
      customerType:
        account.profile.customer_type || account.profile.account_type || null,
      segment: account.profile.segment || null,
      country: account.profile.country || null,
      geolocation:
        demoProfile?.geolocation ||
        account.device.last_ip_country ||
        account.profile.country ||
        null,
      complianceStatus:
        account.profile.compliance_status || account.compliance.review_status || null,
      plan: account.profile.plan || null,
      accountManager,
      documentNumber: account.profile.document_number || demoProfile?.documentNumber || null,
      source: demoProfile ? "DEMO" : "ACCOUNT_360",
    };
  } catch {
    return localProfile(customer);
  }
}
