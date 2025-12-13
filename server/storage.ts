import { 
  type User, 
  type InsertUser,
  type Tenant,
  type InsertTenant,
  type TenantUser,
  type InsertTenantUser,
  type Customer,
  type InsertCustomer,
  type Product,
  type InsertProduct,
  type Order,
  type InsertOrder,
  type CashbackRule,
  type InsertCashbackRule,
  type Campaign,
  type InsertCampaign,
  type Automation,
  type InsertAutomation,
  users,
  tenants,
  tenantUsers,
  customers,
  products,
  orders,
  cashbackRules,
  campaigns,
  automations
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Tenants
  getTenants(): Promise<Tenant[]>;
  getTenant(id: number): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, data: Partial<InsertTenant>): Promise<Tenant | undefined>;
  
  // Tenant Users
  getTenantUsers(tenantId: number): Promise<TenantUser[]>;
  getUserTenants(userId: string): Promise<TenantUser[]>;
  getTenantUser(tenantId: number, userId: string): Promise<TenantUser | undefined>;
  createTenantUser(tenantUser: InsertTenantUser): Promise<TenantUser>;
  updateTenantUserRole(tenantId: number, userId: string, role: string): Promise<TenantUser | undefined>;
  
  // Customers (tenant-scoped)
  getCustomers(tenantId: number): Promise<Customer[]>;
  getCustomer(tenantId: number, id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;

  // Products (tenant-scoped)
  getProducts(tenantId: number): Promise<Product[]>;
  getProduct(tenantId: number, id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;

  // Orders (tenant-scoped)
  getOrders(tenantId: number): Promise<Order[]>;
  getOrder(tenantId: number, id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;

  // Cashback Rules (tenant-scoped)
  getCashbackRules(tenantId: number): Promise<CashbackRule[]>;
  getCashbackRule(tenantId: number, id: number): Promise<CashbackRule | undefined>;
  createCashbackRule(rule: InsertCashbackRule): Promise<CashbackRule>;

  // Campaigns (tenant-scoped)
  getCampaigns(tenantId: number): Promise<Campaign[]>;
  getCampaign(tenantId: number, id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;

  // Automations (tenant-scoped)
  getAutomations(tenantId: number): Promise<Automation[]>;
  getAutomation(tenantId: number, id: number): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
}

export class DatabaseStorage implements IStorage {
  // ==================== USERS ====================
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // ==================== TENANTS ====================
  async getTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants);
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.id, id));
    return result[0];
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return result[0];
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const result = await db.insert(tenants).values(tenant).returning();
    return result[0];
  }

  async updateTenant(id: number, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const result = await db.update(tenants).set(data).where(eq(tenants.id, id)).returning();
    return result[0];
  }

  // ==================== TENANT USERS ====================
  async getTenantUsers(tenantId: number): Promise<TenantUser[]> {
    return await db.select().from(tenantUsers).where(eq(tenantUsers.tenantId, tenantId));
  }

  async getUserTenants(userId: string): Promise<TenantUser[]> {
    return await db.select().from(tenantUsers).where(eq(tenantUsers.userId, userId));
  }

  async getTenantUser(tenantId: number, userId: string): Promise<TenantUser | undefined> {
    const result = await db.select().from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)));
    return result[0];
  }

  async createTenantUser(tenantUser: InsertTenantUser): Promise<TenantUser> {
    const result = await db.insert(tenantUsers).values(tenantUser).returning();
    return result[0];
  }

  async updateTenantUserRole(tenantId: number, userId: string, role: string): Promise<TenantUser | undefined> {
    const result = await db.update(tenantUsers)
      .set({ role })
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
      .returning();
    return result[0];
  }

  // ==================== CUSTOMERS ====================
  async getCustomers(tenantId: number): Promise<Customer[]> {
    return await db.select().from(customers).where(eq(customers.tenantId, tenantId));
  }

  async getCustomer(tenantId: number, id: number): Promise<Customer | undefined> {
    const result = await db.select().from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)));
    return result[0];
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(customer).returning();
    return result[0];
  }

  // ==================== PRODUCTS ====================
  async getProducts(tenantId: number): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.tenantId, tenantId));
  }

  async getProduct(tenantId: number, id: number): Promise<Product | undefined> {
    const result = await db.select().from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)));
    return result[0];
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    return result[0];
  }

  // ==================== ORDERS ====================
  async getOrders(tenantId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.tenantId, tenantId));
  }

  async getOrder(tenantId: number, id: number): Promise<Order | undefined> {
    const result = await db.select().from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)));
    return result[0];
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(order).returning();
    return result[0];
  }

  // ==================== CASHBACK RULES ====================
  async getCashbackRules(tenantId: number): Promise<CashbackRule[]> {
    return await db.select().from(cashbackRules).where(eq(cashbackRules.tenantId, tenantId));
  }

  async getCashbackRule(tenantId: number, id: number): Promise<CashbackRule | undefined> {
    const result = await db.select().from(cashbackRules)
      .where(and(eq(cashbackRules.tenantId, tenantId), eq(cashbackRules.id, id)));
    return result[0];
  }

  async createCashbackRule(rule: InsertCashbackRule): Promise<CashbackRule> {
    const result = await db.insert(cashbackRules).values(rule).returning();
    return result[0];
  }

  // ==================== CAMPAIGNS ====================
  async getCampaigns(tenantId: number): Promise<Campaign[]> {
    return await db.select().from(campaigns).where(eq(campaigns.tenantId, tenantId));
  }

  async getCampaign(tenantId: number, id: number): Promise<Campaign | undefined> {
    const result = await db.select().from(campaigns)
      .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, id)));
    return result[0];
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const result = await db.insert(campaigns).values(campaign).returning();
    return result[0];
  }

  // ==================== AUTOMATIONS ====================
  async getAutomations(tenantId: number): Promise<Automation[]> {
    return await db.select().from(automations).where(eq(automations.tenantId, tenantId));
  }

  async getAutomation(tenantId: number, id: number): Promise<Automation | undefined> {
    const result = await db.select().from(automations)
      .where(and(eq(automations.tenantId, tenantId), eq(automations.id, id)));
    return result[0];
  }

  async createAutomation(automation: InsertAutomation): Promise<Automation> {
    const result = await db.insert(automations).values(automation).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
