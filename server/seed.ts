import { storage } from "./storage";
import {
  type InsertCustomer,
  type InsertProduct,
  type InsertOrder,
  type InsertCashbackRule,
  type InsertCampaign,
} from "@shared/schema";

// ==================== SEED DATA GENERATORS ====================

const firstNames = [
  "Ana",
  "Bruno",
  "Carlos",
  "Daniela",
  "Eduardo",
  "Fernanda",
  "Gabriel",
  "Helena",
  "Igor",
  "Julia",
  "Lucas",
  "Mariana",
  "Nicolas",
  "Olivia",
  "Pedro",
  "Rafaela",
  "Sofia",
  "Thiago",
  "Valentina",
  "William",
  "Beatriz",
  "Caio",
  "Diana",
  "Felipe",
  "Giovanna",
  "Henrique",
  "Isabella",
  "João",
  "Larissa",
  "Mateus",
  "Natalia",
  "Otavio",
  "Paula",
  "Rafael",
  "Sandra",
  "Tiago",
  "Vanessa",
  "Yuri",
  "Amanda",
  "Bernardo",
  "Camila",
  "Diego",
  "Elisa",
  "Fabio",
  "Gabriela",
  "Hugo",
  "Isabela",
  "Jose",
  "Karen",
  "Leonardo",
  "Melissa",
  "Nathan",
  "Patricia",
  "Ricardo",
  "Silvia",
  "Victor",
];

const lastNames = [
  "Silva",
  "Santos",
  "Oliveira",
  "Souza",
  "Rodrigues",
  "Ferreira",
  "Alves",
  "Pereira",
  "Lima",
  "Gomes",
  "Costa",
  "Ribeiro",
  "Martins",
  "Carvalho",
  "Rocha",
  "Almeida",
  "Nascimento",
  "Araujo",
  "Melo",
  "Barbosa",
  "Cardoso",
  "Correia",
  "Dias",
  "Fernandes",
  "Garcia",
  "Mendes",
  "Monteiro",
  "Moreira",
  "Nunes",
  "Pinto",
  "Ramos",
  "Reis",
  "Ribeiro",
  "Santana",
  "Teixeira",
  "Vieira",
  "Freitas",
  "Castro",
  "Pires",
  "Azevedo",
];

const productNames = {
  Roupas: [
    "Camiseta Básica",
    "Calça Jeans",
    "Vestido Floral",
    "Blusa Social",
    "Shorts Jeans",
    "Jaqueta de Couro",
    "Moletom com Capuz",
    "Saia Midi",
    "Camisa Polo",
    "Blazer Executivo",
    "Legging Fitness",
    "Regata Esportiva",
    "Calça Alfaiataria",
    "Top Cropped",
    "Bermuda Tactel",
  ],
  Eletrônicos: [
    "Fone de Ouvido Bluetooth",
    "Smartwatch",
    "Carregador Portátil",
    "Mouse Gamer",
    "Teclado Mecânico",
    "Webcam HD",
    "Suporte para Notebook",
    "Caixa de Som Bluetooth",
    "Cabo USB-C",
    "Adaptador HDMI",
    "Pendrive 64GB",
    "HD Externo 1TB",
    "Mousepad RGB",
    "Ring Light",
    "Microfone Condensador",
  ],
  Acessórios: [
    "Relógio Digital",
    "Óculos de Sol",
    "Bolsa Transversal",
    "Carteira de Couro",
    "Cinto Masculino",
    "Mochila Executiva",
    "Pulseira de Prata",
    "Brinco Argola",
    "Colar Folheado",
    "Boné Trucker",
    "Lenço de Seda",
    "Chaveiro Personalizado",
    "Porta-Cartões",
    "Necessaire",
    "Guarda-Chuva Automático",
  ],
  Casa: [
    "Jogo de Cama Casal",
    "Toalha de Banho",
    "Tapete Decorativo",
    "Almofada Decorativa",
    "Cortina Blackout",
    "Organizador Multiuso",
    "Conjunto de Panelas",
    "Jogo de Copos",
    "Luminária de Mesa",
    "Espelho Decorativo",
    "Quadro Decorativo",
    "Vaso Cerâmica",
    "Difusor de Aromas",
    "Porta Retratos",
    "Cesto de Roupa",
  ],
  Beleza: [
    "Kit Maquiagem",
    "Perfume Importado",
    "Creme Hidratante",
    "Shampoo Premium",
    "Condicionador",
    "Máscara Facial",
    "Sérum Vitamina C",
    "Batom Matte",
    "Base Líquida",
    "Pó Compacto",
    "Paleta de Sombras",
    "Rímel",
    "Delineador",
    "Esmalte Gel",
    "Removedor de Maquiagem",
  ],
};

