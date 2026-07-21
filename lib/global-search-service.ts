import "server-only";

import type {
  GlobalSearchCaseResult,
  GlobalSearchCustomerResult,
  GlobalSearchResponse,
} from "@/lib/global-search-types";
import { supabase } from "@/lib/supabase";

type CustomerSearchRow = {
  id: string;
  public_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type CaseSearchRow = {
  id: string;
  case_number: string | null;
  subject: string | null;
  status: string | null;
  lifecycle_status: string | null;
  customer:
    | { name: string | null; email: string | null }
    | { name: string | null; email: string | null }[]
    | null;
};

const emptyResponse: GlobalSearchResponse = {
  cases: [],
  customers: [],
  messages: [],
};

function safeSearchTerm(value: string) {
  return value
    .slice(0, 80)
    .replace(/[^\p{L}\p{N}@.+#\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function customerFromCase(caseItem: CaseSearchRow) {
  return Array.isArray(caseItem.customer) ? caseItem.customer[0] : caseItem.customer;
}

function toCaseResult(caseItem: CaseSearchRow): GlobalSearchCaseResult {
  const customer = customerFromCase(caseItem);
  return {
    id: caseItem.id,
    caseNumber: caseItem.case_number,
    subject: caseItem.subject,
    customerName: customer?.name ?? null,
    customerEmail: customer?.email ?? null,
    status: caseItem.lifecycle_status || caseItem.status,
  };
}

function toCustomerResult(customer: CustomerSearchRow): GlobalSearchCustomerResult {
  return {
    id: customer.id,
    publicId: customer.public_id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
  };
}

export async function searchGlobalCrm(query: string): Promise<GlobalSearchResponse> {
  const term = safeSearchTerm(query);
  if (term.length < 2) return emptyResponse;

  const numberTerm = term.replace(/^#+/, "");
  const customerFilter = [
    `name.ilike.%${term}%`,
    `email.ilike.%${term}%`,
    `phone.ilike.%${term}%`,
    `customer_id.ilike.%${term}%`,
  ].join(",");
  const caseFilter = [
    `case_number.ilike.%${numberTerm}%`,
    `subject.ilike.%${term}%`,
    `contact_email.ilike.%${term}%`,
    `contact_phone.ilike.%${term}%`,
  ].join(",");

  const [customersResult, directCasesResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, public_id, name, email, phone")
      .or(customerFilter)
      .order("name", { ascending: true, nullsFirst: false })
      .limit(5)
      .returns<CustomerSearchRow[]>(),
    supabase
      .from("cases")
      .select("id, case_number, subject, status, lifecycle_status, customer:customers(name, email)")
      .or(caseFilter)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(8)
      .returns<CaseSearchRow[]>(),
  ]);

  if (customersResult.error) throw new Error(customersResult.error.message);
  if (directCasesResult.error) throw new Error(directCasesResult.error.message);

  const customerIds = (customersResult.data ?? []).map((customer) => customer.id);
  const customerCasesResult = customerIds.length
    ? await supabase
        .from("cases")
        .select("id, case_number, subject, status, lifecycle_status, customer:customers(name, email)")
        .in("customer_id", customerIds)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(8)
        .returns<CaseSearchRow[]>()
    : { data: [] as CaseSearchRow[], error: null };

  if (customerCasesResult.error) throw new Error(customerCasesResult.error.message);

  const casesById = new Map<string, CaseSearchRow>();
  [...(directCasesResult.data ?? []), ...(customerCasesResult.data ?? [])].forEach(
    (caseItem) => casesById.set(caseItem.id, caseItem),
  );

  return {
    cases: [...casesById.values()].slice(0, 5).map(toCaseResult),
    customers: (customersResult.data ?? []).map(toCustomerResult),
    messages: [],
  };
}
