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
  type ContactRequest,
  type InsertContactRequest,
  type DemoRequest,
  type InsertDemoRequest,
  type SellerTask,
  type InsertSellerTask,
  users,
  tenants,
  tenantUsers,
  customers,
  products,
  orders,
  cashbackRules,
  campaigns,
  automations,
  contactRequests,
  demoRequests,
  sellerTasks
} from "@shared/schema";
import { db } from "./db";
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
  getCustomers(tenantId: number): Promise<Customer[]>;
  getCustomer(tenantId: number, id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(tenantId: number, id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(tenantId: number, id: number): Promise<boolean>;

  // Products (tenant-scoped)
  getProducts(tenantId: number): Promise<Product[]>;
  getProduct(tenantId: number, id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(tenantId: number, id: number, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(tenantId: number, id: number): Promise<boolean>;

  // Orders (tenant-scoped)
  getOrders(tenantId: number): Promise<Order[]>;
  getOrder(tenantId: number, id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(tenantId: number, id: number, data: Partial<InsertOrder>): Promise<Order | undefined>;
  deleteOrder(tenantId: number, id: number): Promise<boolean>;

  // Cashback Rules (tenant-scoped)
  getCashbackRules(tenantId: number): Promise<CashbackRule[]>;
  getCashbackRule(tenantId: number, id: number): Promise<CashbackRule | undefined>;
  createCashbackRule(rule: InsertCashbackRule): Promise<CashbackRule>;

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
  updateSellerTask(tenantId: number, id: number, data: Partial<InsertSellerTask & { completedAt?: Date }>): Promise<SellerTask | undefined>;
  deleteSellerTask(tenantId: number, id: number): Promise<boolean>;
  getSellerStats(tenantId: number, sellerId?: string): Promise<{ pending: number; completed: number; today: number; overdue: number }>;
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
        lastPasswordChange: new Date()
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
      conditions.push(gte(sellerTasks.dueDate, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(sellerTasks.dueDate, filters.dateTo));
    }
    
    const tasks = await db.select().from(sellerTasks)
      .where(and(...conditions))
      .orderBy(desc(sellerTasks.createdAt));
    
    const tasksWithCustomers = await Promise.all(tasks.map(async (task) => {
      let customer: Customer | undefined;
      if (task.customerId) {
        const customerResult = await db.select().from(customers)
          .where(and(eq(customers.tenantId, tenantId), eq(customers.id, task.customerId)));
        customer = customerResult[0];
      }
      return { ...task, customer };
    }));
    
    return tasksWithCustomers;
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

  async updateSellerTask(tenantId: number, id: number, data: Partial<InsertSellerTask & { completedAt?: Date }>): Promise<SellerTask | undefined> {
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
    
    const today = new Date().toISOString().split('T')[0];
    
    const pending = allTasks.filter(t => t.status === 'pending').length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const todayTasks = allTasks.filter(t => t.dueDate === today && t.status === 'pending').length;
    const overdue = allTasks.filter(t => t.dueDate < today && t.status === 'pending').length;
    
    return { pending, completed, today: todayTasks, overdue };
  }
}

export const storage = new DatabaseStorage();
