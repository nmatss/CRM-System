import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Helper function to generate UUID
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ==================== TENANTS ====================
export const tenants = sqliteTable("tenants", {
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
}, (table) => [
  index("tenants_status_idx").on(table.status),
]);

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// ==================== USERS ====================
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => generateUUID()),
  email: text("email"),
  cpf: text("cpf").unique(),
  sellerCode: text("seller_code"),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  isSuperAdmin: integer("is_super_admin", { mode: "boolean" }).notNull().default(false),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("active"),
  lastPasswordChange: text("last_password_change"),
  lastLogin: text("last_login"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  index("users_email_idx").on(table.email),
  index("users_status_idx").on(table.status),
  index("users_seller_code_idx").on(table.sellerCode),
]);

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
export const tenantUsers = sqliteTable("tenant_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("seller"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  index("tenant_users_tenant_id_idx").on(table.tenantId),
  index("tenant_users_user_id_idx").on(table.userId),
  uniqueIndex("tenant_users_tenant_user_unique").on(table.tenantId, table.userId),
]);

export const insertTenantUserSchema = createInsertSchema(tenantUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTenantUser = z.infer<typeof insertTenantUserSchema>;
export type TenantUser = typeof tenantUsers.$inferSelect;

// ==================== PASSWORD RESETS ====================
export const passwordResets = sqliteTable("password_resets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdByAdmin: integer("created_by_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => [
  index("password_resets_user_id_idx").on(table.userId),
  index("password_resets_expires_at_idx").on(table.expiresAt),
]);

export const insertPasswordResetSchema = createInsertSchema(passwordResets).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export type InsertPasswordReset = z.infer<typeof insertPasswordResetSchema>;
export type PasswordReset = typeof passwordResets.$inferSelect;

// ==================== CUSTOMERS ====================
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  segment: text("segment").notNull(),
  ltv: real("ltv").notNull().default(0),
  lastPurchase: text("last_purchase"),
  favoriteCategory: text("favorite_category"),
  image: text("image"),
  birthDate: text("birth_date"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  index("customers_tenant_id_idx").on(table.tenantId),
  index("customers_email_idx").on(table.email),
  index("customers_segment_idx").on(table.segment),
  index("customers_tenant_segment_idx").on(table.tenantId, table.segment),
]);

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ==================== PRODUCTS ====================
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: real("price").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  status: text("status").notNull().default("active"),
  image: text("image"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  index("products_tenant_id_idx").on(table.tenantId),
  index("products_category_idx").on(table.category),
  index("products_status_idx").on(table.status),
  index("products_tenant_category_idx").on(table.tenantId, table.category),
]);

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// ==================== ORDERS ====================
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  orderId: text("order_id").notNull(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customer: text("customer").notNull(),
  orderDate: text("order_date").default(sql`(datetime('now'))`),
  total: real("total").notNull().default(0),
  status: text("status").notNull().default("pending"),
  items: integer("items").notNull().default(0),
  method: text("method").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  index("orders_tenant_id_idx").on(table.tenantId),
  index("orders_customer_id_idx").on(table.customerId),
  index("orders_status_idx").on(table.status),
  index("orders_order_date_idx").on(table.orderDate),
  index("orders_tenant_status_idx").on(table.tenantId, table.status),
  uniqueIndex("orders_tenant_order_id_unique").on(table.tenantId, table.orderId),
]);

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ==================== CASHBACK RULES ====================
export const cashbackRules = sqliteTable("cashback_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  trigger: text("trigger").notNull(),
  value: real("value").notNull().default(0),
  validity: integer("validity").notNull().default(30),
  status: text("status").notNull().default("active"),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  index("cashback_rules_tenant_id_idx").on(table.tenantId),
  index("cashback_rules_status_idx").on(table.status),
]);

export const insertCashbackRuleSchema = createInsertSchema(cashbackRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCashbackRule = z.infer<typeof insertCashbackRuleSchema>;
export type CashbackRule = typeof cashbackRules.$inferSelect;

// ==================== CAMPAIGNS ====================
export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
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
}, (table) => [
  index("campaigns_tenant_id_idx").on(table.tenantId),
  index("campaigns_status_idx").on(table.status),
  index("campaigns_channel_idx").on(table.channel),
]);

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// ==================== AUTOMATIONS ====================
export const automations = sqliteTable("automations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  stats: text("stats"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  index("automations_tenant_id_idx").on(table.tenantId),
  index("automations_is_active_idx").on(table.isActive),
]);

