import type { SessionUser, UserRole } from "@shared/schema";

export const capabilities = {
  viewDashboard: "view:dashboard",
  viewSellerAgenda: "view:seller-agenda",
  viewCustomers: "view:customers",
  viewCashback: "view:cashback",
  manageCashback: "manage:cashback",
  viewCampaigns: "view:campaigns",
  manageCampaigns: "manage:campaigns",
  viewAutomations: "view:automations",
  manageAutomations: "manage:automations",
  viewOrders: "view:orders",
  viewProducts: "view:products",
  manageProducts: "manage:products",
  viewReports: "view:reports",
  viewSettings: "view:settings",
  manageTenantSettings: "manage:tenant-settings",
  viewAdmin: "view:admin",
} as const;

export type Capability = (typeof capabilities)[keyof typeof capabilities];

const sharedTenantCapabilities = [
  capabilities.viewDashboard,
  capabilities.viewSellerAgenda,
  capabilities.viewCustomers,
  capabilities.viewCashback,
  capabilities.viewCampaigns,
  capabilities.viewAutomations,
  capabilities.viewOrders,
  capabilities.viewProducts,
  capabilities.viewReports,
  capabilities.viewSettings,
] as const;

export const capabilitiesByRole = {
  seller: sharedTenantCapabilities,
  manager: [
    ...sharedTenantCapabilities,
    capabilities.manageCashback,
    capabilities.manageCampaigns,
    capabilities.manageAutomations,
    capabilities.manageProducts,
    capabilities.manageTenantSettings,
  ],
  super_admin: [
    ...sharedTenantCapabilities,
    capabilities.manageCashback,
    capabilities.manageCampaigns,
    capabilities.manageAutomations,
    capabilities.manageProducts,
    capabilities.manageTenantSettings,
    capabilities.viewAdmin,
  ],
} as const satisfies Record<UserRole, readonly Capability[]>;

type CapabilityUser = Pick<SessionUser, "isSuperAdmin" | "role">;

export function getEffectiveRole(user?: CapabilityUser | null): UserRole | null {
  if (!user) return null;
  if (user.isSuperAdmin) return "super_admin";
  if (user.role === "manager" || user.role === "seller") return user.role;
  return null;
}

export function hasCapability(
  user: CapabilityUser | null | undefined,
  capability: Capability,
): boolean {
  const role = getEffectiveRole(user);
  if (!role) return false;

  const roleCapabilities: readonly Capability[] = capabilitiesByRole[role];
  return roleCapabilities.includes(capability);
}
