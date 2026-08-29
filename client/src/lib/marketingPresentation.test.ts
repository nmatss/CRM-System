import { describe, expect, it } from "vitest";
import { campaignStatusLabel, formatMetric } from "./marketingPresentation";

describe("marketing presentation", () => {
  it("não descreve o status persistido como entrega confirmada", () => {
    expect(campaignStatusLabel("sent")).toBe("Marcada como enviada");
    expect(campaignStatusLabel("scheduled")).toContain("sem envio integrado");
  });

  it("não apresenta números inválidos como métricas reais", () => {
    expect(formatMetric(Number.NaN, "%")).toBe("Indisponível");
    expect(formatMetric(12.34, "%")).toBe("12,3%");
  });
});
