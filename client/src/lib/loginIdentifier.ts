function isCpfLike(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && /^[\d.-]+$/.test(trimmed);
}

function formatCpfDigits(value: string): string {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9)
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
}

export function formatLoginIdentifierInput(value: string): string {
  return isCpfLike(value) ? formatCpfDigits(value) : value;
}

export function normalizeLoginIdentifier(value: string): string {
  const trimmed = value.trim();
  return isCpfLike(trimmed) ? trimmed.replace(/\D/g, "") : trimmed;
}
