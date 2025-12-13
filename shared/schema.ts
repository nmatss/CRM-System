import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== TENANTS ====================
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  logo: text("logo"),
  primaryColor: text("primary_color").default("#9333ea"),
  secondaryColor: text("secondary_color").default("#db2777"),
  loginMessage: text("login_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// ==================== USERS ====================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ==================== TENANT USERS ====================
export const tenantUsers = pgTable("tenant_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("seller"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTenantUserSchema = createInsertSchema(tenantUsers).omit({
  id: true,
  createdAt: true,
});

export type InsertTenantUser = z.infer<typeof insertTenantUserSchema>;
export type TenantUser = typeof tenantUsers.$inferSelect;

// ==================== CUSTOMERS ====================
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  segment: text("segment").notNull(),
  ltv: text("ltv").notNull(),
  lastPurchase: text("last_purchase").notNull(),
  favoriteCategory: text("favorite_category"),
  image: text("image"),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ==================== PRODUCTS ====================
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: text("price").notNull(),
  stock: integer("stock").notNull(),
  status: text("status").notNull(),
  image: text("image"),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// ==================== ORDERS ====================
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  orderId: text("order_id").notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  customer: text("customer").notNull(),
  date: text("date").notNull(),
  total: text("total").notNull(),
  status: text("status").notNull(),
  items: integer("items").notNull(),
  method: text("method").notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ==================== CASHBACK RULES ====================
export const cashbackRules = pgTable("cashback_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  trigger: text("trigger").notNull(),
  value: text("value").notNull(),
  validity: text("validity").notNull(),
  status: text("status").notNull(),
  usage: integer("usage").notNull().default(0),
});

export const insertCashbackRuleSchema = createInsertSchema(cashbackRules).omit({
  id: true,
});

export type InsertCashbackRule = z.infer<typeof insertCashbackRuleSchema>;
export type CashbackRule = typeof cashbackRules.$inferSelect;

// ==================== CAMPAIGNS ====================
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  channel: text("channel").notNull(),
  audience: text("audience").notNull(),
  sent: integer("sent").notNull().default(0),
  openRate: text("open_rate").notNull(),
  conversion: text("conversion").notNull(),
  revenue: text("revenue").notNull(),
  status: text("status").notNull(),
  date: text("date").notNull(),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// ==================== AUTOMATIONS ====================
export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  active: integer("active").notNull().default(1),
  stats: text("stats").notNull(),
});

export const insertAutomationSchema = createInsertSchema(automations).omit({
  id: true,
});

export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automations.$inferSelect;

// ==================== CONTACT REQUESTS ====================
export const contactRequests = pgTable("contact_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContactRequestSchema = createInsertSchema(contactRequests).omit({
  id: true,
  createdAt: true,
});

export type InsertContactRequest = z.infer<typeof insertContactRequestSchema>;
export type ContactRequest = typeof contactRequests.$inferSelect;

// ==================== DEMO REQUESTS ====================
export const demoRequests = pgTable("demo_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company").notNull(),
  storeCount: text("store_count"),
  preferredDate: text("preferred_date"),
  message: text("message"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDemoRequestSchema = createInsertSchema(demoRequests).omit({
  id: true,
  createdAt: true,
});

export type InsertDemoRequest = z.infer<typeof insertDemoRequestSchema>;
export type DemoRequest = typeof demoRequests.$inferSelect;

// ==================== SELLER TASKS ====================
export const sellerTasks = pgTable("seller_tasks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  sellerId: varchar("seller_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  dueDate: text("due_date").notNull(),
  script: text("script"),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSellerTaskSchema = createInsertSchema(sellerTasks).omit({
  id: true,
  completedAt: true,
  createdAt: true,
});

export type InsertSellerTask = z.infer<typeof insertSellerTaskSchema>;
export type SellerTask = typeof sellerTasks.$inferSelect;

// ==================== AUTH SCHEMAS ====================
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  tenantName: z.string().min(2).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// ==================== ROLE TYPES ====================
export type UserRole = "super_admin" | "manager" | "seller";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  tenantId?: number;
  role?: UserRole;
}