const segments = ["VIP", "Frequente", "Ocasional", "Novo", "Inativo"];
const segmentDistribution = [0.1, 0.25, 0.4, 0.15, 0.1]; // Percentages

const orderStatuses = ["Pendente", "Processando", "Enviado", "Entregue", "Cancelado"];
const statusDistribution = [0.05, 0.1, 0.15, 0.6, 0.1]; // Percentages

const channels = ["Email", "WhatsApp", "SMS"];
const audiences = ["Todos", "VIP", "Frequente", "Novo", "Inativos"];

// ==================== HELPER FUNCTIONS ====================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

function generatePhone(): string {
  const ddd = randomInt(11, 99);
  const prefix = randomInt(90000, 99999);
  const suffix = randomInt(1000, 9999);
  return `(${ddd}) ${prefix}-${suffix}`;
}

function generateEmail(name: string): string {
  const cleanName = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".");
  const domains = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "uol.com.br"];
  return `${cleanName}${randomInt(1, 999)}@${randomElement(domains)}`;
}

function formatDate(date: Date): string {
  return date.toISOString();
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// ==================== SEED FUNCTIONS ====================

export async function seedCustomers(tenantId: number, count: number = 100): Promise<number[]> {
  console.log(`🌱 Seeding ${count} customers...`);

  const customers: InsertCustomer[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const fullName = `${firstName} ${lastName}`;
    const segment = weightedRandom(segments, segmentDistribution);

    // Generate segment-appropriate LTV
    let ltv: number;
    switch (segment) {
      case "VIP":
        ltv = randomFloat(10000, 50000);
        break;
      case "Frequente":
        ltv = randomFloat(2000, 10000);
        break;
      case "Ocasional":
        ltv = randomFloat(500, 2000);
        break;
      case "Novo":
        ltv = randomFloat(100, 500);
        break;
      default: // Inativo
        ltv = randomFloat(100, 1000);
    }

    // Last purchase date based on segment
    let lastPurchase: string | null;
    if (segment === "Inativo") {
      const threeMonthsAgo = addMonths(now, -3);
      lastPurchase = formatDate(randomDate(addMonths(now, -12), threeMonthsAgo));
    } else if (segment === "Novo") {
      lastPurchase = formatDate(randomDate(addMonths(now, -1), now));
    } else {
      lastPurchase = formatDate(randomDate(addMonths(now, -2), now));
    }

    customers.push({
      tenantId,
      name: fullName,
      email: generateEmail(fullName),
      phone: generatePhone(),
      segment,
      ltv,
      lastPurchase,
      favoriteCategory: randomElement(Object.keys(productNames)),
      birthDate: formatDate(randomDate(new Date(1960, 0, 1), new Date(2005, 11, 31))),
    });
  }

  const customerIds: number[] = [];
  for (const customer of customers) {
    const created = await storage.createCustomer(customer);
    customerIds.push(created.id);
  }

  console.log(`✅ Created ${customerIds.length} customers`);
  return customerIds;
}

export async function seedProducts(tenantId: number, count: number = 50): Promise<number[]> {
  console.log(`🌱 Seeding ${count} products...`);

  const products: InsertProduct[] = [];
  const categories = Object.keys(productNames);

  let productsCreated = 0;

  for (const category of categories) {
    const categoryProducts = productNames[category as keyof typeof productNames];
    const productsPerCategory = Math.ceil(count / categories.length);

    for (let i = 0; i < Math.min(productsPerCategory, categoryProducts.length); i++) {
      if (productsCreated >= count) break;

      const name = categoryProducts[i];
      let price: number;

      // Category-based pricing
      switch (category) {
        case "Eletrônicos":
          price = randomFloat(50, 800);
          break;
        case "Roupas":
          price = randomFloat(30, 300);
          break;
        case "Acessórios":
          price = randomFloat(20, 200);
          break;
        case "Casa":
          price = randomFloat(40, 400);
          break;
        case "Beleza":
          price = randomFloat(25, 250);
          break;
        default:
          price = randomFloat(20, 200);
      }

      products.push({
        tenantId,
        name,
        category,
        price,
        stock: randomInt(0, 500),
        status: Math.random() > 0.1 ? "active" : "inactive",
      });

      productsCreated++;
    }
  }

  const productIds: number[] = [];
  for (const product of products) {
    const created = await storage.createProduct(product);
    productIds.push(created.id);
  }

  console.log(`✅ Created ${productIds.length} products`);
  return productIds;
}

export async function seedOrders(
  tenantId: number,
  customerIds: number[],
  count: number = 500,
): Promise<number[]> {
  console.log(`🌱 Seeding ${count} orders...`);

  const orders: InsertOrder[] = [];
  const now = new Date();
  const twelveMonthsAgo = addMonths(now, -12);

  // Get all customers to access their names
  const allCustomers = await storage.getCustomers(tenantId);
  const customerMap = new Map(allCustomers.data.map((c) => [c.id, c]));

  for (let i = 0; i < count; i++) {
    const customerId = randomElement(customerIds);
    const customer = customerMap.get(customerId);
    if (!customer) continue;

    const orderDate = randomDate(twelveMonthsAgo, now);
    const status = weightedRandom(orderStatuses, statusDistribution);
    const items = randomInt(1, 5);
    const total = randomFloat(50, 5000);

    orders.push({
      tenantId,
      orderId: `ORD-${Date.now()}-${randomInt(1000, 9999)}`,
      customerId,
      customer: customer.name,
      orderDate: formatDate(orderDate),
      total,
      status,
      items,
      method: randomElement(["Cartão de Crédito", "Pix", "Boleto", "Débito"]),
    });
  }

  const orderIds: number[] = [];
  for (const order of orders) {
    const created = await storage.createOrder(order);
    orderIds.push(created.id);
  }

  console.log(`✅ Created ${orderIds.length} orders`);
  return orderIds;
}

export async function seedCashbackRules(tenantId: number, count: number = 7): Promise<number[]> {
  console.log(`🌱 Seeding ${count} cashback rules...`);

  const rules: InsertCashbackRule[] = [
    {
      tenantId,
      name: "Cashback Primeira Compra",
      trigger: "Primeira Compra",
      value: 10,
      validity: 30,
      status: "active",
      usageCount: randomInt(10, 50),
    },
    {
      tenantId,
      name: "Cashback Compra Acima de R$ 200",
      trigger: "Valor Mínimo",
      value: 5,
      validity: 60,
      status: "active",
      usageCount: randomInt(50, 150),
    },
    {
      tenantId,
      name: "Cashback Aniversário",
      trigger: "Aniversário",
      value: 15,
      validity: 30,
      status: "active",
      usageCount: randomInt(5, 20),
    },
    {
      tenantId,
      name: "Cashback Cliente VIP",
      trigger: "Segmento VIP",
      value: 8,
      validity: 90,
      status: "active",
      usageCount: randomInt(20, 80),
    },
    {
      tenantId,
      name: "Cashback Black Friday",
      trigger: "Campanha Especial",
      value: 20,
      validity: 15,
      status: "inactive",
      usageCount: randomInt(100, 300),
    },
    {
      tenantId,
      name: "Cashback Indicação de Amigo",
      trigger: "Indicação",
      value: 12,
      validity: 45,
      status: "active",
      usageCount: randomInt(15, 40),
    },
    {
      tenantId,
      name: "Cashback Compras Recorrentes",
      trigger: "Fidelidade",
      value: 7,
      validity: 60,
      status: "active",
      usageCount: randomInt(30, 100),
    },
  ];

  const ruleIds: number[] = [];
  for (const rule of rules.slice(0, count)) {
    const created = await storage.createCashbackRule(rule);
    ruleIds.push(created.id);
  }

  console.log(`✅ Created ${ruleIds.length} cashback rules`);
  return ruleIds;
}

export async function seedCashbackTransactions(
  tenantId: number,
  customerIds: number[],
  ruleIds: number[],
  orderIds: number[],
): Promise<void> {
  console.log(`🌱 Seeding cashback transactions...`);

  const now = new Date();

  // Create cashback transactions for random customers
  const customersWithCashback = customerIds.slice(0, Math.floor(customerIds.length * 0.6));

  for (const customerId of customersWithCashback) {
    let balance = 0;
    const transactionCount = 3 + (customerId % 3);

    for (let i = 0; i < transactionCount; i++) {
      const type = i % 4 === 3 && balance > 0 ? "debit" : "credit";
      const generatedCents = 500 + ((customerId * 37 + i * 911) % 9501);
      const amountCents =
        type === "debit" ? Math.min(generatedCents, Math.round(balance * 100)) : generatedCents;
      const idempotencyKey = `seed:cashback:${tenantId}:${customerId}:${i}`;

      if (type === "credit") {
        balance += amountCents / 100;
        const expiresAt = addMonths(now, 1 + (i % 3));
        await storage.creditCashback(tenantId, {
          customerId,
          ruleId: ruleIds[(customerId + i) % ruleIds.length],
          orderId: orderIds[(customerId + i) % orderIds.length] ?? null,
          amountCents,
          idempotencyKey,
          source: "seed",
          description: "Cashback por compra",
          expiresAt: expiresAt.toISOString(),
        });
      } else {
        balance -= amountCents / 100;
        await storage.debitCashback(tenantId, {
          customerId,
          orderId: orderIds[(customerId + i) % orderIds.length] ?? null,
          amountCents,
          idempotencyKey,
          source: "seed",
          description: "Resgate de cashback",
        });
      }
    }
  }
  console.log(`✅ Seeded cashback ledger for ${customersWithCashback.length} customers`);
}

export async function seedCampaigns(tenantId: number, count: number = 20): Promise<number[]> {
  console.log(`🌱 Seeding ${count} campaigns...`);

  const campaigns: InsertCampaign[] = [];
  const now = new Date();
  const campaignNames = [
    "Promoção de Verão",
    "Black Friday 2024",
    "Liquidação de Inverno",
    "Dia das Mães",
    "Volta às Aulas",
    "Cyber Monday",
    "Semana do Cliente",
    "Lançamento Nova Coleção",
    "Aniversário da Loja",
    "Natal 2024",
    "Páscoa 2024",
    "Dia dos Pais",
    "Dia das Crianças",
    "Prime Day",
    "Frete Grátis Weekend",
    "Desconto Progressivo",
    "Compre 2 Leve 3",
    "Clube de Vantagens",
    "Cashback Dobrado",
    "Flash Sale",
  ];

  for (let i = 0; i < Math.min(count, campaignNames.length); i++) {
    const sent = randomInt(100, 5000);
    const openRate = randomFloat(15, 35);
    const conversion = randomFloat(0.5, 3);
    const revenue = sent * conversion * randomFloat(50, 200);

    campaigns.push({
      tenantId,
      name: campaignNames[i],
      channel: randomElement(channels),
      audience: randomElement(audiences),
      message: `Confira nossas ofertas imperdíveis em ${campaignNames[i]}!`,
      sent,
      openRate,
      conversion,
      revenue,
      status: i < count - 3 ? "sent" : randomElement(["draft", "scheduled"]),
      scheduledAt: i >= count - 3 ? formatDate(addMonths(now, 1)) : null,
    });
  }

  const campaignIds: number[] = [];
  for (const campaign of campaigns) {
    const created = await storage.createCampaign(campaign);
    campaignIds.push(created.id);
  }

  console.log(`✅ Created ${campaignIds.length} campaigns`);
  return campaignIds;
}

// ==================== MAIN SEED FUNCTION ====================

export async function seedDatabase(tenantId: number): Promise<void> {
  console.log("");
  console.log("========================================");
  console.log("🌱 Starting database seeding...");
  console.log("========================================");
  console.log("");

  try {
    // Check if already seeded
    const existingCustomers = await storage.getCustomers(tenantId);
    if (existingCustomers.total > 0) {
      console.log("⚠️  Database already contains data. Skipping seed.");
      return;
    }

    // Seed in order (respecting foreign keys)
    const customerIds = await seedCustomers(tenantId, 100);
    const productIds = await seedProducts(tenantId, 50);
    const orderIds = await seedOrders(tenantId, customerIds, 500);
    const ruleIds = await seedCashbackRules(tenantId, 7);
    await seedCashbackTransactions(tenantId, customerIds, ruleIds, orderIds);
    await seedCampaigns(tenantId, 20);

    console.log("");
    console.log("========================================");
    console.log("✅ Database seeding completed!");
    console.log("========================================");
    console.log("");
    console.log("📊 Summary:");
    console.log(`   - Customers: ${customerIds.length}`);
    console.log(`   - Products: ${productIds.length}`);
    console.log(`   - Orders: ${orderIds.length}`);
    console.log(`   - Cashback Rules: ${ruleIds.length}`);
    console.log(`   - Campaigns: 20`);
    console.log("");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// ==================== CHECK AND SEED ====================

export async function checkAndSeed(): Promise<void> {
  // Only seed in development mode
  if (process.env.NODE_ENV === "production") {
    return;
  }

  try {
    // Get the first tenant (demo tenant)
    const tenants = await storage.getTenants();

    if (tenants.length === 0) {
      console.log("⚠️  No tenants found. Please create a tenant first.");
      return;
    }

    const demoTenant = tenants[0];
    console.log(`🏢 Using tenant: ${demoTenant.name} (ID: ${demoTenant.id})`);

    await seedDatabase(demoTenant.id);
  } catch (error) {
    console.error("❌ Error in checkAndSeed:", error);
  }
}
