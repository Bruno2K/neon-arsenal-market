import { describe, expect, it } from "vitest";
import {
  attachReferencePrices,
  formatAskUsd,
  isImportableSkin,
  mapSchemaCatalog,
  mapSchemaItem,
  selectReferenceAsk,
} from "../cs2sh.mapper.js";
import { CS2SH_PRICES_FIXTURE, CS2SH_SCHEMA_FIXTURE } from "./cs2sh.fixtures.js";

describe("cs2.sh catalog mapper", () => {
  it("imports tradable skins with weapon, finish, and wear", () => {
    const { products, skipped, generationId } = mapSchemaCatalog(CS2SH_SCHEMA_FIXTURE);
    expect(generationId).toBe("gen-test-1");
    expect(products).toHaveLength(3);
    expect(skipped).toBe(2);
    expect(products.map((row) => row.marketHashName)).toEqual([
      "USP-S | Printstream (Factory New)",
      "StatTrak™ AK-47 | Redline (Field-Tested)",
      "M4A4 | Howl (Factory New)",
    ]);
  });

  it("skips containers and skins without wear", () => {
    expect(isImportableSkin(CS2SH_SCHEMA_FIXTURE.items?.["Recoil Case"])).toBe(false);
    expect(isImportableSkin(CS2SH_SCHEMA_FIXTURE.items?.["AK-47 | Unwearable"])).toBe(false);
  });

  it("maps StatTrak and Contraband fields from the schema row", () => {
    const mapped = mapSchemaItem(
      CS2SH_SCHEMA_FIXTURE.items!["StatTrak™ AK-47 | Redline (Field-Tested)"]!,
      "gen-test-1"
    );
    expect(mapped).toMatchObject({
      game: "CS2",
      weapon: "AK-47",
      skinName: "Redline",
      rarity: "Classified",
      exterior: "Field-Tested",
      isStattrak: true,
      isSouvenir: false,
      imageUrl: "https://cs2.sh/image/redline-st-ft",
      collection: "The Huntsman Collection",
    });
    expect(mapSchemaItem(CS2SH_SCHEMA_FIXTURE.items!["M4A4 | Howl (Factory New)"]!, null)?.rarity).toBe(
      "Contraband"
    );
  });

  it("selects steam ask first, then csfloat, then skinport, without averaging", () => {
    expect(selectReferenceAsk(CS2SH_PRICES_FIXTURE.items!["USP-S | Printstream (Factory New)"])).toEqual({
      usd: "144.99",
      steamAskVolume: 75,
    });
    expect(selectReferenceAsk(CS2SH_PRICES_FIXTURE.items!["M4A4 | Howl (Factory New)"])).toEqual({
      usd: "3800.00",
      steamAskVolume: 0,
    });
  });

  it("formats JSON number asks to two decimal strings without extra math", () => {
    expect(formatAskUsd(101.95)).toBe("101.95");
    expect(formatAskUsd("101.95")).toBe("101.95");
    expect(formatAskUsd("65.5")).toBe("65.50");
    expect(formatAskUsd(null)).toBeNull();
  });

  it("attaches reference prices by market_hash_name", () => {
    const { products } = mapSchemaCatalog(CS2SH_SCHEMA_FIXTURE);
    const prices = attachReferencePrices(products, CS2SH_PRICES_FIXTURE);
    expect(prices.get("USP-S | Printstream (Factory New)")).toBe("144.99");
    expect(prices.get("M4A4 | Howl (Factory New)")).toBe("3800.00");
  });

});
