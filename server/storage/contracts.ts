/**
 * Storage contract.
 *
 * Types, domain errors, the audit metadata allowlist and the `IStorage`
 * interface live here so a caller can depend on the contract without pulling in
 * the SQLite implementation. `server/storage.ts` implements it.
 */

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
} from "@shared/schema";

export type SortOrder = "asc" | "desc";

export function moneyToCents(value: number, field: string): number {
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
  | "data.imported"
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
  "data.imported": ["entityType", "rowCount", "created", "updated", "skipped"],
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
