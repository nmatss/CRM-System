import type { CashbackTransaction } from "@shared/schema";

export interface CashbackSummary {
  totalCredited: number;
  totalRedeemed: number;
  redemptionRate: number;
}

export function summarizeCashbackTransactions(
  transactions: Pick<CashbackTransaction, "type" | "amount">[],
): CashbackSummary {
  const summary = transactions.reduce(
    (totals, transaction) => {
      if (transaction.type === "credit") totals.totalCredited += transaction.amount;
      if (transaction.type === "debit") totals.totalRedeemed += transaction.amount;
      return totals;
    },
    { totalCredited: 0, totalRedeemed: 0 },
  );

  return {
    ...summary,
    redemptionRate:
      summary.totalCredited > 0 ? (summary.totalRedeemed / summary.totalCredited) * 100 : 0,
  };
}
