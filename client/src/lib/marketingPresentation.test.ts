import { describe, expect, it } from "vitest";
import {
  automationExecutionStatusLabel,
  campaignStatusLabel,
  executionStatusLabel,
  formatMetric,
  formatOptionalMetric,
  recipientStatusLabel,
} from "./marketingPresentation";

describe("marketing presentation", () => {
  it("descreve o estado real de campanha, execução e destinatário", () => {
    expect(campaignStatusLabel("scheduled")).toBe("Envio agendado");
    expect(campaignStatusLabel("sent")).toBe("Enviada");
    expect(executionStatusLabel("completed")).toBe("Concluída");
    expect(automationExecutionStatusLabel("succeeded")).toBe("Executada");
  });

  it("distingue entrega confirmada de canal sem provedor", () => {
    expect(recipientStatusLabel("delivered")).toBe("Entregue");
    expect(recipientStatusLabel("not_configured")).toBe("Canal não configurado");
    expect(recipientStatusLabel("skipped_opt_out")).toBe("Ignorado (opt-out)");
  });

  it("não apresenta números inválidos ou ausentes como métricas reais", () => {
    expect(formatMetric(Number.NaN, "%")).toBe("Indisponível");
    expect(formatMetric(12.34, "%")).toBe("12,3%");
    expect(formatOptionalMetric(null, "%")).toBe("Indisponível");
    expect(formatOptionalMetric(undefined)).toBe("Indisponível");
    expect(formatOptionalMetric(0, "%")).toBe("0%");
  });
});
