import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Use the platform CSPRNG instead of Math.random for identity values.
const generateUUID = () => crypto.randomUUID();

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// ==================== TENANTS ====================
export const tenants = sqliteTable(
  "tenants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    plan: text("plan").notNull().default("free"),
    status: text("status").notNull().default("active"),
    logo: text("logo"),
    primaryColor: text("primary_color").default("#9333ea"),
    secondaryColor: text("secondary_color").default("#db2777"),
    loginMessage: text("login_message"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [index("tenants_status_idx").on(table.status)],
);

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// ==================== USERS ====================
export const users = sqliteTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateUUID()),
    email: text("email").notNull(),
    cpf: text("cpf").unique(),
    sellerCode: text("seller_code"),
    password: text("password").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    isSuperAdmin: integer("is_super_admin", { mode: "boolean" }).notNull().default(false),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(true),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("active"),
    lastPasswordChange: text("last_password_change"),
    lastLogin: text("last_login"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    uniqueIndex("users_email_normalized_unique").on(sql`lower(trim(${table.email}))`),
    index("users_status_idx").on(table.status),
    index("users_seller_code_idx").on(table.sellerCode),
  ],
);

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastPasswordChange: true,
  lastLogin: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ==================== TENANT USERS ====================
export const tenantUsers = sqliteTable(
  "tenant_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("seller"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("tenant_users_tenant_id_idx").on(table.tenantId),
    index("tenant_users_user_id_idx").on(table.userId),
    uniqueIndex("tenant_users_tenant_user_unique").on(table.tenantId, table.userId),
  ],
);

export const insertTenantUserSchema = createInsertSchema(tenantUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTenantUser = z.infer<typeof insertTenantUserSchema>;
export type TenantUser = typeof tenantUsers.$inferSelect;

// ==================== AUDIT EVENTS ====================
// Security audit metadata is serialized only after passing the server-side
// per-action allowlist. Keeping it as JSON text makes the durable representation
// explicit and avoids accepting arbitrary client objects through Drizzle.
export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Snapshot identifiers intentionally have no FK: deleting a user/tenant must
    // retain the immutable security record without an implicit UPDATE.
    tenantId: integer("tenant_id"),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    outcome: text("outcome").notNull(),
    requestId: text("request_id").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("audit_events_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("audit_events_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("audit_events_action_created_idx").on(table.action, table.createdAt),
    index("audit_events_request_id_idx").on(table.requestId),
    check("audit_events_outcome_check", sql`${table.outcome} IN ('success', 'failure')`),
  ],
);

export type AuditEvent = typeof auditEvents.$inferSelect;

// ==================== PASSWORD RESETS ====================
export const passwordResets = sqliteTable(
  "password_resets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdByAdmin: integer("created_by_admin", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("password_resets_user_id_idx").on(table.userId),
    index("password_resets_expires_at_idx").on(table.expiresAt),
  ],
);

export const insertPasswordResetSchema = createInsertSchema(passwordResets).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export type InsertPasswordReset = z.infer<typeof insertPasswordResetSchema>;
export type PasswordReset = typeof passwordResets.$inferSelect;

