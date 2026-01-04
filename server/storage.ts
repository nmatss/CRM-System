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
  type CashbackTransaction,
  type InsertCashbackTransaction,
  type Campaign,
  type InsertCampaign,
  type Automation,
  type InsertAutomation,
  type ContactRequest,
  type InsertContactRequest,
  type DemoRequest,
  type InsertDemoRequest,
  type SellerTask,
  type InsertSellerTask,
  type SellerGoal,
  type InsertSellerGoal,
  type CustomerInteraction,
  type InsertCustomerInteraction,
  type Notification,
  type InsertNotification,
  users,
  tenants,
  tenantUsers,
  customers,
  products,
  orders,
  cashbackRules,
  cashbackTransactions,
  campaigns,
  automations,
  contactRequests,
  demoRequests,
  sellerTasks,
  sellerGoals,
  customerInteractions,
  notifications
} from "@shared/schema";
import { db, sqlite } from "./db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByCpf(cpf: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
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
  deleteTenantUser(tenantId: number, userId: string): Promise<boolean>;
  deleteTenant(id: number): Promise<boolean>;
  
  // Customers (tenant-scoped)
  getCustomers(tenantId: number, limit?: number, offset?: number): Promise<{ data: Customer[]; total: number }>;
  getCustomer(tenantId: number, id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(tenantId: number, id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(tenantId: number, id: number): Promise<boolean>;

  // Products (tenant-scoped)
  getProducts(tenantId: number, limit?: number, offset?: number): Promise<{ data: Product[]; total: number }>;
  getProduct(tenantId: number, id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(tenantId: number, id: number, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(tenantId: number, id: number): Promise<boolean>;

  // Orders (tenant-scoped)
  getOrders(tenantId: number, limit?: number, offset?: number): Promise<{ data: Order[]; total: number }>;
  getOrder(tenantId: number, id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(tenantId: number, id: number, data: Partial<InsertOrder>): Promise<Order | undefined>;
  deleteOrder(tenantId: number, id: number): Promise<boolean>;

  // Cashback Rules (tenant-scoped)
  getCashbackRules(tenantId: number): Promise<CashbackRule[]>;
  getCashbackRule(tenantId: number, id: number): Promise<CashbackRule | undefined>;
  createCashbackRule(rule: InsertCashbackRule): Promise<CashbackRule>;
  updateCashbackRule(tenantId: number, id: number, data: Partial<InsertCashbackRule>): Promise<CashbackRule | undefined>;
  deleteCashbackRule(tenantId: number, id: number): Promise<boolean>;

  // Cashback Transactions (tenant-scoped)
  getCashbackTransactions(tenantId: number, customerId?: number, limit?: number): Promise<CashbackTransaction[]>;
  createCashbackTransaction(transaction: InsertCashbackTransaction): Promise<CashbackTransaction>;
  getCustomerCashbackBalance(tenantId: number, customerId: number): Promise<number>;
  getCashbackDistribution(tenantId: number): Promise<{ range: string; count: number }[]>;
  getExpiringCashback(tenantId: number, daysAhead: number): Promise<{ customer: Customer; balance: number; expiresAt: string }[]>;

  // Campaigns (tenant-scoped)
  getCampaigns(tenantId: number): Promise<Campaign[]>;
  getCampaign(tenantId: number, id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(tenantId: number, id: number, data: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(tenantId: number, id: number): Promise<boolean>;

  // Automations (tenant-scoped)
  getAutomations(tenantId: number): Promise<Automation[]>;
  getAutomation(tenantId: number, id: number): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
  updateAutomation(tenantId: number, id: number, data: Partial<InsertAutomation>): Promise<Automation | undefined>;
  deleteAutomation(tenantId: number, id: number): Promise<boolean>;

  // Contact Requests (global)
  getContactRequests(): Promise<ContactRequest[]>;
  createContactRequest(request: InsertContactRequest): Promise<ContactRequest>;
  updateContactRequestStatus(id: number, status: string): Promise<ContactRequest | undefined>;

  // Demo Requests (global)
  getDemoRequests(): Promise<DemoRequest[]>;
  createDemoRequest(request: InsertDemoRequest): Promise<DemoRequest>;
  updateDemoRequestStatus(id: number, status: string): Promise<DemoRequest | undefined>;

  // Tenant Stats (for admin reports)
  getTenantStats(): Promise<{ tenantId: number; tenantName: string; usersCount: number; customersCount: number; ordersCount: number; productsCount: number }[]>;

  // Seller Tasks (tenant-scoped)
  getSellerTasks(tenantId: number, filters?: { sellerId?: string; status?: string; dateFrom?: string; dateTo?: string; type?: string }): Promise<(SellerTask & { customer?: Customer })[]>;
  getSellerTask(tenantId: number, id: number): Promise<SellerTask | undefined>;
  createSellerTask(task: InsertSellerTask): Promise<SellerTask>;
  updateSellerTask(tenantId: number, id: number, data: Partial<InsertSellerTask & { completedAt?: string }>): Promise<SellerTask | undefined>;
  deleteSellerTask(tenantId: number, id: number): Promise<boolean>;
  getSellerStats(tenantId: number, sellerId?: string): Promise<{ pending: number; completed: number; today: number; overdue: number }>;
  
  // Seller Goals (tenant-scoped)
  getSellerGoals(tenantId: number, sellerId?: string): Promise<SellerGoal | undefined>;
  upsertSellerGoals(goals: InsertSellerGoal): Promise<SellerGoal>;
  
  // Customer Interactions (tenant-scoped)
  getCustomerInteractions(tenantId: number, customerId?: number, sellerId?: string, limit?: number): Promise<(CustomerInteraction & { customer?: Customer; seller?: User })[]>;
  createCustomerInteraction(interaction: InsertCustomerInteraction): Promise<CustomerInteraction>;
  
  // Seller Ranking (tenant-scoped)
  getSellerRanking(tenantId: number, period: 'daily' | 'weekly' | 'monthly'): Promise<{ sellerId: string; sellerName: string; completedTasks: number; totalInteractions: number }[]>;

  // Notifications (tenant-scoped)
  getNotifications(tenantId: number, userId?: string, limit?: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotificationStatus(id: number, status: string): Promise<Notification | undefined>;

  // Dashboard Stats (tenant-scoped)
  getDashboardStats(tenantId: number): Promise<{
    totalCustomers: number;
    totalRevenue: number;
    totalOrders: number;
    averageTicket: number;
    revenueGrowth: number;
    newCustomers: number;
    activeCustomers: number;
  }>;
  getDashboardCharts(tenantId: number): Promise<{
    revenueByMonth: { month: string; revenue: number }[];
    ordersByStatus: { status: string; count: number }[];
    customersBySegment: { segment: string; count: number }[];
    topProducts: { name: string; revenue: number; quantity: number }[];
  }>;

  // Customer 360 View (tenant-scoped)
  getCustomer360(tenantId: number, customerId: number): Promise<{
    customer: Customer;
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrder?: Order;
    cashbackBalance: number;
    interactions: CustomerInteraction[];
  } | undefined>;

  // Health Check
  healthCheck(): Promise<boolean>;
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

  async getUserByCpf(cpf: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.cpf, cpf));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return result[0];
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({
        password: hashedPassword,
        mustChangePassword: false,
        lastPasswordChange: new Date().toISOString()
      })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
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

  async deleteTenantUser(tenantId: number, userId: string): Promise<boolean> {
    const result = await db.delete(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async deleteTenant(id: number): Promise<boolean> {
    const result = await db.delete(tenants).where(eq(tenants.id, id)).returning();
    return result.length > 0;
  }

  // ==================== CUSTOMERS ====================
  async getCustomers(tenantId: number, limit?: number, offset?: number): Promise<{ data: Customer[]; total: number }> {
    const condition = eq(customers.tenantId, tenantId);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(condition);
    const total = Number(countResult[0]?.count || 0);

    // Get paginated data
    const data = limit !== undefined && offset !== undefined
      ? await db.select().from(customers).where(condition).limit(limit).offset(offset)
      : await db.select().from(customers).where(condition);

    return { data, total };
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

  async updateCustomer(tenantId: number, id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const result = await db.update(customers)
      .set(data)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .returning();
    return result[0];
  }

  async deleteCustomer(tenantId: number, id: number): Promise<boolean> {
    const result = await db.delete(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .returning();
    return result.length > 0;
  }

  // ==================== PRODUCTS ====================
  async getProducts(tenantId: number, limit?: number, offset?: number): Promise<{ data: Product[]; total: number }> {
    const condition = eq(products.tenantId, tenantId);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(condition);
    const total = Number(countResult[0]?.count || 0);

    // Get paginated data
    const data = limit !== undefined && offset !== undefined
      ? await db.select().from(products).where(condition).limit(limit).offset(offset)
      : await db.select().from(products).where(condition);

    return { data, total };
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

  async updateProduct(tenantId: number, id: number, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db.update(products)
      .set(data)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
      .returning();
    return result[0];
  }

  async deleteProduct(tenantId: number, id: number): Promise<boolean> {
    const result = await db.delete(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
      .returning();
    return result.length > 0;
  }

  // ==================== ORDERS ====================
  async getOrders(tenantId: number, limit?: number, offset?: number): Promise<{ data: Order[]; total: number }> {
    const condition = eq(orders.tenantId, tenantId);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(condition);
    const total = Number(countResult[0]?.count || 0);

    // Get paginated data
    const data = limit !== undefined && offset !== undefined
      ? await db.select().from(orders).where(condition).limit(limit).offset(offset)
      : await db.select().from(orders).where(condition);

    return { data, total };
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

  async updateOrder(tenantId: number, id: number, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const result = await db.update(orders)
      .set(data)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)))
      .returning();
    return result[0];
  }

  async deleteOrder(tenantId: number, id: number): Promise<boolean> {
    const result = await db.delete(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)))
      .returning();
    return result.length > 0;
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

  async updateCashbackRule(tenantId: number, id: number, data: Partial<InsertCashbackRule>): Promise<CashbackRule | undefined> {
    const result = await db.update(cashbackRules)
      .set(data)
      .where(and(eq(cashbackRules.tenantId, tenantId), eq(cashbackRules.id, id)))
      .returning();
    return result[0];
  }

  async deleteCashbackRule(tenantId: number, id: number): Promise<boolean> {
    const result = await db.delete(cashbackRules)
      .where(and(eq(cashbackRules.tenantId, tenantId), eq(cashbackRules.id, id)))
      .returning();
    return result.length > 0;
  }

  // ==================== CASHBACK TRANSACTIONS ====================
  async getCashbackTransactions(tenantId: number, customerId?: number, limit?: number): Promise<CashbackTransaction[]> {
    let conditions = [eq(cashbackTransactions.tenantId, tenantId)];
    if (customerId) {
      conditions.push(eq(cashbackTransactions.customerId, customerId));
    }

    let query = db.select()
      .from(cashbackTransactions)
      .where(and(...conditions))
      .orderBy(desc(cashbackTransactions.createdAt));

    return limit ? await query.limit(limit) : await query;
  }

  async createCashbackTransaction(transaction: InsertCashbackTransaction): Promise<CashbackTransaction> {
    const result = await db.insert(cashbackTransactions).values(transaction).returning();
    return result[0];
  }

  async getCustomerCashbackBalance(tenantId: number, customerId: number): Promise<number> {
    const transactions = await db.select()
      .from(cashbackTransactions)
      .where(and(
        eq(cashbackTransactions.tenantId, tenantId),
        eq(cashbackTransactions.customerId, customerId)
      ))
      .orderBy(desc(cashbackTransactions.createdAt))
      .limit(1);

    return transactions[0]?.balance || 0;
  }

  async getCashbackDistribution(tenantId: number): Promise<{ range: string; count: number }[]> {
    // Get all customers with their latest cashback balance
    const allCustomers = await db.select({ id: customers.id })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

    const balances = await Promise.all(
      allCustomers.map(async (customer) => {
        return await this.getCustomerCashbackBalance(tenantId, customer.id);
      })
    );

    // Group by ranges
    const ranges = [
      { range: 'R$ 0', min: 0, max: 0, count: 0 },
      { range: 'R$ 1-50', min: 0.01, max: 50, count: 0 },
      { range: 'R$ 51-100', min: 51, max: 100, count: 0 },
      { range: 'R$ 101-200', min: 101, max: 200, count: 0 },
      { range: 'R$ 201+', min: 201, max: Infinity, count: 0 }
    ];

    balances.forEach(balance => {
      const range = ranges.find(r => balance >= r.min && balance <= r.max);
      if (range) range.count++;
    });

    return ranges.map(({ range, count }) => ({ range, count }));
  }

  async getExpiringCashback(tenantId: number, daysAhead: number): Promise<{ customer: Customer; balance: number; expiresAt: string }[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const expiringTransactions = await db.select({
      transaction: cashbackTransactions,
      customer: customers
    })
      .from(cashbackTransactions)
      .innerJoin(customers, eq(cashbackTransactions.customerId, customers.id))
      .where(and(
        eq(cashbackTransactions.tenantId, tenantId),
        gte(cashbackTransactions.expiresAt, now.toISOString()),
        lte(cashbackTransactions.expiresAt, futureDate.toISOString()),
        sql`${cashbackTransactions.balance} > 0`
      ))
      .orderBy(cashbackTransactions.expiresAt);

    return expiringTransactions.map(({ transaction, customer }) => ({
      customer,
      balance: transaction.balance,
      expiresAt: transaction.expiresAt!
    }));
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

  async updateCampaign(tenantId: number, id: number, data: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const result = await db.update(campaigns)
      .set(data)
      .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, id)))
      .returning();
    return result[0];
  }

  async deleteCampaign(tenantId: number, id: number): Promise<boolean> {
    const result = await db.delete(campaigns)
      .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, id)))
      .returning();
    return result.length > 0;
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

  async updateAutomation(tenantId: number, id: number, data: Partial<InsertAutomation>): Promise<Automation | undefined> {
    const result = await db.update(automations)
      .set(data)
      .where(and(eq(automations.tenantId, tenantId), eq(automations.id, id)))
      .returning();
    return result[0];
  }

  async deleteAutomation(tenantId: number, id: number): Promise<boolean> {
    const result = await db.delete(automations)
      .where(and(eq(automations.tenantId, tenantId), eq(automations.id, id)))
      .returning();
    return result.length > 0;
  }

  // ==================== CONTACT REQUESTS ====================
  async getContactRequests(): Promise<ContactRequest[]> {
    return await db.select().from(contactRequests).orderBy(desc(contactRequests.createdAt));
  }

  async createContactRequest(request: InsertContactRequest): Promise<ContactRequest> {
    const result = await db.insert(contactRequests).values(request).returning();
    return result[0];
  }

  async updateContactRequestStatus(id: number, status: string): Promise<ContactRequest | undefined> {
    const result = await db.update(contactRequests).set({ status }).where(eq(contactRequests.id, id)).returning();
    return result[0];
  }

  // ==================== DEMO REQUESTS ====================
  async getDemoRequests(): Promise<DemoRequest[]> {
    return await db.select().from(demoRequests).orderBy(desc(demoRequests.createdAt));
  }

  async createDemoRequest(request: InsertDemoRequest): Promise<DemoRequest> {
    const result = await db.insert(demoRequests).values(request).returning();
    return result[0];
  }

  async updateDemoRequestStatus(id: number, status: string): Promise<DemoRequest | undefined> {
    const result = await db.update(demoRequests).set({ status }).where(eq(demoRequests.id, id)).returning();
    return result[0];
  }

  // ==================== TENANT STATS ====================
  async getTenantStats(): Promise<{ tenantId: number; tenantName: string; usersCount: number; customersCount: number; ordersCount: number; productsCount: number }[]> {
    const allTenants = await db.select().from(tenants);
    
    const stats = await Promise.all(allTenants.map(async (tenant) => {
      const [usersResult, customersResult, ordersResult, productsResult] = await Promise.all([
        db.select().from(tenantUsers).where(eq(tenantUsers.tenantId, tenant.id)),
        db.select().from(customers).where(eq(customers.tenantId, tenant.id)),
        db.select().from(orders).where(eq(orders.tenantId, tenant.id)),
        db.select().from(products).where(eq(products.tenantId, tenant.id)),
      ]);
      
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        usersCount: usersResult.length,
        customersCount: customersResult.length,
        ordersCount: ordersResult.length,
        productsCount: productsResult.length,
      };
    }));
    
    return stats;
  }

  // ==================== SELLER TASKS ====================
  async getSellerTasks(tenantId: number, filters?: { sellerId?: string; status?: string; dateFrom?: string; dateTo?: string; type?: string }): Promise<(SellerTask & { customer?: Customer })[]> {
    let conditions = [eq(sellerTasks.tenantId, tenantId)];

    if (filters?.sellerId) {
      conditions.push(eq(sellerTasks.sellerId, filters.sellerId));
    }
    if (filters?.status) {
      conditions.push(eq(sellerTasks.status, filters.status));
    }
    if (filters?.type) {
      conditions.push(eq(sellerTasks.type, filters.type));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(sellerTasks.dueDate, new Date(filters.dateFrom).toISOString()));
    }
    if (filters?.dateTo) {
      conditions.push(lte(sellerTasks.dueDate, new Date(filters.dateTo).toISOString()));
    }

    // Use LEFT JOIN to fetch tasks with customers in a single query
    const results = await db.select({
      task: sellerTasks,
      customer: customers
    })
      .from(sellerTasks)
      .leftJoin(customers, and(
        eq(sellerTasks.customerId, customers.id),
        eq(customers.tenantId, tenantId)
      ))
      .where(and(...conditions))
      .orderBy(desc(sellerTasks.createdAt));

    // Map the results to the expected format
    return results.map(({ task, customer }) => ({
      ...task,
      customer: customer || undefined
    }));
  }

  async getSellerTask(tenantId: number, id: number): Promise<SellerTask | undefined> {
    const result = await db.select().from(sellerTasks)
      .where(and(eq(sellerTasks.tenantId, tenantId), eq(sellerTasks.id, id)));
    return result[0];
  }

  async createSellerTask(task: InsertSellerTask): Promise<SellerTask> {
    const result = await db.insert(sellerTasks).values(task).returning();
    return result[0];
  }

  async updateSellerTask(tenantId: number, id: number, data: Partial<InsertSellerTask & { completedAt?: string }>): Promise<SellerTask | undefined> {
    const result = await db.update(sellerTasks)
      .set(data)
      .where(and(eq(sellerTasks.tenantId, tenantId), eq(sellerTasks.id, id)))
      .returning();
    return result[0];
  }

  async deleteSellerTask(tenantId: number, id: number): Promise<boolean> {
    const result = await db.delete(sellerTasks)
      .where(and(eq(sellerTasks.tenantId, tenantId), eq(sellerTasks.id, id)))
      .returning();
    return result.length > 0;
  }

  async getSellerStats(tenantId: number, sellerId?: string): Promise<{ pending: number; completed: number; today: number; overdue: number }> {
    let conditions = [eq(sellerTasks.tenantId, tenantId)];
    if (sellerId) {
      conditions.push(eq(sellerTasks.sellerId, sellerId));
    }
    
    const allTasks = await db.select().from(sellerTasks).where(and(...conditions));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pending = allTasks.filter(t => t.status === 'pending').length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const todayTasks = allTasks.filter(t => {
      const dueDate = new Date(t.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === today.getTime() && t.status === 'pending';
    }).length;
    const overdue = allTasks.filter(t => {
      const dueDate = new Date(t.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today && t.status === 'pending';
    }).length;

    return { pending, completed, today: todayTasks, overdue };
  }

  // ==================== SELLER GOALS ====================
  async getSellerGoals(tenantId: number, sellerId?: string): Promise<SellerGoal | undefined> {
    let conditions = [eq(sellerGoals.tenantId, tenantId)];
    if (sellerId) {
      conditions.push(eq(sellerGoals.sellerId, sellerId));
    } else {
      conditions.push(sql`${sellerGoals.sellerId} IS NULL`);
    }
    
    const result = await db.select().from(sellerGoals).where(and(...conditions));
    return result[0];
  }

  async upsertSellerGoals(goals: InsertSellerGoal): Promise<SellerGoal> {
    let conditions = [eq(sellerGoals.tenantId, goals.tenantId)];
    if (goals.sellerId) {
      conditions.push(eq(sellerGoals.sellerId, goals.sellerId));
    } else {
      conditions.push(sql`${sellerGoals.sellerId} IS NULL`);
    }
    
    const existing = await db.select().from(sellerGoals).where(and(...conditions));
    
    if (existing.length > 0) {
      const result = await db.update(sellerGoals)
        .set({ ...goals, updatedAt: new Date().toISOString() })
        .where(eq(sellerGoals.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(sellerGoals).values(goals).returning();
      return result[0];
    }
  }

  // ==================== CUSTOMER INTERACTIONS ====================
  async getCustomerInteractions(tenantId: number, customerId?: number, sellerId?: string, limit?: number): Promise<(CustomerInteraction & { customer?: Customer; seller?: User })[]> {
    let conditions = [eq(customerInteractions.tenantId, tenantId)];
    if (customerId) {
      conditions.push(eq(customerInteractions.customerId, customerId));
    }
    if (sellerId) {
      conditions.push(eq(customerInteractions.sellerId, sellerId));
    }

    // Use LEFT JOINs to fetch interactions with customers and sellers in a single query
    let query = db.select({
      interaction: customerInteractions,
      customer: customers,
      seller: users
    })
      .from(customerInteractions)
      .leftJoin(customers, and(
        eq(customerInteractions.customerId, customers.id),
        eq(customers.tenantId, tenantId)
      ))
      .leftJoin(users, eq(customerInteractions.sellerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(customerInteractions.createdAt));

    const results = limit ? await query.limit(limit) : await query;

    // Map the results to the expected format
    return results.map(({ interaction, customer, seller }) => ({
      ...interaction,
      customer: customer || undefined,
      seller: seller || undefined
    }));
  }

  async createCustomerInteraction(interaction: InsertCustomerInteraction): Promise<CustomerInteraction> {
    const result = await db.insert(customerInteractions).values(interaction).returning();
    return result[0];
  }

  // ==================== SELLER RANKING ====================
  async getSellerRanking(tenantId: number, period: 'daily' | 'weekly' | 'monthly'): Promise<{ sellerId: string; sellerName: string; completedTasks: number; totalInteractions: number }[]> {
    const now = new Date();
    let startDate: string;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        break;
      case 'weekly':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        break;
    }

    // Fetch all sellers with their user data in one query using JOIN
    const sellersWithUsers = await db.select({
      userId: tenantUsers.userId,
      userName: users.name
    })
      .from(tenantUsers)
      .innerJoin(users, eq(tenantUsers.userId, users.id))
      .where(and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.role, 'seller')
      ));

    // Batch fetch all completed tasks for the period
    const allCompletedTasks = await db.select({
      sellerId: sellerTasks.sellerId
    })
      .from(sellerTasks)
      .where(and(
        eq(sellerTasks.tenantId, tenantId),
        eq(sellerTasks.status, 'completed'),
        gte(sellerTasks.completedAt, startDate)
      ));

    // Batch fetch all interactions for the period
    const allInteractions = await db.select({
      sellerId: customerInteractions.sellerId
    })
      .from(customerInteractions)
      .where(and(
        eq(customerInteractions.tenantId, tenantId),
        gte(customerInteractions.createdAt, startDate)
      ));

    // Build maps for O(1) lookups
    const taskCountMap = new Map<string, number>();
    allCompletedTasks.forEach(task => {
      if (task.sellerId) {
        taskCountMap.set(task.sellerId, (taskCountMap.get(task.sellerId) || 0) + 1);
      }
    });

    const interactionCountMap = new Map<string, number>();
    allInteractions.forEach(interaction => {
      if (interaction.sellerId) {
        interactionCountMap.set(interaction.sellerId, (interactionCountMap.get(interaction.sellerId) || 0) + 1);
      }
    });

    // Combine all data in JavaScript
    const ranking = sellersWithUsers.map(({ userId, userName }) => ({
      sellerId: userId,
      sellerName: userName,
      completedTasks: taskCountMap.get(userId) || 0,
      totalInteractions: interactionCountMap.get(userId) || 0
    }));

    return ranking.sort((a, b) => b.completedTasks - a.completedTasks);
  }

  // ==================== NOTIFICATIONS ====================
  async getNotifications(tenantId: number, userId?: string, limit: number = 50): Promise<Notification[]> {
    const conditions = [eq(notifications.tenantId, tenantId)];
    if (userId) {
      conditions.push(eq(notifications.userId, userId));
    }

    return await db.select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async updateNotificationStatus(id: number, status: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ status })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  // ==================== DASHBOARD STATS ====================
  async getDashboardStats(tenantId: number): Promise<{
    totalCustomers: number;
    totalRevenue: number;
    totalOrders: number;
    averageTicket: number;
    revenueGrowth: number;
    newCustomers: number;
    activeCustomers: number;
  }> {
    const allCustomers = await db.select().from(customers).where(eq(customers.tenantId, tenantId));
    const allOrders = await db.select().from(orders).where(eq(orders.tenantId, tenantId));

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const totalCustomers = allCustomers.length;
    const totalRevenue = allOrders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = allOrders.length;
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate revenue growth (last 30 days vs previous 30 days)
    const last30DaysRevenue = allOrders
      .filter(o => new Date(o.createdAt!) >= thirtyDaysAgo)
      .reduce((sum, order) => sum + order.total, 0);
    const previous30DaysRevenue = allOrders
      .filter(o => new Date(o.createdAt!) >= sixtyDaysAgo && new Date(o.createdAt!) < thirtyDaysAgo)
      .reduce((sum, order) => sum + order.total, 0);

    const revenueGrowth = previous30DaysRevenue > 0
      ? ((last30DaysRevenue - previous30DaysRevenue) / previous30DaysRevenue) * 100
      : 0;

    const newCustomers = allCustomers.filter(c => new Date(c.createdAt!) >= thirtyDaysAgo).length;
    const activeCustomers = allCustomers.filter(c => c.lastPurchase && new Date(c.lastPurchase) >= thirtyDaysAgo).length;

    return {
      totalCustomers,
      totalRevenue,
      totalOrders,
      averageTicket,
      revenueGrowth,
      newCustomers,
      activeCustomers,
    };
  }

  async getDashboardCharts(tenantId: number): Promise<{
    revenueByMonth: { month: string; revenue: number }[];
    ordersByStatus: { status: string; count: number }[];
    customersBySegment: { segment: string; count: number }[];
    topProducts: { name: string; revenue: number; quantity: number }[];
  }> {
    const allOrders = await db.select().from(orders).where(eq(orders.tenantId, tenantId));
    const allCustomers = await db.select().from(customers).where(eq(customers.tenantId, tenantId));

    // Revenue by month (last 12 months)
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const revenueByMonthMap = new Map<string, number>();

    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[date.getMonth()]}/${date.getFullYear().toString().slice(2)}`;
      revenueByMonthMap.set(key, 0);
    }

    allOrders.forEach(order => {
      const orderDate = new Date(order.orderDate!);
      const key = `${monthNames[orderDate.getMonth()]}/${orderDate.getFullYear().toString().slice(2)}`;
      if (revenueByMonthMap.has(key)) {
        revenueByMonthMap.set(key, (revenueByMonthMap.get(key) || 0) + order.total);
      }
    });

    const revenueByMonth = Array.from(revenueByMonthMap.entries()).map(([month, revenue]) => ({
      month,
      revenue
    }));

    // Orders by status
    const statusMap = new Map<string, number>();
    allOrders.forEach(order => {
      statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
    });
    const ordersByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count
    }));

    // Customers by segment
    const segmentMap = new Map<string, number>();
    allCustomers.forEach(customer => {
      segmentMap.set(customer.segment, (segmentMap.get(customer.segment) || 0) + 1);
    });
    const customersBySegment = Array.from(segmentMap.entries()).map(([segment, count]) => ({
      segment,
      count
    }));

    // Top products (mock data for now - would need order_items table for real data)
    const topProducts: { name: string; revenue: number; quantity: number }[] = [];

    return {
      revenueByMonth,
      ordersByStatus,
      customersBySegment,
      topProducts,
    };
  }

  // ==================== CUSTOMER 360 VIEW ====================
  async getCustomer360(tenantId: number, customerId: number): Promise<{
    customer: Customer;
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrder?: Order;
    cashbackBalance: number;
    interactions: CustomerInteraction[];
  } | undefined> {
    const customer = await this.getCustomer(tenantId, customerId);
    if (!customer) return undefined;

    const customerOrders = await db.select()
      .from(orders)
      .where(and(
        eq(orders.tenantId, tenantId),
        eq(orders.customerId, customerId)
      ))
      .orderBy(desc(orders.orderDate));

    const totalOrders = customerOrders.length;
    const totalSpent = customerOrders.reduce((sum, order) => sum + order.total, 0);
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const lastOrder = customerOrders[0];

    const cashbackBalance = await this.getCustomerCashbackBalance(tenantId, customerId);
    const interactions = await this.getCustomerInteractions(tenantId, customerId, undefined, 10);

    return {
      customer,
      totalOrders,
      totalSpent,
      averageOrderValue,
      lastOrder,
      cashbackBalance,
      interactions,
    };
  }

  // ==================== HEALTH CHECK ====================
  async healthCheck(): Promise<boolean> {
    try {
      // Simple query to check database connectivity
      sqlite.prepare("SELECT 1").get();
      return true;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
