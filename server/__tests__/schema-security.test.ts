import { describe, expect, it } from "vitest";
import { registerSchema, users } from "@shared/schema";

describe("identity schema security", () => {
  it("uses RFC 4122 UUIDs from the platform default generator", () => {
    const defaultFn = (users.id as unknown as { defaultFn: () => string }).defaultFn;
    const first = defaultFn();
    const second = defaultFn();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(second).not.toBe(first);
  });

  it("normalizes registration emails and rejects passwords below 12 characters", () => {
    expect(
      registerSchema.parse({
        email: "  USER@Example.COM ",
        password: "long-password",
        name: "Test User",
      }).email,
    ).toBe("user@example.com");

    expect(
      registerSchema.safeParse({
        email: "user@example.com",
        password: "short-pass",
        name: "Test User",
      }).success,
    ).toBe(false);
  });
});