// ==================== CUSTOMERS ====================
export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    segment: text("segment").notNull(),
    ltv: real("ltv").notNull().default(0),
    // Compatibility projection only. Sales reports derive spend from orders.
    ltvCents: integer("ltv_cents").notNull().default(0),
    lastPurchase: text("last_purchase"),
    favoriteCategory: text("favorite_category"),
    image: text("image"),
    birthDate: text("birth_date"),
    // Consent is evaluated when recipients are materialized and again before delivery.
    marketingOptOut: integer("marketing_opt_out", { mode: "boolean" }).notNull().default(false),
    marketingConsentAt: text("marketing_consent_at"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("customers_tenant_id_idx").on(table.tenantId),
    index("customers_tenant_opt_out_idx").on(table.tenantId, table.marketingOptOut),
    index("customers_email_idx").on(table.email),
    index("customers_segment_idx").on(table.segment),
    index("customers_created_at_idx").on(table.createdAt),
    index("customers_tenant_segment_idx").on(table.tenantId, table.segment),
    check("customers_ltv_check", sql`${table.ltv} >= 0`),
    check("customers_ltv_cents_check", sql`${table.ltvCents} >= 0`),
  ],
);

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ==================== PRODUCTS ====================
export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    price: real("price").notNull().default(0),
    priceCents: integer("price_cents").notNull().default(0),
    stock: integer("stock").notNull().default(0),
    status: text("status").notNull().default("active"),
    image: text("image"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("products_tenant_id_idx").on(table.tenantId),
    index("products_category_idx").on(table.category),
    index("products_status_idx").on(table.status),
    index("products_tenant_category_idx").on(table.tenantId, table.category),
    check("products_price_check", sql`${table.price} >= 0`),
    check("products_price_cents_check", sql`${table.priceCents} >= 0`),
    check("products_stock_check", sql`${table.stock} >= 0`),
  ],
);

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// ==================== ORDERS ====================
export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: text("order_id").notNull(),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customer: text("customer").notNull(),
    orderDate: text("order_date").default(sql`(datetime('now'))`),
    total: real("total").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    status: text("status").notNull().default("Pendente"),
    items: integer("items").notNull().default(0),
    method: text("method").notNull(),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("orders_tenant_id_idx").on(table.tenantId),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_status_idx").on(table.status),
    index("orders_created_at_idx").on(table.createdAt),
    index("orders_order_date_idx").on(table.orderDate),
    index("orders_tenant_status_idx").on(table.tenantId, table.status),
    index("orders_tenant_customer_order_date_idx").on(
      table.tenantId,
      table.customerId,
      table.orderDate,
    ),
    uniqueIndex("orders_tenant_order_id_unique").on(table.tenantId, table.orderId),
    check("orders_total_check", sql`${table.total} >= 0`),
    check("orders_total_cents_check", sql`${table.totalCents} >= 0`),
  ],
);

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ==================== ORDER ITEMS ====================
// Immutable commercial snapshots. Product price changes never rewrite history.
export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    categorySnapshot: text("category_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("order_items_tenant_id_idx").on(table.tenantId),
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_product_id_idx").on(table.productId),
    index("order_items_tenant_category_idx").on(table.tenantId, table.categorySnapshot),
    uniqueIndex("order_items_tenant_order_product_unique").on(
      table.tenantId,
      table.orderId,
      table.productId,
    ),
    check("order_items_quantity_check", sql`${table.quantity} > 0`),
    check("order_items_unit_price_cents_check", sql`${table.unitPriceCents} >= 0`),
    check(
      "order_items_line_total_cents_check",
      sql`${table.lineTotalCents} = ${table.unitPriceCents} * ${table.quantity}`,
    ),
  ],
);

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// ==================== CASHBACK RULES ====================
export const cashbackRules = sqliteTable(
  "cashback_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    trigger: text("trigger").notNull(),
    value: real("value").notNull().default(0),
    validity: integer("validity").notNull().default(30),
    status: text("status").notNull().default("active"),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("cashback_rules_tenant_id_idx").on(table.tenantId),
    index("cashback_rules_status_idx").on(table.status),
  ],
);

