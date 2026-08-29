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
  type OrderItem,
  type CashbackRule,
  type InsertCashbackRule,
  type CashbackTransaction,
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
  type AuditEvent,
  users,
  tenants,
  tenantUsers,
  customers,
  products,
  orders,
  orderItems,
  cashbackRules,
  cashbackTransactions,
  campaigns,
  automations,
  contactRequests,
  demoRequests,
  sellerTasks,
  sellerGoals,
  customerInteractions,
  notifications,
  normalizeEmail,
} from "@shared/schema";
import { db, sqlite } from "./db";
import { enqueueAutomationJobsForEvent } from "./services/automationEngine";
import { sessionSqlite, usingSeparateSessionDatabase } from "./sessionDb";
import { eq, and, asc, desc, gte, lte, ne, or, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";

type SortOrder = "asc" | "desc";

function moneyToCents(value: number, field: string): number {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(cents)) {
    throw new Error(`${field} must be a non-negative amount representable in cents`);
  }
  return cents;
}

export interface CustomerListOptions {
  limit?: number;
  offset?: number;
  search?: string;
  segment?: "VIP" | "Novo" | "Regular" | "Em Risco" | "Inativo";
  sort?: "name";
  order?: SortOrder;
}

export interface ProductListOptions {
  limit?: number;
  offset?: number;
  search?: string;
  status?: "Ativo" | "Inativo" | "Rascunho";
  sort?: "name";
  order?: SortOrder;
}

export interface OrderListOptions {
  limit?: number;
  offset?: number;
  search?: string;
  status?: "Pendente" | "Processando" | "Pago" | "Enviado" | "Entregue" | "Cancelado";
  sort?: "orderDate";
  order?: SortOrder;
}

export interface ReportOptions {
  startDate?: string;
  endDate?: string;
  timezone: "UTC";
}

export interface SalesReport {
  timezone: "UTC";
  range: { startDate: string | null; endDate: string | null };
  summary: {
    totalRevenue: number;
    totalRevenueCents: number;
    totalOrders: number;
    averageTicket: number;
    averageTicketCents: number;
    totalCustomers: number;
    totalProducts: number;
  };
  salesByMonth: Array<{
    name: string;
    month: string;
    sales: number;
    salesCents: number;
    orders: number;
  }>;
  salesByCategory: Array<{ name: string; value: number; valueCents: number; quantity: number }>;
  customersBySegment: Array<{ name: string; count: number }>;
  topCustomers: Array<{
    id: number;
    name: string;
    email: string;
    segment: string;
    ltv: number;
    ltvCents: number;
    totalSpent: number;
    totalSpentCents: number;
    orderCount: number;
  }>;
  campaignStats: Array<{
    id: number;
    name: string;
    channel: string;
    status: string;
    sent: number;
    openRate: number;
    conversion: number;
    revenue: number;
    metricsAvailable: false;
    unavailableReason: string;
  }>;
  orders: Array<{
    id: number;
    orderId: string;
    customerId: number | null;
    customer: string;
    orderDate: string | null;
    total: number;
    totalCents: number;
    status: string;
  }>;
}

export interface CreateOrderWithLineItemsInput {
  tenantId: number;
  customerId?: number | null;
  customer: string;
  method: string;
  orderDate?: string | null;
  status?: "Pendente" | "Processando" | "Pago" | "Enviado" | "Entregue" | "Cancelado";
  lineItems: Array<{ productId: number; quantity: number }>;
}

export class OrderDomainError extends Error {
  constructor(
    public readonly code:
      "INVALID_TENANT_REFERENCE" | "INSUFFICIENT_STOCK" | "ORDER_ALREADY_CANCELLED",
    message: string,
  ) {
    super(message);
    this.name = "OrderDomainError";
  }
}

export interface CashbackLedgerInput {
  customerId: number;
  amountCents: number;
  idempotencyKey: string;
  description: string;
  source: string;
  ruleId?: number | null;
  orderId?: number | null;
  expiresAt?: string | null;
}

export type AuditAction =
  | "auth.login"
  | "auth.register"
  | "auth.password_changed"
  | "identity.updated"
  | "global_role.changed"
  | "membership.created"
  | "membership.role_changed"
  | "membership.removed"
  | "data.exported"
  | "entity.deleted"
  | "order.cancelled"
  | "cashback.credited"
  | "cashback.debited"
  | "cashback.reversed"
  | "cashback.expired"
  | "cashback.reconciled";

export interface AuditContext {
  actorUserId?: string | null;
  requestId: string;
}

export interface AuditWriteInput extends AuditContext {
  tenantId?: number | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | number | null;
  outcome: "success" | "failure";
  metadata?: Record<string, unknown>;
}

export interface AuditEventView extends Omit<AuditEvent, "metadataJson"> {
  metadata: Record<string, string | number | boolean>;
}

const auditMetadataKeys: Record<AuditAction, readonly string[]> = {
  "auth.login": ["identifierType", "reason"],
  "auth.register": ["tenantCreated"],
  "auth.password_changed": ["resetType"],
  "identity.updated": ["fields"],
  "global_role.changed": ["role"],
  "membership.created": ["role"],
  "membership.role_changed": ["role"],
  "membership.removed": [],
  "data.exported": ["entityType", "rowCount"],
  "entity.deleted": ["entityType"],
  "order.cancelled": [],
  "cashback.credited": ["amountCents", "transactionId"],
  "cashback.debited": ["amountCents", "transactionId"],
  "cashback.reversed": ["transactionId", "reversalTransactionId"],
  "cashback.expired": ["transactionCount"],
  "cashback.reconciled": ["customerCount", "consistent"],
};

export function sanitizeAuditMetadata(
  action: AuditAction,
  metadata: Record<string, unknown> = {},
): Record<string, string | number | boolean> {
  const allowed = new Set(auditMetadataKeys[action]);
  return Object.fromEntries(
    Object.entries(metadata).filter(
      ([key, value]) =>
        allowed.has(key) &&
        (typeof value === "string" || typeof value === "number" || typeof value === "boolean") &&
        (typeof value !== "string" || value.length <= 100),
    ),
  ) as Record<string, string | number | boolean>;
}

