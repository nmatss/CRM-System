import { describe, expect, it } from "vitest";
import { serializeCsv } from "./csvExport";

describe("serializeCsv", () => {
  it("escapa vírgulas, aspas e valores ausentes", () => {
    expect(
      serializeCsv(
        [{ name: 'Loja "Centro", SP', stock: 0 }],
        [
          { key: "name", label: "Nome" },
          { key: "stock", label: "Estoque" },
          { key: "missing", label: "Ausente" },
        ],
      ),
    ).toBe('"Nome","Estoque","Ausente"\n"Loja ""Centro"", SP","0",""');
  });

  it.each(["=1+1", "+cmd", "-10+20", "@SUM(A1:A2)", "  =1+1", "\t@formula"])(
    "neutraliza fórmula CSV iniciada por %j",
    (dangerousValue) => {
      expect(serializeCsv([{ value: dangerousValue }], [{ key: "value", label: "Valor" }])).toBe(
        `"Valor"\n"'${dangerousValue}"`,
      );
    },
  );

  it("não altera sinais que não são o primeiro caractere significativo", () => {
    expect(
      serializeCsv([{ value: "Pedido - confirmado" }], [{ key: "value", label: "Valor" }]),
    ).toBe('"Valor"\n"Pedido - confirmado"');
  });
});