export const insertAutomationSchema = createInsertSchema(automations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automations.$inferSelect;

// ==================== CONTACT REQUESTS ====================
export const contactRequests = sqliteTable("contact_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  index("contact_requests_status_idx").on(table.status),
  index("contact_requests_created_at_idx").on(table.createdAt),
]);

export const insertContactRequestSchema = createInsertSchema(contactRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContactRequest = z.infer<typeof insertContactRequestSchema>;
export type ContactRequest = typeof contactRequests.$inferSelect;

// ==================== DEMO REQUESTS ====================
export const demoRequests = sqliteTable("demo_requests", {
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
}, (table) => [
  index("demo_requests_status_idx").on(table.status),
  index("demo_requests_created_at_idx").on(table.createdAt),
]);

export const insertDemoRequestSchema = createInsertSchema(demoRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDemoRequest = z.infer<typeof insertDemoRequestSchema>;
export type DemoRequest = typeof demoRequests.$inferSelect;

// ==================== SELLER TASKS ====================
export const sellerTasks = sqliteTable("seller_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
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
}, (table) => [
  index("seller_tasks_tenant_id_idx").on(table.tenantId),
  index("seller_tasks_seller_id_idx").on(table.sellerId),
  index("seller_tasks_customer_id_idx").on(table.customerId),
  index("seller_tasks_status_idx").on(table.status),
  index("seller_tasks_due_date_idx").on(table.dueDate),
  index("seller_tasks_tenant_seller_idx").on(table.tenantId, table.sellerId),
  index("seller_tasks_tenant_status_idx").on(table.tenantId, table.status),
]);

export const insertSellerTaskSchema = createInsertSchema(sellerTasks).omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSellerTask = z.infer<typeof insertSellerTaskSchema>;
export type SellerTask = typeof sellerTasks.$inferSelect;

// ==================== SELLER GOALS ====================
export const sellerGoals = sqliteTable("seller_goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sellerId: text("seller_id").references(() => users.id, { onDelete: "cascade" }),
  dailyTaskGoal: integer("daily_task_goal").notNull().default(10),
  weeklyTaskGoal: integer("weekly_task_goal").notNull().default(50),
  monthlyTaskGoal: integer("monthly_task_goal").notNull().default(200),
  dailySalesGoal: real("daily_sales_goal").notNull().default(0),
  weeklySalesGoal: real("weekly_sales_goal").notNull().default(0),
  monthlySalesGoal: real("monthly_sales_goal").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  index("seller_goals_tenant_id_idx").on(table.tenantId),
  index("seller_goals_seller_id_idx").on(table.sellerId),
  uniqueIndex("seller_goals_tenant_seller_unique").on(table.tenantId, table.sellerId),
]);

export const insertSellerGoalSchema = createInsertSchema(sellerGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSellerGoal = z.infer<typeof insertSellerGoalSchema>;
export type SellerGoal = typeof sellerGoals.$inferSelect;

// ==================== CUSTOMER INTERACTIONS ====================
export const customerInteractions = sqliteTable("customer_interactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  sellerId: text("seller_id").references(() => users.id, { onDelete: "set null" }),
  taskId: integer("task_id").references(() => sellerTasks.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  channel: text("channel").notNull(),
  notes: text("notes"),
  outcome: text("outcome"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  index("customer_interactions_tenant_id_idx").on(table.tenantId),
  index("customer_interactions_customer_id_idx").on(table.customerId),
  index("customer_interactions_seller_id_idx").on(table.sellerId),
  index("customer_interactions_task_id_idx").on(table.taskId),
  index("customer_interactions_type_idx").on(table.type),
  index("customer_interactions_created_at_idx").on(table.createdAt),
]);

export const insertCustomerInteractionSchema = createInsertSchema(customerInteractions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomerInteraction = z.infer<typeof insertCustomerInteractionSchema>;
export type CustomerInteraction = typeof customerInteractions.$inferSelect;

// ==================== AUTH SCHEMAS ====================
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const cpfLoginSchema = z.object({
  cpf: z.string().min(11).max(14),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  tenantName: z.string().min(2).optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(2),
  cpf: z.string().min(11).max(14),
  sellerCode: z.string().min(1),
  email: z.string().email().optional(),
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
  tenantId?: number;
  role?: UserRole;
}
