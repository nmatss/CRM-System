import { describe, expect, it } from "vitest";
import { summarizeCashbackTransactions } from "./cashbackMetrics";

describe("summarizeCashbackTransactions", () => {
  it("calcula os totais e a taxa a partir das transações reais", () => {
    const summary = summarizeCashbackTransactions([
      { type: "credit", amount: 100 },
      { type: "credit", amount: 50 },
      { type: "debit", amount: 30 },
    ]);

    expect(summary).toEqual({
      totalCredited: 150,
      totalRedeemed: 30,
      redemptionRate: 20,
    });
  });

  it("não produz divisão inválida quando não existem créditos", () => {
    expect(summarizeCashbackTransactions([{ type: "debit", amount: 25 }])).toEqual({
      totalCredited: 0,
      totalRedeemed: 25,
      redemptionRate: 0,
    });
  });
});
