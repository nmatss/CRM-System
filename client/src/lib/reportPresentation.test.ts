import { describe, expect, it } from "vitest";
import {
  toReportDate,
  buildCustomerExportRows,
  buildOrderExportRows,
  buildReportQuery,
  campaignMetricsUnavailableReason,
  formatCurrencyFromCents,
  formatReportMonth,
  formatReportOrderDate,
  type ReportsData,
} from "./reportPresentation";

describe("report presentation", () => {
  it("builds the strict UTC query with calendar dates", () => {
    const query = new URLSearchParams(
      buildReportQuery(new Date(2026, 0, 2), new Date(2026, 10, 9)),
    );

    expect(Object.fromEntries(query)).toEqual({
      startDate: "2026-01-02",
      endDate: "2026-11-09",
      timezone: "UTC",
    });
  });

  it("formats integer cents and UTC date/month values", () => {
    expect(formatCurrencyFromCents(1999)).toMatch(/19,99/);
    expect(formatCurrencyFromCents(1.5)).toBe("Valor indisponível");
    expect(formatReportMonth("2026-08")).toContain("2026");
    expect(formatReportOrderDate("2026-08-29T23:30:00-03:00")).toBe("30/08/2026");
  });

  it("exports only real order and customer fields", () => {
    const orders: ReportsData["orders"] = [
      {
        id: 1,
        orderId: "PED-001",
        customerId: 2,
        customer: "Cliente",
        orderDate: "2026-08-29T00:00:00.000Z",
        total: 19.99,
        totalCents: 1999,
        status: "Pago",
      },
    ];
    const customers: ReportsData["topCustomers"] = [
      {
        id: 2,
        name: "Cliente",
        email: "cliente@example.com",
        segment: "Regular",
        ltv: 19.99,
        ltvCents: 1999,
        totalSpent: 19.99,
        totalSpentCents: 1999,
        orderCount: 1,
      },
    ];

    expect(buildOrderExportRows(orders)[0]).toMatchObject({
      orderId: "PED-001",
      totalCents: 1999,
      total: expect.stringMatching(/19,99/),
    });
    expect(buildCustomerExportRows(customers)[0]).toMatchObject({
      totalSpentCents: 1999,
      orderCount: 1,
    });
  });

  it("explains missing campaign attribution without presenting zero as a metric", () => {
    expect(campaignMetricsUnavailableReason("attribution_events_not_implemented")).toContain(
      "ainda não implementada",
    );
  });
});

describe("toReportDate", () => {
  it("serialises the calendar day the user picked, not an instant", () => {
    // The API rejects a full ISO instant with 400, which used to break the
    // whole reports screen.
    expect(toReportDate(new Date(2026, 7, 1, 0, 0, 0))).toBe("2026-08-01");
    expect(toReportDate(new Date(2026, 7, 31, 23, 59, 59))).toBe("2026-08-31");
    expect(toReportDate(new Date(2026, 0, 5, 12, 0, 0))).toBe("2026-01-05");
  });

  it("pads month and day", () => {
    expect(toReportDate(new Date(2026, 2, 9))).toBe("2026-03-09");
  });
});
