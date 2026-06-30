import { supabase } from "./supabase";

type CaseWhatsappRecord = {
  id: string | number;
  channel: string | null;
  contact_type: string | null;
  contact_phone: string | null;
  customer:
    | {
        phone: string | null;
      }
    | {
        phone: string | null;
      }[]
    | null;
};

export type CaseWhatsappTarget =
  | {
      ok: true;
      caseId: string;
      isWhatsapp: boolean;
      phone: string | null;
      channel: string | null;
      contactType: string | null;
    }
  | {
      ok: false;
      error: string;
      supabaseError?: unknown;
    };

function getCustomerPhone(customer: CaseWhatsappRecord["customer"]) {
  if (Array.isArray(customer)) {
    return customer[0]?.phone ?? null;
  }

  return customer?.phone ?? null;
}

function normalizeValue(value: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

export function isWhatsappCase({
  channel,
  contactType,
}: {
  channel: string | null;
  contactType: string | null;
}) {
  return normalizeValue(channel) === "WHATSAPP" || normalizeValue(contactType) === "WHATSAPP";
}

export async function getCaseWhatsappTarget(
  caseId: string,
): Promise<CaseWhatsappTarget> {
  const { data, error } = await supabase
    .from("cases")
    .select("id, channel, contact_type, contact_phone, customer:customers(phone)")
    .eq("id", caseId)
    .limit(1)
    .returns<CaseWhatsappRecord[]>();

  if (error) {
    return {
      ok: false,
      error: error.message,
      supabaseError: error,
    };
  }

  const caseItem = data?.[0];

  if (!caseItem) {
    return {
      ok: false,
      error: "Caso no encontrado.",
    };
  }

  return {
    ok: true,
    caseId: String(caseItem.id),
    isWhatsapp: isWhatsappCase({
      channel: caseItem.channel,
      contactType: caseItem.contact_type,
    }),
    phone: caseItem.contact_phone ?? getCustomerPhone(caseItem.customer) ?? null,
    channel: caseItem.channel,
    contactType: caseItem.contact_type,
  };
}
