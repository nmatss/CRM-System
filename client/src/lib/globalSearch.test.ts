import { describe, expect, it } from "vitest";
import {
  describeSearchResult,
  isSearchable,
  searchTypeLabel,
  type SearchResult,
} from "./globalSearch";

function result(partial: Partial<SearchResult>): SearchResult {
  return {
    query: "ana",
    hits: [],
    totals: { customer: 0, product: 0, order: 0 },
    truncated: false,
    ...partial,
  };
}

describe("global search presentation", () => {
  it("only searches once the term is long enough to be meaningful", () => {
    expect(isSearchable("")).toBe(false);
    expect(isSearchable(" a ")).toBe(false);
    expect(isSearchable("an")).toBe(true);
  });

  it("labels each result type in Portuguese", () => {
    expect(searchTypeLabel("customer")).toBe("Cliente");
    expect(searchTypeLabel("order")).toBe("Pedido");
  });

  it("states the result count, including when the list is truncated", () => {
    expect(describeSearchResult(undefined)).toBe("");
    expect(describeSearchResult(result({}))).toBe("Nenhum resultado encontrado.");
    expect(
      describeSearchResult(
        result({ totals: { customer: 1, product: 0, order: 0 }, hits: [{} as never] }),
      ),
    ).toBe("1 resultado.");
    // The user must know the list is not everything that matched.
    expect(
      describeSearchResult(
        result({
          totals: { customer: 40, product: 0, order: 0 },
          hits: Array.from({ length: 5 }, () => ({}) as never),
          truncated: true,
        }),
      ),
    ).toBe("5 de 40 resultados.");
  });
});
