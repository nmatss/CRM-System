export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string | null {
  const normalizedPhone = phone?.replace(/\D/g, "") ?? "";

  if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
    return null;
  }

  const params = new URLSearchParams({ text: message.trim() });
  return `https://wa.me/${normalizedPhone}?${params.toString()}`;
}
