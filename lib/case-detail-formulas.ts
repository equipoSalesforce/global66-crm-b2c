export function normalizeWhatsappNumber(value: string | null | undefined) {
  return value?.replace(/\D/g, "") || "";
}

export function whatsappMatchesCustomerPhone(
  whatsapp: string | null | undefined,
  customerPhone: string | null | undefined,
): boolean | null {
  const normalizedWhatsapp = normalizeWhatsappNumber(whatsapp);
  const normalizedCustomerPhone = normalizeWhatsappNumber(customerPhone);

  if (!normalizedWhatsapp || !normalizedCustomerPhone) return null;
  if (normalizedWhatsapp === normalizedCustomerPhone) return true;

  return normalizedWhatsapp.length >= 9 && normalizedCustomerPhone.length >= 9
    ? normalizedWhatsapp.slice(-9) === normalizedCustomerPhone.slice(-9)
    : false;
}
