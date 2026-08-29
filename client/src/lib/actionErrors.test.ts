import { describe, expect, it } from "vitest";
import { actionErrorDescription, isForbiddenError } from "./actionErrors";

describe("action errors", () => {
  it("identifica respostas 403 do cliente HTTP", () => {
    expect(isForbiddenError(new Error('403: {"error":"Acesso negado"}'))).toBe(true);
    expect(isForbiddenError(new Error("500: falha"))).toBe(false);
  });

  it("fornece uma mensagem consistente para acesso negado", () => {
    expect(actionErrorDescription(new Error("403: Forbidden"), "Falha genérica")).toBe(
      "Você não tem permissão para realizar esta ação.",
    );
    expect(actionErrorDescription(new Error("500: falha"), "Falha genérica")).toBe(
      "Falha genérica",
    );
  });
});
