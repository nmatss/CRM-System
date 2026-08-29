import { describe, expect, it } from "vitest";
import { safeSettingsImageUrl, settingsErrorDescription } from "./settingsErrors";

describe("settingsErrorDescription", () => {
  it("normaliza respostas 403 sem expor o corpo da API", () => {
    expect(
      settingsErrorDescription(
        new Error('403: {"error":"CROSS_TENANT_PASSWORD_RESET_FORBIDDEN"}'),
        "Falha",
      ),
    ).toBe("Você não tem permissão para realizar esta ação.");
  });

  it("preserva mensagens de validação conhecidas do backend", () => {
    expect(
      settingsErrorDescription(
        new Error('400: {"error":"A senha deve ter pelo menos 12 caracteres"}'),
        "Falha",
      ),
    ).toBe("A senha deve ter pelo menos 12 caracteres");
  });

  it("usa fallback para erros internos, inválidos ou desconhecidos", () => {
    expect(settingsErrorDescription(new Error("500: segredo interno"), "Falha segura")).toBe(
      "Falha segura",
    );
    expect(settingsErrorDescription(new Error("erro sem status"), "Falha segura")).toBe(
      "Falha segura",
    );
  });
});

describe("safeSettingsImageUrl", () => {
  it("aceita somente caminhos internos e URLs HTTP(S)", () => {
    expect(safeSettingsImageUrl("/assets/logo.png")).toBe("/assets/logo.png");
    expect(safeSettingsImageUrl("https://cdn.example.com/logo.png")).toBe(
      "https://cdn.example.com/logo.png",
    );
    expect(safeSettingsImageUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeSettingsImageUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeSettingsImageUrl("//evil.example/logo.png")).toBeUndefined();
  });
});
