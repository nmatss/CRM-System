import { describe, expect, it } from "vitest";
import {
  buildSafeOrderUpdatePayload,
  buildTransactionalOrderPayload,
  getOrderPreview,
  orderActionErrorDescription,
} from "./orderTransactions";

const product = { id: 4, name: "Produto", price: 12.5, stock: 3 };

describe("order transactions", () => {
  it("derives monetary preview and stock validity from selected products", () => {
    expect(getOrderPreview([{ product, quantity: 2 }])).toEqual({
      rows: [
        {
          productId: 4,
          name: "Produto",
          stock: 3,
          quantity: 2,
          unitPriceCents: 1250,
          lineTotalCents: 2500,
          hasInvalidQuantity: false,
          hasInsufficientStock: false,
        },
      ],
      totalCents: 2500,
      totalItems: 2,
      isValid: true,
    });
    expect(getOrderPreview([{ product, quantity: 4 }]).isValid).toBe(false);
  });

  it("builds the strict create contract without client-derived commercial fields", () => {
    const payload = buildTransactionalOrderPayload({
      customerId: 2,
      customer: " Cliente ",
      method: "PIX",
      orderDate: "2026-08-29",
      status: "Pendente",
      lineItems: [{ product, quantity: 2 }],
    });

    expect(payload).toEqual({
      customerId: 2,
      customer: "Cliente",
      method: "PIX",
      orderDate: "2026-08-29",
      status: "Pendente",
      lineItems: [{ productId: 4, quantity: 2 }],
    });
    expect(payload).not.toHaveProperty("orderId");
    expect(payload).not.toHaveProperty("total");
    expect(payload).not.toHaveProperty("items");
  });

  it("builds only fields accepted by the strict update contract", () => {
    const payload = buildSafeOrderUpdatePayload({
      customer: "Cliente",
      orderDate: "2026-08-29",
      status: "Pago",
      method: "PIX",
    });
    expect(payload).toEqual({
      customerId: null,
      customer: "Cliente",
      orderDate: "2026-08-29",
      status: "Pago",
      method: "PIX",
    });
    expect(payload).not.toHaveProperty("lineItems");
    expect(payload).not.toHaveProperty("total");
  });

  it("maps known domain errors without exposing arbitrary server details", () => {
    expect(
      orderActionErrorDescription(new Error('400: {"code":"INSUFFICIENT_STOCK"}'), "criar"),
    ).toContain("estoque");
    expect(
      orderActionErrorDescription(new Error('400: {"code":"INVALID_TENANT_REFERENCE"}'), "criar"),
    ).toContain("não está mais disponível");
    expect(orderActionErrorDescription(new Error("500: internal details"), "criar")).toBe(
      "Não foi possível criar o pedido.",
    );
  });
});
