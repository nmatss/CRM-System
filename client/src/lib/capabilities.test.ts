import { describe, expect, it } from "vitest";
import { capabilities, getEffectiveRole, hasCapability } from "./capabilities";

describe("role capabilities", () => {
  it("denies capabilities when there is no authenticated role", () => {
    expect(getEffectiveRole(null)).toBeNull();
    expect(
      hasCapability({ isSuperAdmin: false, role: undefined }, capabilities.viewDashboard),
    ).toBe(false);
  });

  it("allows sellers to use tenant features without manager actions", () => {
    const seller = { isSuperAdmin: false, role: "seller" as const };

    expect(hasCapability(seller, capabilities.viewCustomers)).toBe(true);
    expect(hasCapability(seller, capabilities.viewProducts)).toBe(true);
    expect(hasCapability(seller, capabilities.manageProducts)).toBe(false);
    expect(hasCapability(seller, capabilities.manageCampaigns)).toBe(false);
    expect(hasCapability(seller, capabilities.manageTenantSettings)).toBe(false);
    expect(hasCapability(seller, capabilities.viewAdmin)).toBe(false);
  });

  it("allows managers to manage tenant features but not the admin panel", () => {
    const manager = { isSuperAdmin: false, role: "manager" as const };

    expect(hasCapability(manager, capabilities.manageProducts)).toBe(true);
    expect(hasCapability(manager, capabilities.manageCashback)).toBe(true);
    expect(hasCapability(manager, capabilities.manageCampaigns)).toBe(true);
    expect(hasCapability(manager, capabilities.manageAutomations)).toBe(true);
    expect(hasCapability(manager, capabilities.manageTenantSettings)).toBe(true);
    expect(hasCapability(manager, capabilities.viewAdmin)).toBe(false);
  });

  it("uses the super-admin flag as the authoritative admin signal", () => {
    const superAdmin = { isSuperAdmin: true, role: "seller" as const };

    expect(getEffectiveRole(superAdmin)).toBe("super_admin");
    expect(hasCapability(superAdmin, capabilities.viewAdmin)).toBe(true);
    expect(hasCapability(superAdmin, capabilities.manageTenantSettings)).toBe(true);
  });

  it("does not elevate a user from an inconsistent role value alone", () => {
    const inconsistentUser = {
      isSuperAdmin: false,
      role: "super_admin" as const,
    };

    expect(getEffectiveRole(inconsistentUser)).toBeNull();
    expect(hasCapability(inconsistentUser, capabilities.viewAdmin)).toBe(false);
  });
});
