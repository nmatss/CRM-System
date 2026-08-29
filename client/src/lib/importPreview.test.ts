import { describe, expect, it } from "vitest";
import {
  describeImportPlan,
  describeImportResult,
  isNoOpImport,
  type ImportOutcome,
} from "./importPreview";

function outcome(totals: Partial<ImportOutcome["totals"]>): ImportOutcome {
  return {
    mode: "dry-run",
    atomic: false,
    onDuplicate: "skip",
    totals: {
      received: 0,
      valid: 0,
      invalid: 0,
      duplicates: 0,
      withoutKey: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      ...totals,
    },
    issues: [],
    totalIssues: 0,
    duplicates: [],
    totalDuplicates: 0,
  };
}

describe("import preview", () => {
  it("states what a commit would do", () => {
    expect(describeImportPlan(outcome({ created: 3 }), "clientes")).toBe("3 clientes a criar.");
    expect(describeImportPlan(outcome({ created: 2, skipped: 1, invalid: 1 }), "clientes")).toBe(
      "2 clientes a criar · 1 a ignorar por duplicidade · 1 com erro.",
    );
  });

  it("says plainly when there is nothing to import", () => {
    expect(describeImportPlan(outcome({}), "produtos")).toBe("Nada a importar.");
    // A file whose rows are all duplicates changes nothing.
    expect(isNoOpImport(outcome({ skipped: 5 }))).toBe(true);
    expect(isNoOpImport(outcome({ created: 1 }))).toBe(false);
    expect(isNoOpImport(outcome({ updated: 1 }))).toBe(false);
  });

  it("reports the committed result without inflating it", () => {
    expect(describeImportResult(outcome({ created: 1, skipped: 2 }), "clientes")).toBe(
      "1 clientes criado(s) · 2 ignorado(s).",
    );
  });
});
