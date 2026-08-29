/**
 * Builds the deterministic dataset the end-to-end suite runs against.
 *
 * It writes to the disposable database pointed at by DATABASE_PATH and is
 * expected to run before the test server starts. Two tenants exist on purpose:
 * the isolation specs need a second tenant whose data must never be reachable.
 */
import { hashPassword } from "../../server/auth";
import { storage } from "../../server/storage";
import { sqlite } from "../../server/db";
import { E2E_PASSWORD, seededData, tenants, users } from "../fixtures";

async function createMember(
  tenantId: number,
  email: string,
  name: string,
  role: "manager" | "seller",
  passwordHash: string,
) {
  const user = await storage.createUser({
    email,
    name,
    password: passwordHash,
    isSuperAdmin: false,
    // The suite logs in directly; the change-password gate is exercised by its
    // own dedicated spec instead of blocking every other one.
    mustChangePassword: false,
    status: "active",
  });
  await storage.createTenantUser({ tenantId, userId: user.id, role, isActive: true });
  return user;
}

async function main() {
  const passwordHash = await hashPassword(E2E_PASSWORD);

  const superAdmin = await storage.createUser({
    email: users.superAdmin.email,
    name: users.superAdmin.name,
    password: passwordHash,
    isSuperAdmin: true,
    mustChangePassword: false,
    status: "active",
  });

  const alpha = await storage.createTenant({
    name: tenants.alpha.name,
    slug: tenants.alpha.slug,
    plan: "e2e",
    status: "active",
  });
  const beta = await storage.createTenant({
    name: tenants.beta.name,
    slug: tenants.beta.slug,
    plan: "e2e",
    status: "active",
  });

  await createMember(
    alpha.id,
    users.alphaManager.email,
    users.alphaManager.name,
    "manager",
    passwordHash,
  );
  await createMember(
    alpha.id,
    users.alphaSeller.email,
    users.alphaSeller.name,
    "seller",
    passwordHash,
  );
  await createMember(
    beta.id,
    users.betaManager.email,
    users.betaManager.name,
    "manager",
    passwordHash,
  );

  const alphaCustomer = await storage.createCustomer({
    tenantId: alpha.id,
    name: seededData.alphaCustomerName,
    email: "cliente-alpha@example.test",
    phone: "+5511900000001",
    segment: "Regular",
  });
  await storage.createCustomer({
    tenantId: alpha.id,
    name: seededData.alphaVipCustomerName,
    email: "cliente-vip-alpha@example.test",
    phone: "+5511900000002",
    segment: "VIP",
  });
  const betaCustomer = await storage.createCustomer({
    tenantId: beta.id,
    name: seededData.betaCustomerName,
    email: "cliente-beta@example.test",
    segment: "VIP",
  });

  const alphaProduct = await storage.createProduct({
    tenantId: alpha.id,
    name: seededData.alphaProductName,
    category: "Moda",
    status: "Ativo",
    price: 49.9,
    stock: 25,
  });

  await storage.createOrderWithLineItems({
    tenantId: alpha.id,
    customerId: alphaCustomer.id,
    customer: alphaCustomer.name,
    method: "PIX",
    status: "Pago",
    lineItems: [{ productId: alphaProduct.id, quantity: 2 }],
  });

  await storage.createCampaign({
    tenantId: alpha.id,
    name: seededData.alphaCampaignName,
    channel: "email",
    audience: "Clientes VIP",
    message: "Mensagem da campanha E2E",
    status: "draft",
  });

  await storage.createAutomation({
    tenantId: alpha.id,
    title: seededData.alphaAutomationTitle,
    description: "Automacao usada pelos testes end-to-end",
    icon: "Zap",
    isActive: false,
    triggerType: "customer.created",
    actionType: "notify_customer",
    actionChannel: "email",
  });

  // Reported so a failing pipeline shows what the suite actually ran against.
  console.log(
    JSON.stringify({
      superAdminId: superAdmin.id,
      alphaTenantId: alpha.id,
      betaTenantId: beta.id,
      betaCustomerId: betaCustomer.id,
      alphaProductId: alphaProduct.id,
    }),
  );

  sqlite.close();
}

main().catch((error) => {
  console.error("E2E seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
