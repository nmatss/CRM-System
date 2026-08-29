const SAFE_CLIENT_ERROR_STATUSES = new Set([400, 401, 404, 409, 429]);

export function settingsErrorDescription(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  const match = /^(\d{3}):\s*([\s\S]*)$/.exec(error.message);
  if (!match) return fallback;

  const status = Number(match[1]);
  if (status === 403) {
    return "Você não tem permissão para realizar esta ação.";
  }

  if (!SAFE_CLIENT_ERROR_STATUSES.has(status)) return fallback;

  try {
    const payload = JSON.parse(match[2]) as { error?: unknown };
    return typeof payload.error === "string" && payload.error.trim() ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

export function safeSettingsImageUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
