import "server-only";

import {
  readSmartSupervisionValue,
  smartSupervisionString,
} from "@/lib/smartsupervision-payload";
import type { SmartSupervisionComplaintPayload } from "@/lib/smartsupervision-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CustomerRecord = {
  id: string;
  customer_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type CustomerOperationalProfileRecord = {
  id: string;
  customer_id: string;
  redshift_customer_id: string | null;
  country: string | null;
  country_code: string | null;
  document_type: string | null;
  document_number: string | null;
  customer_type: string | null;
  segment: string | null;
  plan: string | null;
  compliance_status: string | null;
  risk_level: string | null;
  source: string;
  source_payload: Record<string, unknown>;
  synced_at: string | null;
};

async function findCustomerById(customerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("customers")
    .select("id, customer_id, name, email, phone")
    .eq("id", customerId)
    .maybeSingle<CustomerRecord>();
  if (error) throw error;
  return data;
}

async function findCustomerByContact(column: "email" | "phone", value: string | null) {
  if (!value) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("customers")
    .select("id, customer_id, name, email, phone")
    .eq(column, value)
    .limit(1)
    .maybeSingle<CustomerRecord>();
  if (error) throw error;
  return data;
}

export async function getCustomerOperationalProfile(customerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("customer_operational_profiles")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle<CustomerOperationalProfileRecord>();
  if (error) throw error;
  return data;
}

export async function findOrCreateSmartSupervisionCustomer(
  payload: SmartSupervisionComplaintPayload,
) {
  const documentNumber = smartSupervisionString(
    readSmartSupervisionValue(payload, "id_number__c"),
  );
  const email = smartSupervisionString(readSmartSupervisionValue(payload, "SuppliedEmail"));
  const phone = smartSupervisionString(readSmartSupervisionValue(payload, "SuppliedPhone"));
  let customer: CustomerRecord | null = null;

  if (documentNumber) {
    const { data: profile, error } = await getSupabaseAdmin()
      .from("customer_operational_profiles")
      .select("customer_id")
      .eq("document_number", documentNumber)
      .limit(1)
      .maybeSingle<{ customer_id: string }>();
    if (error) throw error;
    if (profile) customer = await findCustomerById(profile.customer_id);
  }

  customer ??= await findCustomerByContact("email", email);
  customer ??= await findCustomerByContact("phone", phone);

  if (!customer) {
    const { data, error } = await getSupabaseAdmin()
      .from("customers")
      .insert({
        name: smartSupervisionString(readSmartSupervisionValue(payload, "SuppliedName")),
        email,
        phone,
      })
      .select("id, customer_id, name, email, phone")
      .single<CustomerRecord>();
    if (error) throw error;
    customer = data;
  }

  return customer;
}

export async function upsertSmartSupervisionCustomerProfile(
  customer: CustomerRecord,
  payload: SmartSupervisionComplaintPayload,
) {
  const countryCode = smartSupervisionString(
    readSmartSupervisionValue(payload, "codigo_pais__c", "Country__c"),
  )?.toUpperCase() ?? null;
  const country = countryCode === "COL"
    ? "Colombia"
    : smartSupervisionString(readSmartSupervisionValue(payload, "Country__c"));

  const { data, error } = await getSupabaseAdmin()
    .from("customer_operational_profiles")
    .upsert({
      customer_id: customer.id,
      redshift_customer_id: customer.customer_id,
      country,
      country_code: countryCode,
      document_type: smartSupervisionString(
        readSmartSupervisionValue(payload, "SC_id_type__c"),
      ),
      document_number: smartSupervisionString(
        readSmartSupervisionValue(payload, "id_number__c"),
      ),
      customer_type: smartSupervisionString(
        readSmartSupervisionValue(payload, "tipo_de_persona__c"),
      ),
      source: "SMARTSUPERVISION",
      source_payload: {
        sc_genero__c: readSmartSupervisionValue(payload, "sc_genero__c"),
        SC_id_type__c: readSmartSupervisionValue(payload, "SC_id_type__c"),
        id_number__c: readSmartSupervisionValue(payload, "id_number__c"),
        tipo_de_persona__c: readSmartSupervisionValue(payload, "tipo_de_persona__c"),
        codigo_pais__c: readSmartSupervisionValue(payload, "codigo_pais__c"),
      },
      synced_at: new Date().toISOString(),
    }, { onConflict: "customer_id" })
    .select("*")
    .single<CustomerOperationalProfileRecord>();
  if (error) throw error;
  return data;
}