export const insertCashbackRuleSchema = createInsertSchema(cashbackRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCashbackRule = z.infer<typeof insertCashbackRuleSchema>;
export type CashbackRule = typeof cashbackRules.$inferSelect;

// ==================== CASHBACK TRANSACTIONS ====================
export const cashbackTransactions = sqliteTable(
  "cashback_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    ruleId: integer("rule_id").references(() => cashbackRules.id, { onDelete: "set null" }),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    type: text("type").notNull(), // 'credit' or 'debit'
    amount: real("amount").notNull().default(0),
    balance: real("balance").notNull().default(0),
    amountCents: integer("amount_cents").notNull().default(0),
    balanceCents: integer("balance_cents").notNull().default(0),
    idempotencyKey: text("idempotency_key"),
    requestHash: text("request_hash"),
    source: text("source").notNull().default("legacy"),
    reversalOfId: integer("reversal_of_id"),
    description: text("description").notNull(),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("cashback_transactions_tenant_id_idx").on(table.tenantId),
    index("cashback_transactions_customer_id_idx").on(table.customerId),
    index("cashback_transactions_created_at_idx").on(table.createdAt),
    index("cashback_transactions_expires_at_idx").on(table.expiresAt),
    index("cashback_transactions_tenant_customer_created_idx").on(
      table.tenantId,
      table.customerId,
      table.createdAt,
    ),
    index("cashback_transactions_tenant_expires_idx").on(table.tenantId, table.expiresAt),
    check("cashback_transactions_type_check", sql`${table.type} IN ('credit', 'debit')`),
    check("cashback_transactions_amount_check", sql`${table.amount} >= 0`),
    check("cashback_transactions_balance_check", sql`${table.balance} >= 0`),
    check("cashback_transactions_amount_cents_check", sql`${table.amountCents} >= 0`),
    check("cashback_transactions_balance_cents_check", sql`${table.balanceCents} >= 0`),
    uniqueIndex("cashback_transactions_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    uniqueIndex("cashback_transactions_tenant_reversal_unique").on(
      table.tenantId,
      table.reversalOfId,
    ),
  ],
);

export const insertCashbackTransactionSchema = createInsertSchema(cashbackTransactions).omit({
  id: true,
  createdAt: true,
});

export type InsertCashbackTransaction = z.infer<typeof insertCashbackTransactionSchema>;
export type CashbackTransaction = typeof cashbackTransactions.$inferSelect;

export const cashbackAccounts = sqliteTable(
  "cashback_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    balanceCents: integer("balance_cents").notNull().default(0),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("cashback_accounts_tenant_customer_unique").on(table.tenantId, table.customerId),
    check("cashback_accounts_balance_cents_check", sql`${table.balanceCents} >= 0`),
  ],
);

export const cashbackCreditLots = sqliteTable(
  "cashback_credit_lots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    creditTransactionId: integer("credit_transaction_id").references(
      () => cashbackTransactions.id,
      { onDelete: "restrict" },
    ),
    originalCents: integer("original_cents").notNull(),
    remainingCents: integer("remaining_cents").notNull(),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("cashback_credit_lots_tenant_customer_expiry_idx").on(
      table.tenantId,
      table.customerId,
      table.expiresAt,
    ),
    check("cashback_credit_lots_original_check", sql`${table.originalCents} > 0`),
    check(
      "cashback_credit_lots_remaining_check",
      sql`${table.remainingCents} >= 0 AND ${table.remainingCents} <= ${table.originalCents}`,
    ),
  ],
);

export const cashbackDebitAllocations = sqliteTable(
  "cashback_debit_allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    debitTransactionId: integer("debit_transaction_id")
      .notNull()
      .references(() => cashbackTransactions.id, { onDelete: "cascade" }),
    creditLotId: integer("credit_lot_id")
      .notNull()
      .references(() => cashbackCreditLots.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
  },
  (table) => [
    uniqueIndex("cashback_debit_allocations_transaction_lot_unique").on(
      table.debitTransactionId,
      table.creditLotId,
    ),
    check("cashback_debit_allocations_amount_check", sql`${table.amountCents} > 0`),
  ],
);

export type CashbackAccount = typeof cashbackAccounts.$inferSelect;
export type CashbackCreditLot = typeof cashbackCreditLots.$inferSelect;
export type CashbackDebitAllocation = typeof cashbackDebitAllocations.$inferSelect;

