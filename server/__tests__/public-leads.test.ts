import { describe, expect, it } from "vitest";
import { publicContactSchema, publicDemoSchema, PRIVACY_POLICY_VERSION } from "@shared/schema";

/**
 * The lead-capture endpoints are the only unauthenticated writes that persist
 * personal data. The payload contract is therefore closed, bounded and
 * consent-bearing, and these cases pin each of those properties.
 */
describe("public lead capture contract", () => {
  const validContact = {
    name: "Maria Silva",
    email: "Maria@Example.TEST",
    phone: "+5511999990000",
    message: "Gostaria de saber mais sobre o produto.",
    consent: true as const,
  };

  const validDemo = {
    name: "Joao Souza",
    email: "joao@example.test",
    company: "Loja Exemplo",
    consent: true as const,
  };

  it("accepts a well-formed submission and normalizes the email", () => {
    const parsed = publicContactSchema.parse(validContact);
    expect(parsed.email).toBe("maria@example.test");
    expect(parsed.name).toBe("Maria Silva");
    expect(publicDemoSchema.parse(validDemo).company).toBe("Loja Exemplo");
  });

  it("refuses a submission without explicit consent", () => {
    expect(() => publicContactSchema.parse({ ...validContact, consent: false })).toThrow();
    const { consent: _omitted, ...withoutConsent } = validContact;
    expect(() => publicContactSchema.parse(withoutConsent)).toThrow();
    expect(() => publicDemoSchema.parse({ ...validDemo, consent: false })).toThrow();
  });

  it("refuses unknown fields so a visitor cannot set the triage status", () => {
    expect(() => publicContactSchema.parse({ ...validContact, status: "converted" })).toThrow();
    expect(() => publicDemoSchema.parse({ ...validDemo, status: "converted" })).toThrow();
    // An id must not be chosen by the caller either.
    expect(() => publicContactSchema.parse({ ...validContact, id: 1 })).toThrow();
  });

  it("bounds every string so a single request cannot store a megabyte", () => {
    expect(() =>
      publicContactSchema.parse({ ...validContact, message: "x".repeat(2001) }),
    ).toThrow();
    expect(() => publicContactSchema.parse({ ...validContact, name: "x".repeat(121) })).toThrow();
    expect(() =>
      publicContactSchema.parse({ ...validContact, email: `${"x".repeat(250)}@example.test` }),
    ).toThrow();
    expect(() => publicDemoSchema.parse({ ...validDemo, company: "x".repeat(121) })).toThrow();
  });

  it("rejects malformed identity fields", () => {
    expect(() => publicContactSchema.parse({ ...validContact, email: "not-an-email" })).toThrow();
    expect(() => publicContactSchema.parse({ ...validContact, name: "M" })).toThrow();
    expect(() => publicContactSchema.parse({ ...validContact, message: "hi" })).toThrow();
  });

  it("treats a filled honeypot as invalid input", () => {
    // The route answers 201 to a bot, but the payload itself never validates.
    expect(() =>
      publicContactSchema.parse({ ...validContact, website: "http://spam.example" }),
    ).toThrow();
  });

  it("exposes a policy version to record against the consent", () => {
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
