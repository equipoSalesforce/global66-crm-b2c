import "server-only";

import { supabase } from "@/lib/supabase";

export type CustomerIdentity = {
  id: string;
  publicId: string;
  customerId: string;
};

type CustomerIdentityRecord = {
  id: string;
  public_id: string;
  customer_id: string | null;
};

export class CustomerIdentityError extends Error {}

/**
 * Server-side boundary for CRM customer access. Cognito/SSO authorization must be
 * enforced here before returning an identity once an authenticated principal exists.
 */
export async function resolveCustomerIdentityByPublicId(
  publicId: string,
): Promise<CustomerIdentity | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, public_id, customer_id")
    .eq("public_id", publicId)
    .maybeSingle<CustomerIdentityRecord>();

  if (error) {
    throw new CustomerIdentityError("No se pudo resolver la identidad del cliente.");
  }

  if (!data) return null;
  if (!data.customer_id) {
    throw new CustomerIdentityError(
      "El cliente no tiene un identificador empresarial asociado.",
    );
  }

  return {
    id: data.id,
    publicId: data.public_id,
    customerId: data.customer_id,
  };
}
