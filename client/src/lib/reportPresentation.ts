export interface ReportsData {
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
  salesByCategory: Array<{
    name: string;
    value: number;
    valueCents: number;
    quantity: number;
  }>;
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

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatReportDateParam(value: Date): string {
  return `${value.getFullYear()}-${twoDigits(value.getMonth() + 1)}-${twoDigits(value.getDate())}`;
}

export function buildReportQuery(from: Date, to: Date): string {
  return new URLSearchParams({
    startDate: formatReportDateParam(from),
    endDate: formatReportDateParam(to),
    timezone: "UTC",
  }).toString();
}

export function formatCurrencyFromCents(value: number): string {
  if (!Number.isSafeInteger(value)) return "Valor indisponível";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

export function formatReportMonth(value: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  const parsed = new Date(`${value}-01T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatReportOrderDate(value: string | null): string {
  if (!value) return "Data indisponível";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data inválida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(parsed);
}

export function campaignMetricsUnavailableReason(reason: string): string {
  if (reason === "attribution_events_not_implemented") {
    return "Atribuição de abertura, conversão e receita ainda não implementada.";
  }
  return "Métricas de atribuição indisponíveis para esta campanha.";
}

export function buildOrderExportRows(
  orders: ReportsData["orders"],
): Array<Record<string, unknown>> {
  return orders.map((order) => ({
    orderId: order.orderId,
    customer: order.customer,
    orderDate: order.orderDate ?? "",
    totalCents: order.totalCents,
    total: formatCurrencyFromCents(order.totalCents),
    status: order.status,
  }));
}

export function buildCustomerExportRows(
  customers: ReportsData["topCustomers"],
): Array<Record<string, unknown>> {
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    segment: customer.segment,
    totalSpentCents: customer.totalSpentCents,
    totalSpent: formatCurrencyFromCents(customer.totalSpentCents),
    orderCount: customer.orderCount,
  }));
}
