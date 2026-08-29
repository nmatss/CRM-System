import { describe, expect, it } from "vitest";

import { buildWhatsAppUrl } from "./agendaActions";

describe("buildWhatsAppUrl", () => {
  it("normaliza o telefone e codifica a mensagem", () => {
    expect(buildWhatsAppUrl("+55 (11) 99999-1234", "Olá, Ana! Tudo bem?")).toBe(
      "https://wa.me/5511999991234?text=Ol%C3%A1%2C+Ana%21+Tudo+bem%3F",
    );
  });

  it("recusa telefone ausente ou fora do intervalo aceito pelo WhatsApp", () => {
    expect(buildWhatsAppUrl(undefined, "Olá")).toBeNull();
    expect(buildWhatsAppUrl("123", "Olá")).toBeNull();
    expect(buildWhatsAppUrl("1234567890123456", "Olá")).toBeNull();
  });
});
