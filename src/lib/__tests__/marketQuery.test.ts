import { describe, expect, it } from "vitest";
import {
  hasMarketFilters,
  isValidNumericRange,
  MARKET_TAXONOMY_EMPTY_HINT,
  marketFiltersEmptyDescription,
  marketPath,
  marketSearchEmptyTitle,
  parseMarketQuery,
  patchMarketQuery,
  serializeMarketQuery,
} from "../marketQuery";

describe("parseMarketQuery", () => {
  it("reads q, filters, sort, and page from the URL", () => {
    const query = parseMarketQuery(
      new URLSearchParams(
        "q=talon&exterior=Minimal+Wear&stattrak=true&minPrice=10&maxPrice=40&minFloat=0.1&maxFloat=0.3&sort=price-asc&page=2",
      ),
    );
    expect(query).toEqual({
      q: "talon",
      productId: undefined,
      exterior: "Minimal Wear",
      isStattrak: true,
      minPrice: "10",
      maxPrice: "40",
      minFloat: "0.1",
      maxFloat: "0.3",
      weapon: "",
      rarity: "",
      sort: "price_asc",
      page: 2,
    });
  });

  it("accepts search as an alias for q", () => {
    expect(parseMarketQuery(new URLSearchParams("search=Printstream")).q).toBe(
      "Printstream",
    );
    expect(
      parseMarketQuery(new URLSearchParams("q=talon&search=ignored")).q,
    ).toBe("talon");
  });

  it("falls back to defaults for invalid params", () => {
    const query = parseMarketQuery(
      new URLSearchParams(
        "page=-2&sort=newest&exterior=Glossy&stattrak=maybe&minPrice=nope&maxFloat=2&minFloat=-1",
      ),
    );
    expect(query).toEqual({
      q: "",
      productId: undefined,
      exterior: "",
      isStattrak: undefined,
      minPrice: "",
      maxPrice: "",
      minFloat: "",
      maxFloat: "",
      weapon: "",
      rarity: "",
      sort: "",
      page: 1,
    });
  });
});

describe("serializeMarketQuery", () => {
  it("omits defaults so /products stays clean", () => {
    expect(
      serializeMarketQuery({
        q: "",
        exterior: "",
        isStattrak: undefined,
        minPrice: "",
        maxPrice: "",
        minFloat: "",
        maxFloat: "",
        weapon: "",
        rarity: "",
        sort: "",
        page: 1,
      }).toString(),
    ).toBe("");
  });

  it("writes q (not search) and omits page=1", () => {
    const qs = serializeMarketQuery({
      q: "AK",
      exterior: "Factory New",
      isStattrak: false,
      minPrice: "",
      maxPrice: "",
      minFloat: "",
      maxFloat: "",
      weapon: "",
      rarity: "",
      sort: "",
      page: 1,
    }).toString();
    expect(qs).toBe("q=AK&exterior=Factory+New&stattrak=false");
  });
});

describe("marketPath", () => {
  it("builds shareable Market URLs for Home chips", () => {
    expect(marketPath({ exterior: "Factory New" })).toBe(
      "/products?exterior=Factory+New",
    );
    expect(marketPath({ q: "huntsman" })).toBe("/products?q=huntsman");
    expect(marketPath()).toBe("/products");
  });
});

describe("patchMarketQuery", () => {
  it("resets page when a filter changes", () => {
    const next = patchMarketQuery(
      new URLSearchParams("exterior=Field-Tested&page=3"),
      { exterior: "Well-Worn", page: 1 },
    );
    expect(next.toString()).toBe("exterior=Well-Worn");
  });
});

describe("hasMarketFilters", () => {
  it("is false for the default catalog", () => {
    expect(hasMarketFilters(parseMarketQuery(new URLSearchParams()))).toBe(
      false,
    );
    expect(
      hasMarketFilters(parseMarketQuery(new URLSearchParams("q=talon"))),
    ).toBe(true);
  });
});

describe("marketSearchEmptyTitle", () => {
  it("includes the typed term", () => {
    expect(marketSearchEmptyTitle("talon")).toBe("Nenhum listing para ‘talon’");
  });
});

describe("weapon and rarity", () => {
  it("round-trips weapon and rarity in the Market URL", () => {
    const query = parseMarketQuery(
      new URLSearchParams("weapon=AK-47&rarity=Covert"),
    );
    expect(query.weapon).toBe("AK-47");
    expect(query.rarity).toBe("Covert");
    expect(serializeMarketQuery(query).toString()).toBe(
      "weapon=AK-47&rarity=Covert",
    );
  });

  it("suggests clearing weapon or rarity in the empty-filter copy", () => {
    const query = parseMarketQuery(new URLSearchParams("weapon=AK-47"));
    expect(marketFiltersEmptyDescription(query)).toContain("arma AK-47");
    expect(marketFiltersEmptyDescription(query)).toContain(
      MARKET_TAXONOMY_EMPTY_HINT,
    );
  });
});

describe("isValidNumericRange", () => {
  it("rejects min greater than max", () => {
    expect(isValidNumericRange("0.4", "0.1")).toBe(false);
    expect(isValidNumericRange("0.1", "0.4")).toBe(true);
  });
});