// ==================== CAMPAIGNS ====================
export const campaigns = sqliteTable(
  "campaigns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    channel: text("channel").notNull(),
    audience: text("audience").notNull(),
    message: text("message"),
    sent: integer("sent").notNull().default(0),
    openRate: real("open_rate").notNull().default(0),
    conversion: real("conversion").notNull().default(0),
    revenue: real("revenue").notNull().default(0),
    status: text("status").notNull().default("draft"),
    scheduledAt: text("scheduled_at"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("campaigns_tenant_id_idx").on(table.tenantId),
    index("campaigns_status_idx").on(table.status),
    index("campaigns_created_at_idx").on(table.createdAt),
    index("campaigns_channel_idx").on(table.channel),
    check("campaigns_open_rate_check", sql`${table.openRate} >= 0 AND ${table.openRate} <= 100`),
    check(
      "campaigns_conversion_check",
      sql`${table.conversion} >= 0 AND ${table.conversion} <= 100`,
    ),
  ],
);

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// ==================== AUTOMATIONS ====================
export const automations = sqliteTable(
  "automations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    stats: text("stats"),
    // Versioned definition. Only allowlisted triggers/actions can be activated.
    version: integer("version").notNull().default(1),
    triggerType: text("trigger_type").notNull().default("customer.created"),
    actionType: text("action_type").notNull().default("notify_customer"),
    actionChannel: text("action_channel").notNull().default("email"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("automations_tenant_id_idx").on(table.tenantId),
    index("automations_is_active_idx").on(table.isActive),
    index("automations_tenant_trigger_active_idx").on(
      table.tenantId,
      table.triggerType,
      table.isActive,
    ),
    check("automations_version_check", sql`${table.version} > 0`),
    check(
      "automations_trigger_check",
      sql`${table.triggerType} IN ('customer.created', 'order.created')`,
    ),
    check("automations_action_check", sql`${table.actionType} IN ('notify_customer')`),
    check(
      "automations_action_channel_check",
      sql`${table.actionChannel} IN ('email', 'sms', 'whatsapp')`,
    ),
  ],
);

