export function validateTemporaryPassword(password: string, confirmation: string): string | null {
  if (password.length < 12) return "Use pelo menos 12 caracteres.";
  if (password !== confirmation) return "A confirmação da senha não corresponde.";
  return null;
}
