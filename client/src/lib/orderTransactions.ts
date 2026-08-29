import type { Order, Product } from "@shared/schema";

export type OrderStatus =
  "Pendente" | "Processando" | "Pago" | "Enviado" | "Entregue" | "Cancelado";

export interface SelectedOrderProduct {
  product: Pick<Product, "id" | "name" | "price" | "stock">;
  quantity: number;
}

export interface TransactionalOrderForm {
  customerId?: number;
  customer: string;
  orderDate: string;
  status: "Pendente";
  method: string;
  lineItems: SelectedOrderProduct[];
}

export interface SafeOrderUpdateForm {
  customerId?: number;
  customer: string;
  orderDate: string;
  status: OrderStatus;
  method: string;
}

export function priceToCents(price: number): number {
  return Math.round(Number(price) * 100);
}

export function getOrderPreview(lineItems: SelectedOrderProduct[]) {
  const rows = lineItems.map(({ product, quantity }) => {
    const unitPriceCents = priceToCents(product.price);
    return {
      productId: product.id,
      name: product.name,
      stock: product.stock,
      quantity,
      unitPriceCents,
      lineTotalCents: unitPriceCents * quantity,
      hasInvalidQuantity: !Number.isSafeInteger(quantity) || quantity <= 0,
      hasInsufficientStock: quantity > product.stock,
    };
  });

  return {
    rows,
    totalCents: rows.reduce((total, row) => total + row.lineTotalCents, 0),
    totalItems: rows.reduce((total, row) => total + row.quantity, 0),
    isValid:
      rows.length > 0 && rows.every((row) => !row.hasInvalidQuantity && !row.hasInsufficientStock),
  };
}

export function buildTransactionalOrderPayload(form: TransactionalOrderForm) {
  return {
    ...(form.customerId ? { customerId: form.customerId } : {}),
    customer: form.customer.trim(),
    method: form.method,
    orderDate: form.orderDate,
    status: form.status,
    lineItems: form.lineItems.map(({ product, quantity }) => ({
      productId: product.id,
      quantity,
    })),
  };
}

export function buildSafeOrderUpdatePayload(form: SafeOrderUpdateForm) {
  return {
    ...(form.customerId ? { customerId: form.customerId } : { customerId: null }),
    customer: form.customer.trim(),
    orderDate: form.orderDate,
    status: form.status,
    method: form.method,
  };
}

export function orderActionErrorDescription(
  error: unknown,
  action: "criar" | "atualizar" | "cancelar",
) {
  const message = error instanceof Error ? error.message : "";
  if (/^403(?:\s|:)/.test(message)) {
    return "Você não tem permissão para realizar esta ação.";
  }
  if (message.includes("INSUFFICIENT_STOCK")) {
    return "O estoque mudou e não é mais suficiente. Revise as quantidades e tente novamente.";
  }
  if (message.includes("INVALID_TENANT_REFERENCE")) {
    return "O cliente ou produto selecionado não está mais disponível. Atualize os dados e tente novamente.";
  }
  if (message.includes("ORDER_ALREADY_CANCELLED")) {
    return "Este pedido já foi cancelado e não pode ser reativado.";
  }
  if (message.includes("VALIDATION_ERROR") || /^400(?:\s|:)/.test(message)) {
    return "Revise os dados do pedido e tente novamente.";
  }
  return `Não foi possível ${action} o pedido.`;
}

export function orderToSafeUpdateForm(order: Order): SafeOrderUpdateForm {
  return {
    customerId: order.customerId ?? undefined,
    customer: order.customer,
    orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split("T")[0] : "",
    status: order.status as OrderStatus,
    method: order.method,
  };
}