export const insertAutomationSchema = createInsertSchema(automations).omit({
  id: true,
  // The definition version is owned by the server and bumped on every change.
  version: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automations.$inferSelect;

// ==================== CONTACT REQUESTS ====================
export const contactRequests = sqliteTable(
  "contact_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    message: text("message").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("contact_requests_status_idx").on(table.status),
    index("contact_requests_created_at_idx").on(table.createdAt),
  ],
);

export const insertContactRequestSchema = createInsertSchema(contactRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContactRequest = z.infer<typeof insertContactRequestSchema>;
export type ContactRequest = typeof contactRequests.$inferSelect;

// ==================== DEMO REQUESTS ====================
export const demoRequests = sqliteTable(
  "demo_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    company: text("company").notNull(),
    storeCount: text("store_count"),
    preferredDate: text("preferred_date"),
    message: text("message"),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("demo_requests_status_idx").on(table.status),
    index("demo_requests_created_at_idx").on(table.createdAt),
  ],
);

export const insertDemoRequestSchema = createInsertSchema(demoRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDemoRequest = z.infer<typeof insertDemoRequestSchema>;
export type DemoRequest = typeof demoRequests.$inferSelect;

// ==================== SELLER TASKS ====================
export const sellerTasks = sqliteTable(
  "seller_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    sellerId: text("seller_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    status: text("status").notNull().default("pending"),
    dueDate: text("due_date").notNull(),
    script: text("script"),
    notes: text("notes"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("seller_tasks_tenant_id_idx").on(table.tenantId),
    index("seller_tasks_seller_id_idx").on(table.sellerId),
    index("seller_tasks_customer_id_idx").on(table.customerId),
    index("seller_tasks_status_idx").on(table.status),
    index("seller_tasks_completed_at_idx").on(table.completedAt),
    index("seller_tasks_type_idx").on(table.type),
    index("seller_tasks_due_date_idx").on(table.dueDate),
    index("seller_tasks_tenant_seller_idx").on(table.tenantId, table.sellerId),
    index("seller_tasks_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const insertSellerTaskSchema = createInsertSchema(sellerTasks).omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSellerTask = z.infer<typeof insertSellerTaskSchema>;
export type SellerTask = typeof sellerTasks.$inferSelect;

// ==================== SELLER GOALS ====================
export const sellerGoals = sqliteTable(
  "seller_goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sellerId: text("seller_id").references(() => users.id, { onDelete: "cascade" }),
    dailyTaskGoal: integer("daily_task_goal").notNull().default(10),
    weeklyTaskGoal: integer("weekly_task_goal").notNull().default(50),
    monthlyTaskGoal: integer("monthly_task_goal").notNull().default(200),
    dailySalesGoal: real("daily_sales_goal").notNull().default(0),
    weeklySalesGoal: real("weekly_sales_goal").notNull().default(0),
    monthlySalesGoal: real("monthly_sales_goal").notNull().default(0),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("seller_goals_tenant_id_idx").on(table.tenantId),
    index("seller_goals_seller_id_idx").on(table.sellerId),
    uniqueIndex("seller_goals_tenant_seller_unique").on(table.tenantId, table.sellerId),
  ],
);

export const insertSellerGoalSchema = createInsertSchema(sellerGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSellerGoal = z.infer<typeof insertSellerGoalSchema>;
export type SellerGoal = typeof sellerGoals.$inferSelect;

// ==================== CUSTOMER INTERACTIONS ====================
export const customerInteractions = sqliteTable(
  "customer_interactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    sellerId: text("seller_id").references(() => users.id, { onDelete: "set null" }),
    taskId: integer("task_id").references(() => sellerTasks.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    channel: text("channel").notNull(),
    notes: text("notes"),
    outcome: text("outcome"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("customer_interactions_tenant_id_idx").on(table.tenantId),
    index("customer_interactions_customer_id_idx").on(table.customerId),
    index("customer_interactions_seller_id_idx").on(table.sellerId),
    index("customer_interactions_task_id_idx").on(table.taskId),
    index("customer_interactions_channel_idx").on(table.channel),
    index("customer_interactions_type_idx").on(table.type),
    index("customer_interactions_created_at_idx").on(table.createdAt),
  ],
);

export const insertCustomerInteractionSchema = createInsertSchema(customerInteractions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomerInteraction = z.infer<typeof insertCustomerInteractionSchema>;
export type CustomerInteraction = typeof customerInteractions.$inferSelect;

// ==================== NOTIFICATIONS ====================
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    channel: text("channel").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("notifications_tenant_id_idx").on(table.tenantId),
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_status_idx").on(table.status),
    index("notifications_created_at_idx").on(table.createdAt),
    index("notifications_tenant_user_idx").on(table.tenantId, table.userId),
  ],
);

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ==================== SESSIONS ====================
export const sessions = sqliteTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: text("sess", { mode: "json" }).notNull(),
    expire: text("expire").notNull(),
  },
  (table) => [index("sessions_expire_idx").on(table.expire)],
);

export type Session = typeof sessions.$inferSelect;

// ==================== DURABLE OUTBOX (ADR 0001) ====================
/**
 * Every asynchronous side effect is enqueued in the same SQLite transaction as
 * the business mutation that requested it. The embedded worker claims jobs with
 * a lease so a crashed process can recover them, and no adapter may report a
 * delivery that was not persisted here.
 */
export const outboxJobs = sqliteTable(
  "outbox_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payloadVersion: integer("payload_version").notNull().default(1),
    payloadJson: text("payload_json").notNull().default("{}"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    availableAt: text("available_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: text("lease_expires_at"),
    lastError: text("last_error"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("outbox_jobs_tenant_idempotency_unique").on(table.tenantId, table.idempotencyKey),
    index("outbox_jobs_claim_idx").on(table.status, table.availableAt),
    index("outbox_jobs_tenant_status_idx").on(table.tenantId, table.status),
    index("outbox_jobs_lease_idx").on(table.leaseExpiresAt),
    check(
      "outbox_jobs_status_check",
      sql`${table.status} IN ('pending', 'processing', 'retry_wait', 'succeeded', 'dead_letter', 'cancelled')`,
    ),
    check("outbox_jobs_attempts_check", sql`${table.attempts} >= 0`),
    check("outbox_jobs_max_attempts_check", sql`${table.maxAttempts} > 0`),
  ],
);

export type OutboxJob = typeof outboxJobs.$inferSelect;

export const OUTBOX_JOB_STATUSES = [
  "pending",
  "processing",
  "retry_wait",
  "succeeded",
  "dead_letter",
  "cancelled",
] as const;
export type OutboxJobStatus = (typeof OUTBOX_JOB_STATUSES)[number];

// ==================== CAMPAIGN EXECUTIONS ====================
export const campaignExecutions = sqliteTable(
  "campaign_executions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    channel: text("channel").notNull(),
    audience: text("audience").notNull(),
    status: text("status").notNull().default("scheduled"),
    requestedBy: text("requested_by").references(() => users.id, { onDelete: "set null" }),
    totalRecipients: integer("total_recipients").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    finishedAt: text("finished_at"),
  },
  (table) => [
    uniqueIndex("campaign_executions_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("campaign_executions_tenant_campaign_idx").on(table.tenantId, table.campaignId),
    index("campaign_executions_tenant_created_idx").on(table.tenantId, table.createdAt),
    check(
      "campaign_executions_status_check",
      sql`${table.status} IN ('scheduled', 'processing', 'completed', 'failed', 'cancelled')`,
    ),
    check("campaign_executions_total_check", sql`${table.totalRecipients} >= 0`),
  ],
);

export type CampaignExecution = typeof campaignExecutions.$inferSelect;

export const campaignRecipients = sqliteTable(
  "campaign_recipients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    executionId: integer("execution_id")
      .notNull()
      .references(() => campaignExecutions.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    providerMessageId: text("provider_message_id"),
    failureReason: text("failure_reason"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("campaign_recipients_execution_customer_unique").on(
      table.executionId,
      table.customerId,
    ),
    index("campaign_recipients_tenant_status_idx").on(table.tenantId, table.status),
    index("campaign_recipients_execution_status_idx").on(table.executionId, table.status),
    check(
      "campaign_recipients_status_check",
      sql`${table.status} IN ('pending', 'delivered', 'failed', 'skipped_opt_out', 'not_configured')`,
    ),
  ],
);

export type CampaignRecipient = typeof campaignRecipients.$inferSelect;

// ==================== AUTOMATION EXECUTIONS ====================
export const automationExecutions = sqliteTable(
  "automation_executions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    automationId: integer("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    automationVersion: integer("automation_version").notNull().default(1),
    triggerType: text("trigger_type").notNull(),
    triggerReference: text("trigger_reference"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("automation_executions_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("automation_executions_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("automation_executions_automation_idx").on(table.automationId, table.createdAt),
    check(
      "automation_executions_status_check",
      sql`${table.status} IN ('pending', 'processing', 'succeeded', 'failed', 'skipped')`,
    ),
  ],
);

export type AutomationExecution = typeof automationExecutions.$inferSelect;

/** Triggers the engine can actually observe. Anything else cannot be activated. */
export const SUPPORTED_AUTOMATION_TRIGGERS = ["customer.created", "order.created"] as const;
export type AutomationTrigger = (typeof SUPPORTED_AUTOMATION_TRIGGERS)[number];

/** Actions the engine can actually perform. */
export const SUPPORTED_AUTOMATION_ACTIONS = ["notify_customer"] as const;
export type AutomationAction = (typeof SUPPORTED_AUTOMATION_ACTIONS)[number];

export const SUPPORTED_DELIVERY_CHANNELS = ["email", "sms", "whatsapp"] as const;
export type DeliveryChannel = (typeof SUPPORTED_DELIVERY_CHANNELS)[number];

// ==================== AUTH SCHEMAS ====================
export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const cpfLoginSchema = z.object({
  cpf: z.string().min(11).max(14),
  password: z.string().min(1),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(12),
    confirmPassword: z.string().min(12),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12),
  name: z.string().min(2),
  tenantName: z.string().min(2).optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(2),
  cpf: z.string().min(11).max(14),
  sellerCode: z.string().min(1),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().optional(),
  role: z.enum(["manager", "seller"]),
  tenantId: z.number().optional(),
});

export const requestPasswordResetSchema = z.object({
  cpf: z.string().min(11).max(14),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CpfLoginInput = z.infer<typeof cpfLoginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

// ==================== ROLE TYPES ====================
export type UserRole = "super_admin" | "manager" | "seller";

export interface SessionUser {
  id: string;
  email?: string | null;
  cpf?: string | null;
  name: string;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  lastPasswordChange?: string | null;
  tenantId?: number;
  role?: UserRole;
}