export class CashbackLedgerError extends Error {
  constructor(
    public readonly code:
      | "IDEMPOTENCY_CONFLICT"
      | "INSUFFICIENT_CASHBACK"
      | "INVALID_TENANT_REFERENCE"
      | "REVERSAL_NOT_ALLOWED"
      | "TRANSACTION_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "CashbackLedgerError";
  }
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByCpf(cpf: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  registerSelfService(
    user: InsertUser,
    tenant: InsertTenant | undefined,
    audit: AuditWriteInput,
  ): Promise<{ user: User; tenant?: Tenant }>;
  createUserWithMembership(
    user: InsertUser,
    tenantId: number | undefined,
    role: string | undefined,
    audit?: AuditWriteInput,
  ): Promise<{ user: User; membership?: TenantUser }>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  updateUserBySuperAdmin(
    id: string,
    data: { name?: string; email?: string; isSuperAdmin?: boolean; hashedPassword?: string },
    audit: AuditContext,
  ): Promise<User | undefined>;
  updateUserPassword(
    id: string,
    hashedPassword: string,
    mustChangePassword?: boolean,
  ): Promise<User | undefined>;
  updateUserPasswordAudited(
    id: string,
    hashedPassword: string,
    mustChangePassword: boolean,
    audit: AuditWriteInput,
  ): Promise<User | undefined>;
  deleteUser(id: string, audit?: AuditWriteInput): Promise<boolean>;

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
  updateTenantUserRole(
    tenantId: number,
    userId: string,
    role: string,
  ): Promise<TenantUser | undefined>;
  upsertTenantUserAudited(
    tenantId: number,
    userId: string,
    role: string,
    audit: AuditWriteInput,
  ): Promise<TenantUser>;
  deleteTenantUser(tenantId: number, userId: string): Promise<boolean>;
  deleteTenantUserAudited(
    tenantId: number,
    userId: string,
    audit: AuditWriteInput,
  ): Promise<boolean>;
  deleteTenant(id: number, audit?: AuditWriteInput): Promise<boolean>;

  // Immutable security audit events
  appendAuditEvent(event: AuditWriteInput): Promise<AuditEventView>;
  getAuditEvents(options: {
    tenantId?: number;
    global?: boolean;
    limit: number;
    offset: number;
    action?: AuditAction;
    outcome?: "success" | "failure";
  }): Promise<{ data: AuditEventView[]; total: number }>;

  // Customers (tenant-scoped)
  getCustomers(
    tenantId: number,
    options?: CustomerListOptions,
  ): Promise<{ data: Customer[]; total: number }>;
  getCustomer(tenantId: number, id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(
    tenantId: number,
    id: number,
    data: Partial<InsertCustomer>,
  ): Promise<Customer | undefined>;
  deleteCustomer(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean>;

  // Products (tenant-scoped)
  getProducts(
    tenantId: number,
    options?: ProductListOptions,
  ): Promise<{ data: Product[]; total: number }>;
  getProduct(tenantId: number, id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(
    tenantId: number,
    id: number,
    data: Partial<InsertProduct>,
  ): Promise<Product | undefined>;
  deleteProduct(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean>;

  // Orders (tenant-scoped)
  getOrders(
    tenantId: number,
    options?: OrderListOptions,
  ): Promise<{ data: Order[]; total: number }>;
  getOrder(tenantId: number, id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  createOrderWithLineItems(input: CreateOrderWithLineItemsInput): Promise<Order>;
  getOrderItems(tenantId: number, orderId: number): Promise<OrderItem[]>;
  cancelOrder(tenantId: number, id: number, audit?: AuditWriteInput): Promise<Order | undefined>;
  updateOrder(tenantId: number, id: number, data: Partial<InsertOrder>): Promise<Order | undefined>;
  deleteOrder(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean>;

  // Cashback Rules (tenant-scoped)
  getCashbackRules(tenantId: number): Promise<CashbackRule[]>;
  getCashbackRule(tenantId: number, id: number): Promise<CashbackRule | undefined>;
  createCashbackRule(rule: InsertCashbackRule): Promise<CashbackRule>;
  updateCashbackRule(
    tenantId: number,
    id: number,
    data: Partial<InsertCashbackRule>,
  ): Promise<CashbackRule | undefined>;
  deleteCashbackRule(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean>;

  // Cashback Transactions (tenant-scoped)
  getCashbackTransactions(
    tenantId: number,
    customerId?: number,
    limit?: number,
  ): Promise<CashbackTransaction[]>;
  getCustomerCashbackBalance(tenantId: number, customerId: number): Promise<number>;
  creditCashback(
    tenantId: number,
    input: CashbackLedgerInput,
    audit?: AuditContext,
  ): Promise<CashbackTransaction>;
  debitCashback(
    tenantId: number,
    input: CashbackLedgerInput,
    audit?: AuditContext,
  ): Promise<CashbackTransaction>;
  reverseCashback(
    tenantId: number,
    transactionId: number,
    idempotencyKey: string,
    audit?: AuditContext,
  ): Promise<CashbackTransaction>;
  expireCashback(
    tenantId: number,
    now?: string,
    audit?: AuditContext,
  ): Promise<CashbackTransaction[]>;
  reconcileCashback(
    tenantId: number,
    customerId?: number,
    audit?: AuditContext,
  ): Promise<
    Array<{
      customerId: number;
      accountBalanceCents: number;
      lotBalanceCents: number;
      ledgerBalanceCents: number;
      consistent: boolean;
    }>
  >;
  getCashbackDistribution(tenantId: number): Promise<{ range: string; count: number }[]>;
  getExpiringCashback(
    tenantId: number,
    daysAhead: number,
  ): Promise<{ customer: Customer; balance: number; expiresAt: string }[]>;

  // Campaigns (tenant-scoped)
  getCampaigns(tenantId: number): Promise<Campaign[]>;
  getCampaign(tenantId: number, id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(
    tenantId: number,
    id: number,
    data: Partial<InsertCampaign>,
  ): Promise<Campaign | undefined>;
  deleteCampaign(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean>;

  // Automations (tenant-scoped)
  getAutomations(tenantId: number): Promise<Automation[]>;
  getAutomation(tenantId: number, id: number): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
  updateAutomation(
    tenantId: number,
    id: number,
    data: Partial<InsertAutomation>,
  ): Promise<Automation | undefined>;
  deleteAutomation(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean>;

  // Contact Requests (global)
  getContactRequests(): Promise<ContactRequest[]>;
  createContactRequest(request: InsertContactRequest): Promise<ContactRequest>;
  updateContactRequestStatus(id: number, status: string): Promise<ContactRequest | undefined>;

  // Demo Requests (global)
  getDemoRequests(): Promise<DemoRequest[]>;
  createDemoRequest(request: InsertDemoRequest): Promise<DemoRequest>;
  updateDemoRequestStatus(id: number, status: string): Promise<DemoRequest | undefined>;

  // Tenant Stats (for admin reports)
  getTenantStats(): Promise<
    {
      tenantId: number;
      tenantName: string;
      usersCount: number;
      customersCount: number;
      ordersCount: number;
      productsCount: number;
    }[]
  >;

  // Seller Tasks (tenant-scoped)
  getSellerTasks(
    tenantId: number,
    filters?: {
      sellerId?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      type?: string;
    },
  ): Promise<(SellerTask & { customer?: Customer })[]>;
  getSellerTask(tenantId: number, id: number): Promise<SellerTask | undefined>;
  createSellerTask(task: InsertSellerTask): Promise<SellerTask>;
  updateSellerTask(
    tenantId: number,
    id: number,
    data: Partial<InsertSellerTask & { completedAt?: string }>,
  ): Promise<SellerTask | undefined>;
  deleteSellerTask(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean>;
  getSellerStats(
    tenantId: number,
    sellerId?: string,
  ): Promise<{ pending: number; completed: number; today: number; overdue: number }>;

  // Seller Goals (tenant-scoped)
  getSellerGoals(tenantId: number, sellerId?: string): Promise<SellerGoal | undefined>;
  upsertSellerGoals(goals: InsertSellerGoal): Promise<SellerGoal>;

  // Customer Interactions (tenant-scoped)
  getCustomerInteractions(
    tenantId: number,
    customerId?: number,
    sellerId?: string,
    limit?: number,
  ): Promise<(CustomerInteraction & { customer?: Customer; seller?: User })[]>;
  createCustomerInteraction(interaction: InsertCustomerInteraction): Promise<CustomerInteraction>;

  // Seller Ranking (tenant-scoped)
  getSellerRanking(
    tenantId: number,
    period: "daily" | "weekly" | "monthly",
  ): Promise<
    { sellerId: string; sellerName: string; completedTasks: number; totalInteractions: number }[]
  >;

  // Notifications (tenant-scoped)
  getNotifications(tenantId: number, userId?: string, limit?: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotificationStatus(id: number, status: string): Promise<Notification | undefined>;

  // Dashboard Stats (tenant-scoped)
  getDashboardStats(tenantId: number): Promise<{
    totalCustomers: number;
    totalRevenue: number;
    totalRevenueCents: number;
    totalOrders: number;
    averageTicket: number;
    averageTicketCents: number;
    vipCustomers: number;
    totalProducts: number;
    weeklyData: Array<{ name: string; total: number; totalCents: number }>;
    recentOrders: Order[];
    revenueGrowth: number;
    newCustomers: number;
    activeCustomers: number;
  }>;
  getDashboardCharts(tenantId: number): Promise<{
    revenueByMonth: { month: string; revenue: number; revenueCents: number }[];
    ordersByStatus: { status: string; count: number }[];
    customersBySegment: { segment: string; count: number }[];
    topProducts: { name: string; revenue: number; quantity: number }[];
  }>;
  getSalesReport(tenantId: number, options: ReportOptions): Promise<SalesReport>;

  // Customer 360 View (tenant-scoped)
  getCustomer360(
    tenantId: number,
    customerId: number,
  ): Promise<
    | {
        customer: Customer;
        totalOrders: number;
        totalSpent: number;
        totalSpentCents: number;
        averageOrderValue: number;
        averageOrderValueCents: number;
        lastOrder?: Order;
        cashbackBalance: number;
        interactions: CustomerInteraction[];
      }
    | undefined
  >;
  getCustomerOrderHistory(
    tenantId: number,
    customerId: number,
  ): Promise<{
    orders: Order[];
    totalOrders: number;
    totalSpent: number;
    totalSpentCents: number;
  }>;

  // Health Check
  healthCheck(): Promise<boolean>;
  deepHealthCheck(): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  private insertAuditEvent(event: AuditWriteInput): number {
    if (!event.requestId || event.requestId.length > 200) {
      throw new Error("A valid requestId is required for durable audit events");
    }
    const metadataJson = JSON.stringify(sanitizeAuditMetadata(event.action, event.metadata));
    const result = sqlite
      .prepare(
        `
      INSERT INTO audit_events(
        tenant_id,actor_user_id,action,target_type,target_id,outcome,request_id,metadata_json
      ) VALUES(?,?,?,?,?,?,?,?)
    `,
      )
      .run(
        event.tenantId ?? null,
        event.actorUserId ?? null,
        event.action,
        event.targetType,
        event.targetId == null ? null : String(event.targetId),
        event.outcome,
        event.requestId,
        metadataJson,
      );
    return Number(result.lastInsertRowid);
  }

  private mapAuditEvent(row: Record<string, unknown>): AuditEventView {
    return {
      id: Number(row.id),
      tenantId: row.tenant_id == null ? null : Number(row.tenant_id),
      actorUserId: row.actor_user_id == null ? null : String(row.actor_user_id),
      action: String(row.action),
      targetType: String(row.target_type),
      targetId: row.target_id == null ? null : String(row.target_id),
      outcome: String(row.outcome),
      requestId: String(row.request_id),
      createdAt: String(row.created_at),
      metadata: JSON.parse(String(row.metadata_json)) as Record<string, string | number | boolean>,
    };
  }

  private deleteTenantEntity(
    table:
      "customers" | "products" | "cashback_rules" | "campaigns" | "automations" | "seller_tasks",
    tenantId: number,
    id: number,
    audit?: AuditWriteInput,
  ): boolean {
    const transaction = sqlite.transaction(() => {
      const result = sqlite
        .prepare(`DELETE FROM ${table} WHERE tenant_id=? AND id=?`)
        .run(tenantId, id);
      if (result.changes === 0) return false;
      if (audit)
        this.insertAuditEvent({
          ...audit,
          tenantId,
          action: "entity.deleted",
          targetType: table,
          targetId: id,
          outcome: "success",
          metadata: { entityType: table },
        });
      return true;
    });
    return transaction();
  }

  async appendAuditEvent(event: AuditWriteInput): Promise<AuditEventView> {
    const id = this.insertAuditEvent(event);
    const row = sqlite.prepare("SELECT * FROM audit_events WHERE id=?").get(id) as Record<
      string,
      unknown
    >;
    return this.mapAuditEvent(row);
  }

  async getAuditEvents(options: {
    tenantId?: number;
    global?: boolean;
    limit: number;
    offset: number;
    action?: AuditAction;
    outcome?: "success" | "failure";
  }): Promise<{ data: AuditEventView[]; total: number }> {
    const conditions: string[] = [];
    const params: Array<string | number> = [];
    if (!options.global) {
      if (!options.tenantId) throw new Error("tenantId is required for tenant audit queries");
      conditions.push("tenant_id=?");
      params.push(options.tenantId);
    }
    if (options.action) {
      conditions.push("action=?");
      params.push(options.action);
    }
    if (options.outcome) {
      conditions.push("outcome=?");
      params.push(options.outcome);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = Number(
      (
        sqlite.prepare(`SELECT COUNT(*) AS count FROM audit_events ${where}`).get(...params) as {
          count: number;
        }
      ).count,
    );
    const rows = sqlite
      .prepare(`SELECT * FROM audit_events ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, options.limit, options.offset) as Record<string, unknown>[];
    return { data: rows.map((row) => this.mapAuditEvent(row)), total };
  }

  // ==================== USERS ====================
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Match the structural identity expression so legacy rows with surrounding
    // whitespace remain reachable without rewriting them during migration.
    const result = await db
      .select()
      .from(users)
      .where(sql`lower(trim(${users.email})) = ${normalizeEmail(email)}`);
    return result[0];
  }

  async getUserByCpf(cpf: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.cpf, cpf));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values({ ...user, email: normalizeEmail(user.email) })
      .returning();
    return result[0];
  }

  async registerSelfService(
    user: InsertUser,
    tenant: InsertTenant | undefined,
    audit: AuditWriteInput,
  ): Promise<{ user: User; tenant?: Tenant }> {
    const userId = randomUUID();
    const transaction = sqlite.transaction(() => {
      sqlite
        .prepare(
          `
        INSERT INTO users(id,email,cpf,seller_code,password,name,phone,is_super_admin,must_change_password,email_verified,status)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)
      `,
        )
        .run(
          userId,
          normalizeEmail(user.email),
          user.cpf ?? null,
          user.sellerCode ?? null,
          user.password,
          user.name,
          user.phone ?? null,
          user.isSuperAdmin ? 1 : 0,
          user.mustChangePassword ? 1 : 0,
          user.emailVerified ? 1 : 0,
          user.status ?? "active",
        );

      let tenantId: number | undefined;
      if (tenant) {
        const insertedTenant = sqlite
          .prepare(
            `
          INSERT INTO tenants(name,slug,plan,status,logo,primary_color,secondary_color,login_message)
          VALUES(?,?,?,?,?,?,?,?)
        `,
          )
          .run(
            tenant.name,
            tenant.slug,
            tenant.plan ?? "free",
            tenant.status ?? "active",
            tenant.logo ?? null,
            tenant.primaryColor ?? "#9333ea",
            tenant.secondaryColor ?? "#db2777",
            tenant.loginMessage ?? null,
          );
        tenantId = Number(insertedTenant.lastInsertRowid);
        sqlite
          .prepare(
            "INSERT INTO tenant_users(tenant_id,user_id,role,is_active) VALUES(?,?,'manager',1)",
          )
          .run(tenantId, userId);
      }
      this.insertAuditEvent({
        ...audit,
        tenantId,
        action: "auth.register",
        targetType: "user",
        targetId: userId,
        outcome: "success",
        metadata: { tenantCreated: Boolean(tenantId) },
      });
      return tenantId;
    });
    const tenantId = transaction();
    const createdUser = await this.getUser(userId);
    const createdTenant = tenantId ? await this.getTenant(tenantId) : undefined;
    if (!createdUser) throw new Error("Atomic registration did not return its user");
    return { user: createdUser, tenant: createdTenant };
  }

  async createUserWithMembership(
    user: InsertUser,
    tenantId: number | undefined,
    role: string | undefined,
    audit?: AuditWriteInput,
  ): Promise<{ user: User; membership?: TenantUser }> {
    const userId = randomUUID();
    const transaction = sqlite.transaction(() => {
      sqlite
        .prepare(
          `
        INSERT INTO users(id,email,cpf,seller_code,password,name,phone,is_super_admin,must_change_password,email_verified,status)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)
      `,
        )
        .run(
          userId,
          normalizeEmail(user.email),
          user.cpf ?? null,
          user.sellerCode ?? null,
          user.password,
          user.name,
          user.phone ?? null,
          user.isSuperAdmin ? 1 : 0,
          user.mustChangePassword ? 1 : 0,
          user.emailVerified ? 1 : 0,
          user.status ?? "active",
        );
      if (tenantId) {
        sqlite
          .prepare("INSERT INTO tenant_users(tenant_id,user_id,role,is_active) VALUES(?,?,?,1)")
          .run(tenantId, userId, role ?? "seller");
      }
      if (audit) {
        this.insertAuditEvent({ ...audit, targetId: userId });
      }
    });
    transaction();
    const createdUser = await this.getUser(userId);
    const membership = tenantId ? await this.getTenantUser(tenantId, userId) : undefined;
    if (!createdUser) throw new Error("Atomic team creation did not return its user");
    return { user: createdUser, membership };
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const normalizedData =
      data.email === undefined ? data : { ...data, email: normalizeEmail(data.email) };
    const result = await db.update(users).set(normalizedData).where(eq(users.id, id)).returning();
    return result[0];
  }

  async updateUserBySuperAdmin(
    id: string,
    data: { name?: string; email?: string; isSuperAdmin?: boolean; hashedPassword?: string },
    audit: AuditContext,
  ): Promise<User | undefined> {
    const transaction = sqlite.transaction(() => {
      const existing = sqlite.prepare("SELECT 1 FROM users WHERE id=?").get(id);
      if (!existing) return false;
      if (data.name !== undefined)
        sqlite.prepare("UPDATE users SET name=? WHERE id=?").run(data.name, id);
      if (data.email !== undefined)
        sqlite.prepare("UPDATE users SET email=? WHERE id=?").run(normalizeEmail(data.email), id);
      if (data.isSuperAdmin !== undefined)
        sqlite
          .prepare("UPDATE users SET is_super_admin=? WHERE id=?")
          .run(data.isSuperAdmin ? 1 : 0, id);
      if (data.hashedPassword !== undefined) {
        sqlite
          .prepare(
            "UPDATE users SET password=?,must_change_password=1,last_password_change=? WHERE id=?",
          )
          .run(data.hashedPassword, new Date().toISOString(), id);
      }
      sqlite.prepare("UPDATE users SET updated_at=datetime('now') WHERE id=?").run(id);

      const identityFields = [
        data.name !== undefined && "name",
        data.email !== undefined && "email",
      ]
        .filter(Boolean)
        .join(",");
      if (identityFields)
        this.insertAuditEvent({
          ...audit,
          action: "identity.updated",
          targetType: "user",
          targetId: id,
          outcome: "success",
          metadata: { fields: identityFields },
        });
      if (data.isSuperAdmin !== undefined)
        this.insertAuditEvent({
          ...audit,
          action: "global_role.changed",
          targetType: "user",
          targetId: id,
          outcome: "success",
          metadata: { role: data.isSuperAdmin ? "super_admin" : "user" },
        });
      if (data.hashedPassword !== undefined)
        this.insertAuditEvent({
          ...audit,
          action: "auth.password_changed",
          targetType: "user",
          targetId: id,
          outcome: "success",
          metadata: { resetType: "super_admin" },
        });
      return true;
    });
    return transaction() ? this.getUser(id) : undefined;
  }

  async updateUserPassword(
    id: string,
    hashedPassword: string,
    mustChangePassword = false,
  ): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({
        password: hashedPassword,
        mustChangePassword,
        lastPasswordChange: new Date().toISOString(),
      })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateUserPasswordAudited(
    id: string,
    hashedPassword: string,
    mustChangePassword: boolean,
    audit: AuditWriteInput,
  ): Promise<User | undefined> {
    const transaction = sqlite.transaction(() => {
      const result = sqlite
        .prepare(
          `
        UPDATE users SET password=?,must_change_password=?,last_password_change=?,updated_at=datetime('now')
        WHERE id=?
      `,
        )
        .run(hashedPassword, mustChangePassword ? 1 : 0, new Date().toISOString(), id);
      if (result.changes === 0) return false;
      this.insertAuditEvent({ ...audit, targetId: id });
      return true;
    });
    return transaction() ? this.getUser(id) : undefined;
  }

  async deleteUser(id: string, audit?: AuditWriteInput): Promise<boolean> {
    return sqlite.transaction(() => {
      const result = sqlite.prepare("DELETE FROM users WHERE id=?").run(id);
      if (result.changes === 0) return false;
      if (audit)
        this.insertAuditEvent({
          ...audit,
          action: "entity.deleted",
          targetType: "users",
          targetId: id,
          outcome: "success",
          metadata: { entityType: "users" },
        });
      return true;
    })();
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
    const result = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)));
    return result[0];
  }

  async createTenantUser(tenantUser: InsertTenantUser): Promise<TenantUser> {
    const result = await db.insert(tenantUsers).values(tenantUser).returning();
    return result[0];
  }

  async updateTenantUserRole(
    tenantId: number,
    userId: string,
    role: string,
  ): Promise<TenantUser | undefined> {
    const result = await db
      .update(tenantUsers)
      .set({ role })
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
      .returning();
    return result[0];
  }

  async upsertTenantUserAudited(
    tenantId: number,
    userId: string,
    role: string,
    audit: AuditWriteInput,
  ): Promise<TenantUser> {
    const transaction = sqlite.transaction(() => {
      const existing = sqlite
        .prepare("SELECT id FROM tenant_users WHERE tenant_id=? AND user_id=?")
        .get(tenantId, userId) as { id: number } | undefined;
      if (existing) {
        sqlite
          .prepare(
            "UPDATE tenant_users SET role=?,is_active=1,updated_at=datetime('now') WHERE id=?",
          )
          .run(role, existing.id);
      } else {
        sqlite
          .prepare("INSERT INTO tenant_users(tenant_id,user_id,role,is_active) VALUES(?,?,?,1)")
          .run(tenantId, userId, role);
      }
      this.insertAuditEvent({
        ...audit,
        tenantId,
        action: existing ? "membership.role_changed" : "membership.created",
        targetType: "membership",
        targetId: userId,
        metadata: { role },
      });
    });
    transaction();
    const membership = await this.getTenantUser(tenantId, userId);
    if (!membership) throw new Error("Atomic membership update did not return its membership");
    return membership;
  }

  async deleteTenantUser(tenantId: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async deleteTenantUserAudited(
    tenantId: number,
    userId: string,
    audit: AuditWriteInput,
  ): Promise<boolean> {
    const transaction = sqlite.transaction(() => {
      const result = sqlite
        .prepare("DELETE FROM tenant_users WHERE tenant_id=? AND user_id=?")
        .run(tenantId, userId);
      if (result.changes === 0) return false;
      this.insertAuditEvent({
        ...audit,
        tenantId,
        action: "membership.removed",
        targetType: "membership",
        targetId: userId,
      });
      return true;
    });
    return transaction();
  }

  async deleteTenant(id: number, audit?: AuditWriteInput): Promise<boolean> {
    return sqlite.transaction(() => {
      const result = sqlite.prepare("DELETE FROM tenants WHERE id=?").run(id);
      if (result.changes === 0) return false;
      if (audit)
        this.insertAuditEvent({
          ...audit,
          tenantId: id,
          action: "entity.deleted",
          targetType: "tenants",
          targetId: id,
          outcome: "success",
          metadata: { entityType: "tenants" },
        });
      return true;
    })();
  }

  // ==================== CUSTOMERS ====================
  async getCustomers(
    tenantId: number,
    options: CustomerListOptions = {},
  ): Promise<{ data: Customer[]; total: number }> {
    const conditions = [eq(customers.tenantId, tenantId)];
    if (options.search) {
      conditions.push(
        or(
          sql`instr(lower(${customers.name}), lower(${options.search})) > 0`,
          sql`instr(lower(${customers.email}), lower(${options.search})) > 0`,
          sql`instr(lower(coalesce(${customers.phone}, '')), lower(${options.search})) > 0`,
          sql`instr(lower(coalesce(${customers.favoriteCategory}, '')), lower(${options.search})) > 0`,
        )!,
      );
    }
    if (options.segment) {
      conditions.push(eq(customers.segment, options.segment));
    }
    const condition = and(...conditions)!;
    const sortColumn = options.sort === "name" ? customers.name : customers.name;
    const sortDirection = options.order === "desc" ? desc : asc;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(condition);
    const total = Number(countResult[0]?.count || 0);

    // Get paginated data
    const dataQuery = db
      .select()
      .from(customers)
      .where(condition)
      .orderBy(sortDirection(sortColumn), asc(customers.id));
    const data =
      options.limit !== undefined
        ? await dataQuery.limit(options.limit).offset(options.offset ?? 0)
        : await dataQuery;

    return { data, total };
  }

  async getCustomer(tenantId: number, id: number): Promise<Customer | undefined> {
    const result = await db
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)));
    return result[0];
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const ltv = customer.ltv ?? 0;
    // The insert and the automation jobs it triggers share one transaction so an
    // automation can never fire for a customer that was rolled back (ADR 0001).
    return sqlite.transaction(() => {
      const created = db
        .insert(customers)
        .values({
          ...customer,
          ltv,
          ltvCents: moneyToCents(ltv, "customer.ltv"),
        })
        .returning()
        .all()[0];

      enqueueAutomationJobsForEvent({
        tenantId: created.tenantId,
        triggerType: "customer.created",
        referenceId: created.id,
      });

      return created;
    })();
  }

  async updateCustomer(
    tenantId: number,
    id: number,
    data: Partial<InsertCustomer>,
  ): Promise<Customer | undefined> {
    const { tenantId: _ignoredTenantId, ltvCents: _ignoredLtvCents, ...safeData } = data;
    const dualWriteData =
      safeData.ltv === undefined
        ? safeData
        : { ...safeData, ltvCents: moneyToCents(safeData.ltv, "customer.ltv") };
    const result = await db
      .update(customers)
      .set(dualWriteData)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .returning();
    return result[0];
  }

  async deleteCustomer(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean> {
    return this.deleteTenantEntity("customers", tenantId, id, audit);
  }

  // ==================== PRODUCTS ====================
  async getProducts(
    tenantId: number,
    options: ProductListOptions = {},
  ): Promise<{ data: Product[]; total: number }> {
    const conditions = [eq(products.tenantId, tenantId)];
    if (options.search) {
      conditions.push(
        or(
          sql`instr(lower(${products.name}), lower(${options.search})) > 0`,
          sql`instr(lower(${products.category}), lower(${options.search})) > 0`,
        )!,
      );
    }
    if (options.status) {
      conditions.push(eq(products.status, options.status));
    }
    const condition = and(...conditions)!;
    const sortColumn = options.sort === "name" ? products.name : products.name;
    const sortDirection = options.order === "desc" ? desc : asc;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(condition);
    const total = Number(countResult[0]?.count || 0);

    // Get paginated data
    const dataQuery = db
      .select()
      .from(products)
      .where(condition)
      .orderBy(sortDirection(sortColumn), asc(products.id));
    const data =
      options.limit !== undefined
        ? await dataQuery.limit(options.limit).offset(options.offset ?? 0)
        : await dataQuery;

    return { data, total };
  }

  async getProduct(tenantId: number, id: number): Promise<Product | undefined> {
    const result = await db
      .select()
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)));
    return result[0];
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const price = product.price ?? 0;
    const result = await db
      .insert(products)
      .values({
        ...product,
        price,
        priceCents: moneyToCents(price, "product.price"),
      })
      .returning();
    return result[0];
  }

  async updateProduct(
    tenantId: number,
    id: number,
    data: Partial<InsertProduct>,
  ): Promise<Product | undefined> {
    const { tenantId: _ignoredTenantId, priceCents: _ignoredPriceCents, ...safeData } = data;
    const dualWriteData =
      safeData.price === undefined
        ? safeData
        : { ...safeData, priceCents: moneyToCents(safeData.price, "product.price") };
    const result = await db
      .update(products)
      .set(dualWriteData)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
      .returning();
    return result[0];
  }

  async deleteProduct(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean> {
    return this.deleteTenantEntity("products", tenantId, id, audit);
  }

  // ==================== ORDERS ====================
  async getOrders(
    tenantId: number,
    options: OrderListOptions = {},
  ): Promise<{ data: Order[]; total: number }> {
    const conditions = [eq(orders.tenantId, tenantId)];
    if (options.search) {
      conditions.push(
        or(
          sql`instr(lower(${orders.orderId}), lower(${options.search})) > 0`,
          sql`instr(lower(${orders.customer}), lower(${options.search})) > 0`,
          sql`instr(lower(${orders.method}), lower(${options.search})) > 0`,
        )!,
      );
    }
    if (options.status) {
      conditions.push(eq(orders.status, options.status));
    }
    const condition = and(...conditions)!;
    const sortColumn = options.sort === "orderDate" ? orders.orderDate : orders.orderDate;
    const sortDirection = options.order === "asc" ? asc : desc;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(condition);
    const total = Number(countResult[0]?.count || 0);

    // Get paginated data
    const dataQuery = db
      .select()
      .from(orders)
      .where(condition)
      .orderBy(sortDirection(sortColumn), asc(orders.id));
    const data =
      options.limit !== undefined
        ? await dataQuery.limit(options.limit).offset(options.offset ?? 0)
        : await dataQuery;

    return { data, total };
  }

  async getOrder(tenantId: number, id: number): Promise<Order | undefined> {
    const result = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)));
    return result[0];
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    if (order.customerId && !(await this.getCustomer(order.tenantId, order.customerId))) {
      throw new Error("Invalid tenant-scoped customer reference");
    }
    const total = order.total ?? 0;
    const result = await db
      .insert(orders)
      .values({
        ...order,
        total,
        totalCents: moneyToCents(total, "order.total"),
        status: order.status ?? "Pendente",
      })
      .returning();
    return result[0];
  }

  async createOrderWithLineItems(input: CreateOrderWithLineItemsInput): Promise<Order> {
    if (input.lineItems.length === 0 || input.status === "Cancelado") {
      throw new Error("Transactional orders require line items and a non-cancelled initial status");
    }
    const aggregate = new Map<number, number>();
    for (const item of input.lineItems) {
      if (
        !Number.isSafeInteger(item.productId) ||
        item.productId <= 0 ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        throw new Error("Order line item identifiers and quantities must be positive integers");
      }
      aggregate.set(item.productId, (aggregate.get(item.productId) ?? 0) + item.quantity);
    }

    const createdOrderId = sqlite.transaction(() => {
      if (input.customerId) {
        const customer = sqlite
          .prepare("SELECT 1 FROM customers WHERE id = ? AND tenant_id = ?")
          .get(input.customerId, input.tenantId);
        if (!customer) {
          throw new OrderDomainError(
            "INVALID_TENANT_REFERENCE",
            "Cliente inválido para este tenant",
          );
        }
      }

      const snapshots: Array<{
        productId: number;
        categorySnapshot: string;
        quantity: number;
        unitPriceCents: number;
      }> = [];
      let totalCents = 0;
      let totalQuantity = 0;

      for (const [productId, quantity] of Array.from(aggregate.entries())) {
        const product = sqlite
          .prepare(
            "SELECT id, price_cents AS priceCents, category, stock FROM products WHERE id = ? AND tenant_id = ?",
          )
          .get(productId, input.tenantId) as
          { id: number; priceCents: number; category: string; stock: number } | undefined;
        if (!product) {
          throw new OrderDomainError(
            "INVALID_TENANT_REFERENCE",
            "Produto inválido para este tenant",
          );
        }

        const unitPriceCents = product.priceCents;
        const lineTotalCents = unitPriceCents * quantity;
        if (
          !Number.isSafeInteger(unitPriceCents) ||
          unitPriceCents < 0 ||
          !Number.isSafeInteger(lineTotalCents)
        ) {
          throw new Error("Product price cannot be represented safely in cents");
        }
        totalCents += lineTotalCents;
        totalQuantity += quantity;
        if (!Number.isSafeInteger(totalCents) || !Number.isSafeInteger(totalQuantity)) {
          throw new Error("Order totals exceed supported integer range");
        }
        snapshots.push({
          productId,
          categorySnapshot: product.category.trim() || "Outros",
          quantity,
          unitPriceCents,
        });
      }

      for (const snapshot of snapshots) {
        const stockUpdate = sqlite
          .prepare(
            `
          UPDATE products
          SET stock = stock - ?, updated_at = datetime('now')
          WHERE id = ? AND tenant_id = ? AND stock >= ?
        `,
          )
          .run(snapshot.quantity, snapshot.productId, input.tenantId, snapshot.quantity);
        if (stockUpdate.changes !== 1) {
          throw new OrderDomainError(
            "INSUFFICIENT_STOCK",
            "Estoque insuficiente para um ou mais produtos",
          );
        }
      }

      const publicOrderId = `ORD-${randomUUID()}`;
      const orderInsert = sqlite
        .prepare(
          `
        INSERT INTO orders (
          tenant_id, order_id, customer_id, customer, order_date,
          total, total_cents, status, items, method
        ) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?, ?, ?)
      `,
        )
        .run(
          input.tenantId,
          publicOrderId,
          input.customerId ?? null,
          input.customer,
          input.orderDate ?? null,
          totalCents / 100,
          totalCents,
          input.status ?? "Pendente",
          totalQuantity,
          input.method,
        );
      const orderPk = Number(orderInsert.lastInsertRowid);

      const insertItem = sqlite.prepare(`
        INSERT INTO order_items (
          tenant_id, order_id, product_id, category_snapshot, quantity, unit_price_cents, line_total_cents
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const snapshot of snapshots) {
        insertItem.run(
          input.tenantId,
          orderPk,
          snapshot.productId,
          snapshot.categorySnapshot,
          snapshot.quantity,
          snapshot.unitPriceCents,
          snapshot.unitPriceCents * snapshot.quantity,
        );
      }

      // Same transaction as the order and the stock movement (ADR 0001).
      enqueueAutomationJobsForEvent({
        tenantId: input.tenantId,
        triggerType: "order.created",
        referenceId: orderPk,
      });

      return orderPk;
    })();

    const created = await this.getOrder(input.tenantId, createdOrderId);
    if (!created) throw new Error("Created order could not be loaded");
    return created;
  }

  async getOrderItems(tenantId: number, orderId: number): Promise<OrderItem[]> {
    return await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, orderId)));
  }

  async cancelOrder(
    tenantId: number,
    id: number,
    audit?: AuditWriteInput,
  ): Promise<Order | undefined> {
    const found = sqlite.transaction(() => {
      const order = sqlite
        .prepare("SELECT id, status FROM orders WHERE id = ? AND tenant_id = ?")
        .get(id, tenantId) as { id: number; status: string } | undefined;
      if (!order) return false;
      if (order.status === "Cancelado") return true;

      const items = sqlite
        .prepare(
          `
        SELECT product_id AS productId, quantity
        FROM order_items WHERE order_id = ? AND tenant_id = ?
      `,
        )
        .all(id, tenantId) as Array<{ productId: number; quantity: number }>;
      for (const item of items) {
        const restored = sqlite
          .prepare(
            `
          UPDATE products SET stock = stock + ?, updated_at = datetime('now')
          WHERE id = ? AND tenant_id = ?
        `,
          )
          .run(item.quantity, item.productId, tenantId);
        if (restored.changes !== 1) {
          throw new Error("Unable to restore stock for cancelled order");
        }
      }

      sqlite
        .prepare(
          `
        UPDATE orders SET status = 'Cancelado', updated_at = datetime('now')
        WHERE id = ? AND tenant_id = ?
      `,
        )
        .run(id, tenantId);
      if (audit)
        this.insertAuditEvent({
          ...audit,
          tenantId,
          action: "order.cancelled",
          targetType: "orders",
          targetId: id,
          outcome: "success",
        });
      return true;
    })();

    return found ? this.getOrder(tenantId, id) : undefined;
  }

  async updateOrder(
    tenantId: number,
    id: number,
    data: Partial<InsertOrder>,
  ): Promise<Order | undefined> {
    if (data.status === "Cancelado") {
      return this.cancelOrder(tenantId, id);
    }
    const existing = await this.getOrder(tenantId, id);
    if (!existing) return undefined;
    if (existing.status === "Cancelado" && data.status !== undefined) {
      throw new OrderDomainError(
        "ORDER_ALREADY_CANCELLED",
        "Pedido cancelado não pode ser reativado",
      );
    }
    const {
      tenantId: _ignoredTenantId,
      orderId: _ignoredOrderId,
      total: _ignoredTotal,
      totalCents: _ignoredTotalCents,
      items: _ignoredItems,
      lineItems: _ignoredLineItems,
      ...safeData
    } = data as Partial<InsertOrder> & { lineItems?: unknown };
    if (Object.keys(safeData).length === 0) return existing;
    const result = await db
      .update(orders)
      .set(safeData)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)))
      .returning();
    return result[0];
  }

  async deleteOrder(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean> {
    return Boolean(await this.cancelOrder(tenantId, id, audit));
  }

  // ==================== CASHBACK RULES ====================
  async getCashbackRules(tenantId: number): Promise<CashbackRule[]> {
    return await db.select().from(cashbackRules).where(eq(cashbackRules.tenantId, tenantId));
  }

  async getCashbackRule(tenantId: number, id: number): Promise<CashbackRule | undefined> {
    const result = await db
      .select()
      .from(cashbackRules)
      .where(and(eq(cashbackRules.tenantId, tenantId), eq(cashbackRules.id, id)));
    return result[0];
  }

  async createCashbackRule(rule: InsertCashbackRule): Promise<CashbackRule> {
    const result = await db.insert(cashbackRules).values(rule).returning();
    return result[0];
  }

  async updateCashbackRule(
    tenantId: number,
    id: number,
    data: Partial<InsertCashbackRule>,
  ): Promise<CashbackRule | undefined> {
    const result = await db
      .update(cashbackRules)
      .set(data)
      .where(and(eq(cashbackRules.tenantId, tenantId), eq(cashbackRules.id, id)))
      .returning();
    return result[0];
  }

  async deleteCashbackRule(
    tenantId: number,
    id: number,
    audit?: AuditWriteInput,
  ): Promise<boolean> {
    return this.deleteTenantEntity("cashback_rules", tenantId, id, audit);
  }

  // ==================== CASHBACK TRANSACTIONS ====================
  async getCashbackTransactions(
    tenantId: number,
    customerId?: number,
    limit?: number,
  ): Promise<CashbackTransaction[]> {
    const conditions = [eq(cashbackTransactions.tenantId, tenantId)];
    if (customerId) {
      conditions.push(eq(cashbackTransactions.customerId, customerId));
    }

    const query = db
      .select()
      .from(cashbackTransactions)
      .where(and(...conditions))
      .orderBy(desc(cashbackTransactions.createdAt));

    return limit ? await query.limit(limit) : await query;
  }

  private cashbackRequestHash(kind: string, input: unknown): string {
    return createHash("sha256").update(JSON.stringify({ kind, input })).digest("hex");
  }

  private loadCashbackTransaction(tenantId: number, id: number): CashbackTransaction {
    const transaction = db
      .select()
      .from(cashbackTransactions)
      .where(and(eq(cashbackTransactions.tenantId, tenantId), eq(cashbackTransactions.id, id)))
      .get();
    if (!transaction) throw new Error("Cashback transaction could not be loaded");
    return transaction;
  }

  private validateCashbackReferences(tenantId: number, input: CashbackLedgerInput) {
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0)
      throw new Error("amountCents must be a positive safe integer");
    if (!input.idempotencyKey || input.idempotencyKey.length > 200)
      throw new Error("Invalid idempotency key");
    if (
      !sqlite
        .prepare("SELECT 1 FROM customers WHERE id=? AND tenant_id=?")
        .get(input.customerId, tenantId)
    ) {
      throw new CashbackLedgerError(
        "INVALID_TENANT_REFERENCE",
        "Cliente inválido para este tenant",
      );
    }
    if (
      input.ruleId &&
      !sqlite
        .prepare("SELECT 1 FROM cashback_rules WHERE id=? AND tenant_id=?")
        .get(input.ruleId, tenantId)
    ) {
      throw new CashbackLedgerError("INVALID_TENANT_REFERENCE", "Regra inválida para este tenant");
    }
    if (
      input.orderId &&
      !sqlite
        .prepare("SELECT 1 FROM orders WHERE id=? AND tenant_id=?")
        .get(input.orderId, tenantId)
    ) {
      throw new CashbackLedgerError("INVALID_TENANT_REFERENCE", "Pedido inválido para este tenant");
    }
  }

  private existingCashbackIdempotency(
    tenantId: number,
    key: string,
    hash: string,
  ): number | undefined {
    const existing = sqlite
      .prepare(
        "SELECT id,request_hash AS requestHash FROM cashback_transactions WHERE tenant_id=? AND idempotency_key=?",
      )
      .get(tenantId, key) as { id: number; requestHash: string | null } | undefined;
    if (!existing) return undefined;
    if (existing.requestHash !== hash)
      throw new CashbackLedgerError(
        "IDEMPOTENCY_CONFLICT",
        "Chave de idempotência reutilizada com payload diferente",
      );
    return existing.id;
  }

  async creditCashback(
    tenantId: number,
    input: CashbackLedgerInput,
    audit?: AuditContext,
  ): Promise<CashbackTransaction> {
    const hash = this.cashbackRequestHash("credit", input);
    const transactionId = sqlite.transaction(() => {
      const existing = this.existingCashbackIdempotency(tenantId, input.idempotencyKey, hash);
      if (existing) return existing;
      this.validateCashbackReferences(tenantId, input);
      sqlite
        .prepare(
          "INSERT OR IGNORE INTO cashback_accounts(tenant_id,customer_id,balance_cents) VALUES(?,?,0)",
        )
        .run(tenantId, input.customerId);
      const account = sqlite
        .prepare(
          "SELECT balance_cents AS balanceCents FROM cashback_accounts WHERE tenant_id=? AND customer_id=?",
        )
        .get(tenantId, input.customerId) as { balanceCents: number };
      const balanceCents = account.balanceCents + input.amountCents;
      const inserted = sqlite
        .prepare(
          `INSERT INTO cashback_transactions(tenant_id,customer_id,rule_id,order_id,type,amount,balance,amount_cents,balance_cents,idempotency_key,request_hash,source,description,expires_at)
        VALUES(?,?,?,?, 'credit',?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          tenantId,
          input.customerId,
          input.ruleId ?? null,
          input.orderId ?? null,
          input.amountCents / 100,
          balanceCents / 100,
          input.amountCents,
          balanceCents,
          input.idempotencyKey,
          hash,
          input.source,
          input.description,
          input.expiresAt ?? null,
        );
      const id = Number(inserted.lastInsertRowid);
      sqlite
        .prepare(
          "UPDATE cashback_accounts SET balance_cents=?,updated_at=datetime('now') WHERE tenant_id=? AND customer_id=?",
        )
        .run(balanceCents, tenantId, input.customerId);
      sqlite
        .prepare(
          "INSERT INTO cashback_credit_lots(tenant_id,customer_id,credit_transaction_id,original_cents,remaining_cents,expires_at) VALUES(?,?,?,?,?,?)",
        )
        .run(
          tenantId,
          input.customerId,
          id,
          input.amountCents,
          input.amountCents,
          input.expiresAt ?? null,
        );
      if (audit)
        this.insertAuditEvent({
          ...audit,
          tenantId,
          action: "cashback.credited",
          targetType: "cashback_transaction",
          targetId: id,
          outcome: "success",
          metadata: { amountCents: input.amountCents, transactionId: id },
        });
      return id;
    })();
    return this.loadCashbackTransaction(tenantId, transactionId);
  }

  async debitCashback(
    tenantId: number,
    input: CashbackLedgerInput,
    audit?: AuditContext,
  ): Promise<CashbackTransaction> {
    const hash = this.cashbackRequestHash("debit", input);
    const transactionId = sqlite.transaction(() => {
      const existing = this.existingCashbackIdempotency(tenantId, input.idempotencyKey, hash);
      if (existing) return existing;
      this.validateCashbackReferences(tenantId, input);
      const account = sqlite
        .prepare(
          "SELECT balance_cents AS balanceCents FROM cashback_accounts WHERE tenant_id=? AND customer_id=?",
        )
        .get(tenantId, input.customerId) as { balanceCents: number } | undefined;
      if (!account || account.balanceCents < input.amountCents)
        throw new CashbackLedgerError("INSUFFICIENT_CASHBACK", "Saldo de cashback insuficiente");
      const lots = sqlite
        .prepare(
          `SELECT id,remaining_cents AS remainingCents FROM cashback_credit_lots WHERE tenant_id=? AND customer_id=? AND remaining_cents>0 AND (expires_at IS NULL OR datetime(expires_at)>datetime('now')) ORDER BY COALESCE(datetime(expires_at),'9999-12-31'),created_at,id`,
        )
        .all(tenantId, input.customerId) as Array<{ id: number; remainingCents: number }>;
      if (lots.reduce((sum, lot) => sum + lot.remainingCents, 0) < input.amountCents)
        throw new CashbackLedgerError(
          "INSUFFICIENT_CASHBACK",
          "Saldo disponível em lotes é insuficiente",
        );
      const balanceCents = account.balanceCents - input.amountCents;
      const inserted = sqlite
        .prepare(
          `INSERT INTO cashback_transactions(tenant_id,customer_id,rule_id,order_id,type,amount,balance,amount_cents,balance_cents,idempotency_key,request_hash,source,description)
        VALUES(?,?,?,?, 'debit',?,?,?,?,?,?,?,?)`,
        )
        .run(
          tenantId,
          input.customerId,
          input.ruleId ?? null,
          input.orderId ?? null,
          input.amountCents / 100,
          balanceCents / 100,
          input.amountCents,
          balanceCents,
          input.idempotencyKey,
          hash,
          input.source,
          input.description,
        );
      const id = Number(inserted.lastInsertRowid);
      let remaining = input.amountCents;
      for (const lot of lots) {
        if (!remaining) break;
        const used = Math.min(remaining, lot.remainingCents);
        sqlite
          .prepare(
            "UPDATE cashback_credit_lots SET remaining_cents=remaining_cents-? WHERE id=? AND tenant_id=?",
          )
          .run(used, lot.id, tenantId);
        sqlite
          .prepare(
            "INSERT INTO cashback_debit_allocations(tenant_id,debit_transaction_id,credit_lot_id,amount_cents) VALUES(?,?,?,?)",
          )
          .run(tenantId, id, lot.id, used);
        remaining -= used;
      }
      sqlite
        .prepare(
          "UPDATE cashback_accounts SET balance_cents=?,updated_at=datetime('now') WHERE tenant_id=? AND customer_id=?",
        )
        .run(balanceCents, tenantId, input.customerId);
      if (audit)
        this.insertAuditEvent({
          ...audit,
          tenantId,
          action: "cashback.debited",
          targetType: "cashback_transaction",
          targetId: id,
          outcome: "success",
          metadata: { amountCents: input.amountCents, transactionId: id },
        });
      return id;
    })();
    return this.loadCashbackTransaction(tenantId, transactionId);
  }

  async reverseCashback(
    tenantId: number,
    transactionId: number,
    idempotencyKey: string,
    audit?: AuditContext,
  ): Promise<CashbackTransaction> {
    const hash = this.cashbackRequestHash("reversal", { transactionId, idempotencyKey });
    const reversalId = sqlite.transaction(() => {
      const existing = this.existingCashbackIdempotency(tenantId, idempotencyKey, hash);
      if (existing) return existing;
      const original = sqlite
        .prepare("SELECT * FROM cashback_transactions WHERE id=? AND tenant_id=?")
        .get(transactionId, tenantId) as any;
      if (!original)
        throw new CashbackLedgerError("TRANSACTION_NOT_FOUND", "Transação não encontrada");
      if (original.reversal_of_id || original.source === "reversal")
        throw new CashbackLedgerError(
          "REVERSAL_NOT_ALLOWED",
          "Reversão de reversão não é permitida",
        );
      const prior = sqlite
        .prepare("SELECT id FROM cashback_transactions WHERE tenant_id=? AND reversal_of_id=?")
        .get(tenantId, transactionId) as { id: number } | undefined;
      if (prior) return prior.id;
      const account = sqlite
        .prepare(
          "SELECT balance_cents AS balanceCents FROM cashback_accounts WHERE tenant_id=? AND customer_id=?",
        )
        .get(tenantId, original.customer_id) as { balanceCents: number };
      const reversalType = original.type === "credit" ? "debit" : "credit";
      let balanceCents: number;
      if (original.type === "credit") {
        const lot = sqlite
          .prepare(
            "SELECT id,original_cents AS originalCents,remaining_cents AS remainingCents FROM cashback_credit_lots WHERE credit_transaction_id=? AND tenant_id=?",
          )
          .get(transactionId, tenantId) as any;
        if (
          !lot ||
          lot.remainingCents !== lot.originalCents ||
          account.balanceCents < original.amount_cents
        )
          throw new CashbackLedgerError(
            "REVERSAL_NOT_ALLOWED",
            "Crédito já consumido não pode ser revertido",
          );
        balanceCents = account.balanceCents - original.amount_cents;
        sqlite.prepare("UPDATE cashback_credit_lots SET remaining_cents=0 WHERE id=?").run(lot.id);
      } else {
        const expiredAllocation = sqlite
          .prepare(
            "SELECT 1 FROM cashback_debit_allocations a JOIN cashback_credit_lots l ON l.id=a.credit_lot_id WHERE a.debit_transaction_id=? AND a.tenant_id=? AND l.expires_at IS NOT NULL AND datetime(l.expires_at)<=datetime('now') LIMIT 1",
          )
          .get(transactionId, tenantId);
        if (expiredAllocation)
          throw new CashbackLedgerError(
            "REVERSAL_NOT_ALLOWED",
            "Débito alocado a crédito já expirado não pode ser revertido",
          );
        balanceCents = account.balanceCents + original.amount_cents;
        const allocations = sqlite
          .prepare(
            "SELECT credit_lot_id AS lotId,amount_cents AS amountCents FROM cashback_debit_allocations WHERE debit_transaction_id=? AND tenant_id=?",
          )
          .all(transactionId, tenantId) as any[];
        for (const allocation of allocations)
          sqlite
            .prepare(
              "UPDATE cashback_credit_lots SET remaining_cents=remaining_cents+? WHERE id=? AND tenant_id=?",
            )
            .run(allocation.amountCents, allocation.lotId, tenantId);
      }
      const inserted = sqlite
        .prepare(
          `INSERT INTO cashback_transactions(tenant_id,customer_id,type,amount,balance,amount_cents,balance_cents,idempotency_key,request_hash,source,reversal_of_id,description) VALUES(?,?,?, ?,?,?,?,?,?,'reversal',?,'Reversão de cashback')`,
        )
        .run(
          tenantId,
          original.customer_id,
          reversalType,
          original.amount_cents / 100,
          balanceCents / 100,
          original.amount_cents,
          balanceCents,
          idempotencyKey,
          hash,
          transactionId,
        );
      sqlite
        .prepare(
          "UPDATE cashback_accounts SET balance_cents=?,updated_at=datetime('now') WHERE tenant_id=? AND customer_id=?",
        )
        .run(balanceCents, tenantId, original.customer_id);
      const id = Number(inserted.lastInsertRowid);
      if (audit)
        this.insertAuditEvent({
          ...audit,
          tenantId,
          action: "cashback.reversed",
          targetType: "cashback_transaction",
          targetId: transactionId,
          outcome: "success",
          metadata: { transactionId, reversalTransactionId: id },
        });
      return id;
    })();
    return this.loadCashbackTransaction(tenantId, reversalId);
  }

  async expireCashback(
    tenantId: number,
    now = new Date().toISOString(),
    audit?: AuditContext,
  ): Promise<CashbackTransaction[]> {
    const ids = sqlite.transaction(() => {
      const lots = sqlite
        .prepare(
          "SELECT id,customer_id AS customerId,remaining_cents AS remainingCents FROM cashback_credit_lots WHERE tenant_id=? AND remaining_cents>0 AND expires_at IS NOT NULL AND datetime(expires_at)<=datetime(?) ORDER BY datetime(expires_at),id",
        )
        .all(tenantId, now) as Array<{ id: number; customerId: number; remainingCents: number }>;
      const created: number[] = [];
      for (const lot of lots) {
        const key = `expiration:${lot.id}`;
        const hash = this.cashbackRequestHash("expiration", {
          lotId: lot.id,
          amountCents: lot.remainingCents,
        });
        const existing = this.existingCashbackIdempotency(tenantId, key, hash);
        if (existing) {
          created.push(existing);
          continue;
        }
        const account = sqlite
          .prepare(
            "SELECT balance_cents AS balanceCents FROM cashback_accounts WHERE tenant_id=? AND customer_id=?",
          )
          .get(tenantId, lot.customerId) as { balanceCents: number };
        const balanceCents = account.balanceCents - lot.remainingCents;
        if (balanceCents < 0) throw new Error("Cashback account and lots are inconsistent");
        const inserted = sqlite
          .prepare(
            `INSERT INTO cashback_transactions(tenant_id,customer_id,type,amount,balance,amount_cents,balance_cents,idempotency_key,request_hash,source,description) VALUES(?,?,'debit',?,?,?,?,?,?,'expiration','Expiração de cashback')`,
          )
          .run(
            tenantId,
            lot.customerId,
            lot.remainingCents / 100,
            balanceCents / 100,
            lot.remainingCents,
            balanceCents,
            key,
            hash,
          );
        const id = Number(inserted.lastInsertRowid);
        sqlite
          .prepare("UPDATE cashback_credit_lots SET remaining_cents=0 WHERE id=? AND tenant_id=?")
          .run(lot.id, tenantId);
        sqlite
          .prepare(
            "INSERT INTO cashback_debit_allocations(tenant_id,debit_transaction_id,credit_lot_id,amount_cents) VALUES(?,?,?,?)",
          )
          .run(tenantId, id, lot.id, lot.remainingCents);
        sqlite
          .prepare(
            "UPDATE cashback_accounts SET balance_cents=?,updated_at=datetime('now') WHERE tenant_id=? AND customer_id=?",
          )
          .run(balanceCents, tenantId, lot.customerId);
        created.push(id);
      }
      if (audit)
        this.insertAuditEvent({
          ...audit,
          tenantId,
          action: "cashback.expired",
          targetType: "cashback_lots",
          outcome: "success",
          metadata: { transactionCount: created.length },
        });
      return created;
    })();
    return ids.map((id) => this.loadCashbackTransaction(tenantId, id));
  }

  async reconcileCashback(tenantId: number, customerId?: number, audit?: AuditContext) {
    const rows = sqlite
      .prepare(
        `SELECT a.customer_id AS customerId,a.balance_cents AS accountBalanceCents,
      COALESCE((SELECT SUM(l.remaining_cents) FROM cashback_credit_lots l WHERE l.tenant_id=a.tenant_id AND l.customer_id=a.customer_id),0) AS lotBalanceCents,
      COALESCE((SELECT t.balance_cents FROM cashback_transactions t WHERE t.tenant_id=a.tenant_id AND t.customer_id=a.customer_id ORDER BY t.id DESC LIMIT 1),0) AS ledgerBalanceCents
      FROM cashback_accounts a WHERE a.tenant_id=? AND (? IS NULL OR a.customer_id=?) ORDER BY a.customer_id`,
      )
      .all(tenantId, customerId ?? null, customerId ?? null) as Array<{
      customerId: number;
      accountBalanceCents: number;
      lotBalanceCents: number;
      ledgerBalanceCents: number;
    }>;
    const results = rows.map((row) => ({
      ...row,
      consistent:
        row.accountBalanceCents === row.lotBalanceCents &&
        row.accountBalanceCents === row.ledgerBalanceCents,
    }));
    if (audit)
      await this.appendAuditEvent({
        ...audit,
        tenantId,
        action: "cashback.reconciled",
        targetType: "cashback_accounts",
        outcome: "success",
        metadata: {
          customerCount: results.length,
          consistent: results.every((item) => item.consistent),
        },
      });
    return results;
  }

  async getCustomerCashbackBalance(tenantId: number, customerId: number): Promise<number> {
    const account = sqlite
      .prepare(
        "SELECT balance_cents AS balanceCents FROM cashback_accounts WHERE tenant_id=? AND customer_id=?",
      )
      .get(tenantId, customerId) as { balanceCents: number } | undefined;
    if (account) return account.balanceCents / 100;
    const transactions = await db
      .select()
      .from(cashbackTransactions)
      .where(
        and(
          eq(cashbackTransactions.tenantId, tenantId),
          eq(cashbackTransactions.customerId, customerId),
        ),
      )
      .orderBy(desc(cashbackTransactions.createdAt))
      .limit(1);

    return transactions[0]?.balance || 0;
  }

  async getCashbackDistribution(tenantId: number): Promise<{ range: string; count: number }[]> {
    // Get all customers with their latest cashback balance
    const allCustomers = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

    const balances = await Promise.all(
      allCustomers.map(async (customer) => {
        return await this.getCustomerCashbackBalance(tenantId, customer.id);
      }),
    );

    // Group by ranges
    const ranges = [
      { range: "R$ 0", min: 0, max: 0, count: 0 },
      { range: "R$ 1-50", min: 0.01, max: 50, count: 0 },
      { range: "R$ 51-100", min: 51, max: 100, count: 0 },
      { range: "R$ 101-200", min: 101, max: 200, count: 0 },
      { range: "R$ 201+", min: 201, max: Infinity, count: 0 },
    ];

    balances.forEach((balance) => {
      const range = ranges.find((r) => balance >= r.min && balance <= r.max);
      if (range) range.count++;
    });

    return ranges.map(({ range, count }) => ({ range, count }));
  }

  async getExpiringCashback(
    tenantId: number,
    daysAhead: number,
  ): Promise<{ customer: Customer; balance: number; expiresAt: string }[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const expiringTransactions = await db
      .select({
        transaction: cashbackTransactions,
        customer: customers,
      })
      .from(cashbackTransactions)
      .innerJoin(customers, eq(cashbackTransactions.customerId, customers.id))
      .where(
        and(
          eq(cashbackTransactions.tenantId, tenantId),
          gte(cashbackTransactions.expiresAt, now.toISOString()),
          lte(cashbackTransactions.expiresAt, futureDate.toISOString()),
          sql`${cashbackTransactions.balance} > 0`,
        ),
      )
      .orderBy(cashbackTransactions.expiresAt);

    return expiringTransactions.map(({ transaction, customer }) => ({
      customer,
      balance: transaction.balance,
      expiresAt: transaction.expiresAt!,
    }));
  }

  // ==================== CAMPAIGNS ====================
  async getCampaigns(tenantId: number): Promise<Campaign[]> {
    return await db.select().from(campaigns).where(eq(campaigns.tenantId, tenantId));
  }

  async getCampaign(tenantId: number, id: number): Promise<Campaign | undefined> {
    const result = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, id)));
    return result[0];
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const result = await db.insert(campaigns).values(campaign).returning();
    return result[0];
  }

  async updateCampaign(
    tenantId: number,
    id: number,
    data: Partial<InsertCampaign>,
  ): Promise<Campaign | undefined> {
    const result = await db
      .update(campaigns)
      .set(data)
      .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, id)))
      .returning();
    return result[0];
  }

  async deleteCampaign(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean> {
    return this.deleteTenantEntity("campaigns", tenantId, id, audit);
  }

  // ==================== AUTOMATIONS ====================
  async getAutomations(tenantId: number): Promise<Automation[]> {
    return await db.select().from(automations).where(eq(automations.tenantId, tenantId));
  }

  async getAutomation(tenantId: number, id: number): Promise<Automation | undefined> {
    const result = await db
      .select()
      .from(automations)
      .where(and(eq(automations.tenantId, tenantId), eq(automations.id, id)));
    return result[0];
  }

  async createAutomation(automation: InsertAutomation): Promise<Automation> {
    const result = await db.insert(automations).values(automation).returning();
    return result[0];
  }

  async updateAutomation(
    tenantId: number,
    id: number,
    data: Partial<InsertAutomation>,
  ): Promise<Automation | undefined> {
    const { tenantId: _ignoredTenantId, ...safeData } = data;
    const current = await this.getAutomation(tenantId, id);
    if (!current) return undefined;

    // Changing the definition bumps the version so jobs enqueued against the
    // previous definition are skipped instead of running with new semantics.
    const definitionChanged =
      (safeData.triggerType !== undefined && safeData.triggerType !== current.triggerType) ||
      (safeData.actionType !== undefined && safeData.actionType !== current.actionType) ||
      (safeData.actionChannel !== undefined && safeData.actionChannel !== current.actionChannel);

    const result = await db
      .update(automations)
      .set(definitionChanged ? { ...safeData, version: current.version + 1 } : safeData)
      .where(and(eq(automations.tenantId, tenantId), eq(automations.id, id)))
      .returning();
    return result[0];
  }

  async deleteAutomation(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean> {
    return this.deleteTenantEntity("automations", tenantId, id, audit);
  }

  // ==================== CONTACT REQUESTS ====================
  async getContactRequests(): Promise<ContactRequest[]> {
    return await db.select().from(contactRequests).orderBy(desc(contactRequests.createdAt));
  }

  async createContactRequest(request: InsertContactRequest): Promise<ContactRequest> {
    const result = await db.insert(contactRequests).values(request).returning();
    return result[0];
  }

  async updateContactRequestStatus(
    id: number,
    status: string,
  ): Promise<ContactRequest | undefined> {
    const result = await db
      .update(contactRequests)
      .set({ status })
      .where(eq(contactRequests.id, id))
      .returning();
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
    const result = await db
      .update(demoRequests)
      .set({ status })
      .where(eq(demoRequests.id, id))
      .returning();
    return result[0];
  }

  // ==================== TENANT STATS ====================
  async getTenantStats(): Promise<
    {
      tenantId: number;
      tenantName: string;
      usersCount: number;
      customersCount: number;
      ordersCount: number;
      productsCount: number;
    }[]
  > {
    const allTenants = await db.select().from(tenants);

    const stats = await Promise.all(
      allTenants.map(async (tenant) => {
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
      }),
    );

    return stats;
  }

  // ==================== SELLER TASKS ====================
  async getSellerTasks(
    tenantId: number,
    filters?: {
      sellerId?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      type?: string;
    },
  ): Promise<(SellerTask & { customer?: Customer })[]> {
    const conditions = [eq(sellerTasks.tenantId, tenantId)];

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
    const results = await db
      .select({
        task: sellerTasks,
        customer: customers,
      })
      .from(sellerTasks)
      .leftJoin(
        customers,
        and(eq(sellerTasks.customerId, customers.id), eq(customers.tenantId, tenantId)),
      )
      .where(and(...conditions))
      .orderBy(desc(sellerTasks.createdAt));

    // Map the results to the expected format
    return results.map(({ task, customer }) => ({
      ...task,
      customer: customer || undefined,
    }));
  }

  async getSellerTask(tenantId: number, id: number): Promise<SellerTask | undefined> {
    const result = await db
      .select()
      .from(sellerTasks)
      .where(and(eq(sellerTasks.tenantId, tenantId), eq(sellerTasks.id, id)));
    return result[0];
  }

  async createSellerTask(task: InsertSellerTask): Promise<SellerTask> {
    if (task.customerId && !(await this.getCustomer(task.tenantId, task.customerId))) {
      throw new Error("Invalid tenant-scoped customer reference");
    }
    if (task.sellerId) {
      const membership = await this.getTenantUser(task.tenantId, task.sellerId);
      if (!membership?.isActive) {
        throw new Error("Invalid tenant-scoped seller reference");
      }
    }
    const result = await db.insert(sellerTasks).values(task).returning();
    return result[0];
  }

  async updateSellerTask(
    tenantId: number,
    id: number,
    data: Partial<InsertSellerTask & { completedAt?: string }>,
  ): Promise<SellerTask | undefined> {
    const result = await db
      .update(sellerTasks)
      .set(data)
      .where(and(eq(sellerTasks.tenantId, tenantId), eq(sellerTasks.id, id)))
      .returning();
    return result[0];
  }

  async deleteSellerTask(tenantId: number, id: number, audit?: AuditWriteInput): Promise<boolean> {
    return this.deleteTenantEntity("seller_tasks", tenantId, id, audit);
  }

  async getSellerStats(
    tenantId: number,
    sellerId?: string,
  ): Promise<{ pending: number; completed: number; today: number; overdue: number }> {
    const conditions = [eq(sellerTasks.tenantId, tenantId)];
    if (sellerId) {
      conditions.push(eq(sellerTasks.sellerId, sellerId));
    }

    const allTasks = await db
      .select()
      .from(sellerTasks)
      .where(and(...conditions));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pending = allTasks.filter((t) => t.status === "pending").length;
    const completed = allTasks.filter((t) => t.status === "completed").length;
    const todayTasks = allTasks.filter((t) => {
      const dueDate = new Date(t.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === today.getTime() && t.status === "pending";
    }).length;
    const overdue = allTasks.filter((t) => {
      const dueDate = new Date(t.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today && t.status === "pending";
    }).length;

    return { pending, completed, today: todayTasks, overdue };
  }

  // ==================== SELLER GOALS ====================
  async getSellerGoals(tenantId: number, sellerId?: string): Promise<SellerGoal | undefined> {
    const conditions = [eq(sellerGoals.tenantId, tenantId)];
    if (sellerId) {
      conditions.push(eq(sellerGoals.sellerId, sellerId));
    } else {
      conditions.push(sql`${sellerGoals.sellerId} IS NULL`);
    }

    const result = await db
      .select()
      .from(sellerGoals)
      .where(and(...conditions));
    return result[0];
  }

  async upsertSellerGoals(goals: InsertSellerGoal): Promise<SellerGoal> {
    if (goals.sellerId) {
      const membership = await this.getTenantUser(goals.tenantId, goals.sellerId);
      if (!membership?.isActive) {
        throw new Error("Invalid tenant-scoped seller reference");
      }
    }
    const conditions = [eq(sellerGoals.tenantId, goals.tenantId)];
    if (goals.sellerId) {
      conditions.push(eq(sellerGoals.sellerId, goals.sellerId));
    } else {
      conditions.push(sql`${sellerGoals.sellerId} IS NULL`);
    }

    const existing = await db
      .select()
      .from(sellerGoals)
      .where(and(...conditions));

    if (existing.length > 0) {
      const result = await db
        .update(sellerGoals)
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
  async getCustomerInteractions(
    tenantId: number,
    customerId?: number,
    sellerId?: string,
    limit?: number,
  ): Promise<(CustomerInteraction & { customer?: Customer; seller?: User })[]> {
    const conditions = [eq(customerInteractions.tenantId, tenantId)];
    if (customerId) {
      conditions.push(eq(customerInteractions.customerId, customerId));
    }
    if (sellerId) {
      conditions.push(eq(customerInteractions.sellerId, sellerId));
    }

    // Use LEFT JOINs to fetch interactions with customers and sellers in a single query
    const query = db
      .select({
        interaction: customerInteractions,
        customer: customers,
        seller: users,
      })
      .from(customerInteractions)
      .leftJoin(
        customers,
        and(eq(customerInteractions.customerId, customers.id), eq(customers.tenantId, tenantId)),
      )
      .leftJoin(users, eq(customerInteractions.sellerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(customerInteractions.createdAt));

    const results = limit ? await query.limit(limit) : await query;

    // Map the results to the expected format
    return results.map(({ interaction, customer, seller }) => ({
      ...interaction,
      customer: customer || undefined,
      seller: seller || undefined,
    }));
  }

  async createCustomerInteraction(
    interaction: InsertCustomerInteraction,
  ): Promise<CustomerInteraction> {
    if (!(await this.getCustomer(interaction.tenantId, interaction.customerId))) {
      throw new Error("Invalid tenant-scoped customer reference");
    }
    if (interaction.taskId) {
      const task = await this.getSellerTask(interaction.tenantId, interaction.taskId);
      if (!task || (task.customerId && task.customerId !== interaction.customerId)) {
        throw new Error("Invalid tenant-scoped task reference");
      }
    }
    const result = await db.insert(customerInteractions).values(interaction).returning();
    return result[0];
  }

  // ==================== SELLER RANKING ====================
  async getSellerRanking(
    tenantId: number,
    period: "daily" | "weekly" | "monthly",
  ): Promise<
    { sellerId: string; sellerName: string; completedTasks: number; totalInteractions: number }[]
  > {
    const now = new Date();
    let startDate: string;

    switch (period) {
      case "daily":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        break;
      case "weekly":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
        break;
      case "monthly":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        break;
    }

    // Fetch all sellers with their user data in one query using JOIN
    const sellersWithUsers = await db
      .select({
        userId: tenantUsers.userId,
        userName: users.name,
      })
      .from(tenantUsers)
      .innerJoin(users, eq(tenantUsers.userId, users.id))
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.role, "seller")));

    // Batch fetch all completed tasks for the period
    const allCompletedTasks = await db
      .select({
        sellerId: sellerTasks.sellerId,
      })
      .from(sellerTasks)
      .where(
        and(
          eq(sellerTasks.tenantId, tenantId),
          eq(sellerTasks.status, "completed"),
          gte(sellerTasks.completedAt, startDate),
        ),
      );

    // Batch fetch all interactions for the period
    const allInteractions = await db
      .select({
        sellerId: customerInteractions.sellerId,
      })
      .from(customerInteractions)
      .where(
        and(
          eq(customerInteractions.tenantId, tenantId),
          gte(customerInteractions.createdAt, startDate),
        ),
      );

    // Build maps for O(1) lookups
    const taskCountMap = new Map<string, number>();
    allCompletedTasks.forEach((task) => {
      if (task.sellerId) {
        taskCountMap.set(task.sellerId, (taskCountMap.get(task.sellerId) || 0) + 1);
      }
    });

    const interactionCountMap = new Map<string, number>();
    allInteractions.forEach((interaction) => {
      if (interaction.sellerId) {
        interactionCountMap.set(
          interaction.sellerId,
          (interactionCountMap.get(interaction.sellerId) || 0) + 1,
        );
      }
    });

    // Combine all data in JavaScript
    const ranking = sellersWithUsers.map(({ userId, userName }) => ({
      sellerId: userId,
      sellerName: userName,
      completedTasks: taskCountMap.get(userId) || 0,
      totalInteractions: interactionCountMap.get(userId) || 0,
    }));

    return ranking.sort((a, b) => b.completedTasks - a.completedTasks);
  }

  // ==================== NOTIFICATIONS ====================
  async getNotifications(
    tenantId: number,
    userId?: string,
    limit: number = 50,
  ): Promise<Notification[]> {
    const conditions = [eq(notifications.tenantId, tenantId)];
    if (userId) {
      conditions.push(eq(notifications.userId, userId));
    }

    return await db
      .select()
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
    const [updated] = await db
      .update(notifications)
      .set({ status })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  // ==================== DASHBOARD STATS ====================
  async getDashboardStats(tenantId: number): Promise<{
    totalCustomers: number;
    totalRevenue: number;
    totalRevenueCents: number;
    totalOrders: number;
    averageTicket: number;
    averageTicketCents: number;
    vipCustomers: number;
    totalProducts: number;
    weeklyData: Array<{ name: string; total: number; totalCents: number }>;
    recentOrders: Order[];
    revenueGrowth: number;
    newCustomers: number;
    activeCustomers: number;
  }> {
    const allCustomers = await db.select().from(customers).where(eq(customers.tenantId, tenantId));
    const allOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.tenantId, tenantId))
      .orderBy(desc(orders.orderDate), desc(orders.id));
    const [{ count: totalProducts }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.tenantId, tenantId));

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const eligibleOrders = allOrders.filter((order) => order.status !== "Cancelado");
    const totalCustomers = allCustomers.length;
    const totalRevenueCents = eligibleOrders.reduce((sum, order) => sum + order.totalCents, 0);
    const totalOrders = eligibleOrders.length;
    const averageTicketCents = totalOrders > 0 ? Math.round(totalRevenueCents / totalOrders) : 0;

    // Calculate revenue growth (last 30 days vs previous 30 days)
    const last30DaysRevenueCents = eligibleOrders
      .filter((o) => new Date(o.createdAt!) >= thirtyDaysAgo)
      .reduce((sum, order) => sum + order.totalCents, 0);
    const previous30DaysRevenueCents = eligibleOrders
      .filter(
        (o) => new Date(o.createdAt!) >= sixtyDaysAgo && new Date(o.createdAt!) < thirtyDaysAgo,
      )
      .reduce((sum, order) => sum + order.totalCents, 0);

    const revenueGrowth =
      previous30DaysRevenueCents > 0
        ? ((last30DaysRevenueCents - previous30DaysRevenueCents) / previous30DaysRevenueCents) * 100
        : 0;

    const newCustomers = allCustomers.filter((customer) => customer.segment === "Novo").length;
    const activeCustomers = allCustomers.filter(
      (c) => c.lastPurchase && new Date(c.lastPurchase) >= thirtyDaysAgo,
    ).length;
    const vipCustomers = allCustomers.filter((customer) => customer.segment === "VIP").length;
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const weeklyData = weekDays.map((name, dayIndex) => {
      const totalCents = eligibleOrders
        .filter((order) => order.orderDate && new Date(order.orderDate).getUTCDay() === dayIndex)
        .reduce((sum, order) => sum + order.totalCents, 0);
      return { name, total: totalCents / 100, totalCents };
    });

    return {
      totalCustomers,
      totalRevenue: totalRevenueCents / 100,
      totalRevenueCents,
      totalOrders,
      averageTicket: averageTicketCents / 100,
      averageTicketCents,
      vipCustomers,
      totalProducts: Number(totalProducts),
      weeklyData,
      recentOrders: eligibleOrders.slice(0, 5),
      revenueGrowth,
      newCustomers,
      activeCustomers,
    };
  }

  async getDashboardCharts(tenantId: number): Promise<{
    revenueByMonth: { month: string; revenue: number; revenueCents: number }[];
    ordersByStatus: { status: string; count: number }[];
    customersBySegment: { segment: string; count: number }[];
    topProducts: { name: string; revenue: number; quantity: number }[];
  }> {
    const allOrders = await db.select().from(orders).where(eq(orders.tenantId, tenantId));
    const allCustomers = await db.select().from(customers).where(eq(customers.tenantId, tenantId));

    // Revenue by month (last 12 months)
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    const revenueByMonthMap = new Map<string, number>();

    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${monthNames[date.getUTCMonth()]}/${date.getUTCFullYear().toString().slice(2)}`;
      revenueByMonthMap.set(key, 0);
    }

    allOrders
      .filter((order) => order.status !== "Cancelado")
      .forEach((order) => {
        const orderDate = new Date(order.orderDate!);
        const key = `${monthNames[orderDate.getUTCMonth()]}/${orderDate.getUTCFullYear().toString().slice(2)}`;
        if (revenueByMonthMap.has(key)) {
          revenueByMonthMap.set(key, (revenueByMonthMap.get(key) || 0) + order.totalCents);
        }
      });

    const revenueByMonth = Array.from(revenueByMonthMap.entries()).map(([month, revenueCents]) => ({
      month,
      revenue: revenueCents / 100,
      revenueCents,
    }));

    // Orders by status
    const statusMap = new Map<string, number>();
    allOrders.forEach((order) => {
      statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
    });
    const ordersByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    // Customers by segment
    const segmentMap = new Map<string, number>();
    allCustomers.forEach((customer) => {
      segmentMap.set(customer.segment, (segmentMap.get(customer.segment) || 0) + 1);
    });
    const customersBySegment = Array.from(segmentMap.entries()).map(([segment, count]) => ({
      segment,
      count,
    }));

    const topProductRows = await db
      .select({
        name: products.name,
        revenueCents: sql<number>`sum(${orderItems.lineTotalCents})`,
        quantity: sql<number>`sum(${orderItems.quantity})`,
      })
      .from(orderItems)
      .innerJoin(
        orders,
        and(eq(orderItems.orderId, orders.id), eq(orderItems.tenantId, orders.tenantId)),
      )
      .innerJoin(
        products,
        and(eq(orderItems.productId, products.id), eq(orderItems.tenantId, products.tenantId)),
      )
      .where(and(eq(orderItems.tenantId, tenantId), ne(orders.status, "Cancelado")))
      .groupBy(products.id, products.name)
      .orderBy(desc(sql`sum(${orderItems.lineTotalCents})`))
      .limit(10);
    const topProducts = topProductRows.map((row) => ({
      name: row.name,
      revenue: Number(row.revenueCents) / 100,
      quantity: Number(row.quantity),
    }));

    return {
      revenueByMonth,
      ordersByStatus,
      customersBySegment,
      topProducts,
    };
  }

  async getSalesReport(tenantId: number, options: ReportOptions): Promise<SalesReport> {
    if (options.timezone !== "UTC")
      throw new Error("Only UTC reporting is supported until a tenant timezone is approved");
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const isValidDate = (value: string) => {
      if (!datePattern.test(value)) return false;
      const [year, month, day] = value.split("-").map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
      );
    };
    if ((options.startDate === undefined) !== (options.endDate === undefined)) {
      throw new Error("startDate and endDate must be provided together");
    }
    if (
      options.startDate &&
      options.endDate &&
      (!isValidDate(options.startDate) ||
        !isValidDate(options.endDate) ||
        options.startDate > options.endDate)
    ) {
      throw new Error("Invalid UTC report date interval");
    }

    const orderConditions = ["tenant_id=?", "status<>'Cancelado'", "date(order_date) IS NOT NULL"];
    const orderParams: Array<number | string> = [tenantId];
    if (options.startDate && options.endDate) {
      orderConditions.push("date(order_date)>=date(?)", "date(order_date)<=date(?)");
      orderParams.push(options.startDate, options.endDate);
    }
    const whereOrders = orderConditions.join(" AND ");
    const reportOrders = sqlite
      .prepare(
        `
      SELECT id,order_id AS orderId,customer_id AS customerId,customer,order_date AS orderDate,
             total_cents AS totalCents,status
      FROM orders WHERE ${whereOrders} ORDER BY datetime(order_date),id
    `,
      )
      .all(...orderParams) as Array<{
      id: number;
      orderId: string;
      customerId: number | null;
      customer: string;
      orderDate: string | null;
      totalCents: number;
      status: string;
    }>;

    const totalRevenueCents = reportOrders.reduce((sum, order) => sum + order.totalCents, 0);
    if (!Number.isSafeInteger(totalRevenueCents))
      throw new Error("Report revenue exceeds supported integer range");
    const totalOrders = reportOrders.length;
    const averageTicketCents = totalOrders === 0 ? 0 : Math.round(totalRevenueCents / totalOrders);

    const monthly = new Map<string, { salesCents: number; orders: number }>();
    const customerSpend = new Map<number, { totalSpentCents: number; orderCount: number }>();
    for (const order of reportOrders) {
      const month = order.orderDate!.slice(0, 7);
      const currentMonth = monthly.get(month) ?? { salesCents: 0, orders: 0 };
      currentMonth.salesCents += order.totalCents;
      currentMonth.orders += 1;
      monthly.set(month, currentMonth);
      if (order.customerId != null) {
        const currentCustomer = customerSpend.get(order.customerId) ?? {
          totalSpentCents: 0,
          orderCount: 0,
        };
        currentCustomer.totalSpentCents += order.totalCents;
        currentCustomer.orderCount += 1;
        customerSpend.set(order.customerId, currentCustomer);
      }
    }

    const itemConditions = [
      "o.tenant_id=?",
      "o.status<>'Cancelado'",
      "date(o.order_date) IS NOT NULL",
    ];
    const itemParams: Array<number | string> = [tenantId];
    if (options.startDate && options.endDate) {
      itemConditions.push("date(o.order_date)>=date(?)", "date(o.order_date)<=date(?)");
      itemParams.push(options.startDate, options.endDate);
    }
    const categoryRows = sqlite
      .prepare(
        `
      SELECT oi.category_snapshot AS name,SUM(oi.line_total_cents) AS valueCents,SUM(oi.quantity) AS quantity
      FROM order_items oi JOIN orders o ON o.id=oi.order_id AND o.tenant_id=oi.tenant_id
      WHERE ${itemConditions.join(" AND ")}
      GROUP BY oi.category_snapshot ORDER BY valueCents DESC,oi.category_snapshot
    `,
      )
      .all(...itemParams) as Array<{ name: string; valueCents: number; quantity: number }>;

    const reportCustomers = sqlite
      .prepare(
        `
      SELECT id,name,email,segment FROM customers WHERE tenant_id=? ORDER BY id
    `,
      )
      .all(tenantId) as Array<{ id: number; name: string; email: string; segment: string }>;
    const segmentCounts = new Map<string, number>();
    for (const customer of reportCustomers) {
      segmentCounts.set(customer.segment, (segmentCounts.get(customer.segment) ?? 0) + 1);
    }
    const topCustomers = reportCustomers
      .map((customer) => {
        const spend = customerSpend.get(customer.id) ?? { totalSpentCents: 0, orderCount: 0 };
        return {
          ...customer,
          ltv: spend.totalSpentCents / 100,
          ltvCents: spend.totalSpentCents,
          totalSpent: spend.totalSpentCents / 100,
          totalSpentCents: spend.totalSpentCents,
          orderCount: spend.orderCount,
        };
      })
      .sort(
        (left, right) =>
          right.totalSpentCents - left.totalSpentCents ||
          right.orderCount - left.orderCount ||
          left.id - right.id,
      )
      .slice(0, 10);

    const reportCampaigns = sqlite
      .prepare(
        `
      SELECT id,name,channel,status,sent FROM campaigns WHERE tenant_id=? ORDER BY id
    `,
      )
      .all(tenantId) as Array<{
      id: number;
      name: string;
      channel: string;
      status: string;
      sent: number;
    }>;
    const totals = sqlite
      .prepare(
        `
      SELECT
        (SELECT COUNT(*) FROM customers WHERE tenant_id=?) AS totalCustomers,
        (SELECT COUNT(*) FROM products WHERE tenant_id=?) AS totalProducts
    `,
      )
      .get(tenantId, tenantId) as { totalCustomers: number; totalProducts: number };

    return {
      timezone: "UTC",
      range: { startDate: options.startDate ?? null, endDate: options.endDate ?? null },
      summary: {
        totalRevenue: totalRevenueCents / 100,
        totalRevenueCents,
        totalOrders,
        averageTicket: averageTicketCents / 100,
        averageTicketCents,
        totalCustomers: totals.totalCustomers,
        totalProducts: totals.totalProducts,
      },
      salesByMonth: Array.from(monthly.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([month, value]) => ({
          name: month,
          month,
          sales: value.salesCents / 100,
          salesCents: value.salesCents,
          orders: value.orders,
        })),
      salesByCategory: categoryRows.map((row) => ({ ...row, value: row.valueCents / 100 })),
      customersBySegment: Array.from(segmentCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
      topCustomers,
      campaignStats: reportCampaigns.map((campaign) => ({
        ...campaign,
        openRate: 0,
        conversion: 0,
        revenue: 0,
        metricsAvailable: false,
        unavailableReason: "attribution_events_not_implemented",
      })),
      orders: reportOrders.map((order) => ({ ...order, total: order.totalCents / 100 })),
    };
  }

  // ==================== CUSTOMER 360 VIEW ====================
  async getCustomer360(
    tenantId: number,
    customerId: number,
  ): Promise<
    | {
        customer: Customer;
        totalOrders: number;
        totalSpent: number;
        totalSpentCents: number;
        averageOrderValue: number;
        averageOrderValueCents: number;
        lastOrder?: Order;
        cashbackBalance: number;
        interactions: CustomerInteraction[];
      }
    | undefined
  > {
    const customer = await this.getCustomer(tenantId, customerId);
    if (!customer) return undefined;

    const customerOrders = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.customerId, customerId)))
      .orderBy(desc(orders.orderDate));

    const eligibleOrders = customerOrders.filter((order) => order.status !== "Cancelado");
    const totalOrders = eligibleOrders.length;
    const totalSpentCents = eligibleOrders.reduce((sum, order) => sum + order.totalCents, 0);
    const averageOrderValueCents = totalOrders > 0 ? Math.round(totalSpentCents / totalOrders) : 0;
    const lastOrder = eligibleOrders[0];

    const cashbackBalance = await this.getCustomerCashbackBalance(tenantId, customerId);
    const interactions = await this.getCustomerInteractions(tenantId, customerId, undefined, 10);

    return {
      customer,
      totalOrders,
      totalSpent: totalSpentCents / 100,
      totalSpentCents,
      averageOrderValue: averageOrderValueCents / 100,
      averageOrderValueCents,
      lastOrder,
      cashbackBalance,
      interactions,
    };
  }

  async getCustomerOrderHistory(
    tenantId: number,
    customerId: number,
  ): Promise<{
    orders: Order[];
    totalOrders: number;
    totalSpent: number;
    totalSpentCents: number;
  }> {
    const customerOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.customerId, customerId),
          ne(orders.status, "Cancelado"),
        ),
      )
      .orderBy(desc(orders.orderDate), desc(orders.id));
    const totalSpentCents = customerOrders.reduce((sum, order) => sum + order.totalCents, 0);
    return {
      orders: customerOrders,
      totalOrders: customerOrders.length,
      totalSpent: totalSpentCents / 100,
      totalSpentCents,
    };
  }

