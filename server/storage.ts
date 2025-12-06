import { 
  type User, 
  type InsertUser,
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
  customers,
  products,
  orders,
  cashbackRules,
  campaigns,
  automations
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;

  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;

  getOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;

  getCashbackRules(): Promise<CashbackRule[]>;
  getCashbackRule(id: number): Promise<CashbackRule | undefined>;
  createCashbackRule(rule: InsertCashbackRule): Promise<CashbackRule>;

  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;

  getAutomations(): Promise<Automation[]>;
  getAutomation(id: number): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.id, id));
    return result[0];
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(customer).returning();
    return result[0];
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    return result[0];
  }

  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(order).returning();
    return result[0];
  }

  async getCashbackRules(): Promise<CashbackRule[]> {
    return await db.select().from(cashbackRules);
  }

  async getCashbackRule(id: number): Promise<CashbackRule | undefined> {
    const result = await db.select().from(cashbackRules).where(eq(cashbackRules.id, id));
    return result[0];
  }

  async createCashbackRule(rule: InsertCashbackRule): Promise<CashbackRule> {
    const result = await db.insert(cashbackRules).values(rule).returning();
    return result[0];
  }

  async getCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns);
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const result = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return result[0];
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const result = await db.insert(campaigns).values(campaign).returning();
    return result[0];
  }

  async getAutomations(): Promise<Automation[]> {
    return await db.select().from(automations);
  }

  async getAutomation(id: number): Promise<Automation | undefined> {
    const result = await db.select().from(automations).where(eq(automations.id, id));
    return result[0];
  }

  async createAutomation(automation: InsertAutomation): Promise<Automation> {
    const result = await db.insert(automations).values(automation).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
