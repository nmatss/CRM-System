import { describe, expect, it } from "vitest";
import { validateTemporaryPassword } from "./temporaryPassword";

describe("validateTemporaryPassword", () => {
  it("exige pelo menos 12 caracteres", () => {
    expect(validateTemporaryPassword("curta", "curta")).toBe("Use pelo menos 12 caracteres.");
  });

  it("exige confirmação idêntica", () => {
    expect(validateTemporaryPassword("senha-segura-12", "senha-diferente-12")).toBe(
      "A confirmação da senha não corresponde.",
    );
  });

  it("aceita uma senha confirmada sem retornar seu valor", () => {
    expect(validateTemporaryPassword("senha-segura-12", "senha-segura-12")).toBeNull();
  });
});