  // ==================== HEALTH CHECK ====================
  async healthCheck(): Promise<boolean> {
    try {
      sqlite.prepare("SELECT 1").get();
      if (usingSeparateSessionDatabase) sessionSqlite.prepare("SELECT 1").get();
      return true;
    } catch (_error) {
      return false;
    }
  }

  async deepHealthCheck(): Promise<boolean> {
    try {
      sqlite.prepare("SELECT 1").get();
      const requiredTables = [
        "tenants",
        "users",
        "tenant_users",
        "customers",
        "products",
        "orders",
      ];
      if (!usingSeparateSessionDatabase) {
        requiredTables.push("sessions");
      }
      for (const table of requiredTables) {
        const exists = sqlite
          .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
          .get(table);
        if (!exists) {
          return false;
        }
      }
      const integrity = sqlite.prepare("PRAGMA integrity_check").get() as {
        integrity_check?: string;
      };
      if (integrity.integrity_check !== "ok") {
        return false;
      }
      const foreignKeyIssues = sqlite.prepare("PRAGMA foreign_key_check").all();
      if (foreignKeyIssues.length > 0) {
        return false;
      }
      if (usingSeparateSessionDatabase) {
        sessionSqlite.prepare("SELECT 1").get();
        const sessionsTableExists = sessionSqlite
          .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sessions'")
          .get();
        if (!sessionsTableExists) {
          return false;
        }
        const sessionIntegrity = sessionSqlite.prepare("PRAGMA integrity_check").get() as {
          integrity_check?: string;
        };
        if (sessionIntegrity.integrity_check !== "ok") {
          return false;
        }
      }
      return true;
    } catch (_error) {
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
