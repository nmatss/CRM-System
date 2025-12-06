import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
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

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
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

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
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

export const cashbackRules = pgTable("cashback_rules", {
  id: serial("id").primaryKey(),
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

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
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

export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
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
