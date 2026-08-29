import { describe, expect, it } from "vitest";
import { formatLoginIdentifierInput, normalizeLoginIdentifier } from "./loginIdentifier";

describe("login identifier", () => {
  it("formats and normalizes a CPF without changing its digits", () => {
    expect(formatLoginIdentifierInput("12345678901")).toBe("123.456.789-01");
    expect(normalizeLoginIdentifier("123.456.789-01")).toBe("12345678901");
  });

  it.each(["nome.sobrenome@example.com", "nome-com-hifen@example.com", "qa1@x.io"])(
    "preserves the email %s",
    (email) => {
      expect(formatLoginIdentifierInput(email)).toBe(email);
      expect(normalizeLoginIdentifier(` ${email} `)).toBe(email);
    },
  );

  it("does not classify mixed alphanumeric input as CPF", () => {
    expect(formatLoginIdentifierInput("abc123")).toBe("abc123");
    expect(normalizeLoginIdentifier("abc123")).toBe("abc123");
  });
});
