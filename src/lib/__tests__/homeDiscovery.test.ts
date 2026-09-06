import { describe, expect, it } from "vitest";
import type { Product } from "@/types/api";
import { similarItemsMarketPath } from "@/lib/listingCartCta";
import { marketPath } from "@/lib/marketQuery";
import {
  approvedSellersCountLabel,
  catalogDiscoveryLinks,
  HOME_EXTERIOR_LINKS,
  HOME_WEAPON_LINKS,
  listingsCountLabel,
} from "../homeDiscovery";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "ak-redline-ft",
    game: "CS2",
    weapon: "AK-47",
    skinName: "Redline",
    rarity: "Classified",
    exterior: "Field-Tested",
    collection: "The Huntsman Collection",
    imageUrl: null,
    isStattrak: false,
    isSouvenir: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("catalogDiscoveryLinks", () => {
  it("uses real Market productId queries and skips duplicate skins", () => {
    const links = catalogDiscoveryLinks([
      makeProduct(),
      makeProduct({
        id: "ak-redline-mw",
        exterior: "Minimal Wear",
      }),
      makeProduct({
        id: "awp-asiimov-ft",
        weapon: "AWP",
        skinName: "Asiimov",
      }),
    ]);

    expect(links).toEqual([
      {
        productId: "ak-redline-ft",
        label: "AK-47 | Redline",
        href: similarItemsMarketPath("ak-redline-ft"),
      },
      {
        productId: "awp-asiimov-ft",
        label: "AWP | Asiimov",
        href: similarItemsMarketPath("awp-asiimov-ft"),
      },
    ]);
    expect(links.every((link) => !link.href.includes("#"))).toBe(true);
  });
});

describe("HOME_WEAPON_LINKS", () => {
  it("deep-links Market weapon filters", () => {
    expect(HOME_WEAPON_LINKS[0]).toEqual({
      weapon: "AK-47",
      label: "AK-47",
      href: marketPath({ weapon: "AK-47" }),
    });
    expect(HOME_WEAPON_LINKS.map((link) => link.href)).toContain(
      "/products?weapon=AK-47",
    );
  });
});

describe("HOME_EXTERIOR_LINKS", () => {
  it("deep-links Market exteriors", () => {
    expect(HOME_EXTERIOR_LINKS[0]).toEqual({
      exterior: "Factory New",
      label: "Factory New",
      href: marketPath({ exterior: "Factory New" }),
    });
    expect(HOME_EXTERIOR_LINKS.map((link) => link.href)).toContain(
      "/products?exterior=Minimal+Wear",
    );
  });
});

describe("live count labels", () => {
  it("pluralizes listings and approved sellers", () => {
    expect(listingsCountLabel(0)).toBe("0 listings ativos");
    expect(listingsCountLabel(1)).toBe("1 listing ativo");
    expect(approvedSellersCountLabel(1)).toBe("1 vendedor aprovado");
    expect(approvedSellersCountLabel(3)).toBe("3 vendedores aprovados");
  });
});
