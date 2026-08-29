export function isForbiddenError(error: unknown): boolean {
  return error instanceof Error && /^403(?:\s|:)/.test(error.message);
}

export function actionErrorDescription(error: unknown, fallback: string): string {
  return isForbiddenError(error) ? "Você não tem permissão para realizar esta ação." : fallback;
}
