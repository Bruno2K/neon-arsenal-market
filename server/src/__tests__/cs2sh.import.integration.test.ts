import { afterEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  importCs2ShCatalog,
  resetCs2ShImportStateForTests,
} from "../modules/products/cs2shImport.service.js";
import type { Cs2ShClient } from "../shared/integrations/cs2sh/cs2sh.client.js";
import {
  CS2SH_PRICES_FIXTURE,
  CS2SH_PRICES_UPDATED_FIXTURE,
  CS2SH_SCHEMA_FIXTURE,
} from "../shared/integrations/cs2sh/__tests__/cs2sh.fixtures.js";
import { prisma } from "../shared/database/index.js";

const originalKey = process.env.CS2SH_API_KEY;

function fakeClient(
  prices = CS2SH_PRICES_FIXTURE
): Cs2ShClient {
  return {
    fetchSchema: async () => CS2SH_SCHEMA_FIXTURE,
    fetchLatestPrices: async () => prices,
  };
}

afterEach(() => {
  resetCs2ShImportStateForTests();
  if (originalKey === undefined) delete process.env.CS2SH_API_KEY;
  else process.env.CS2SH_API_KEY = originalKey;
});

describe("cs2.sh catalog import", () => {
  it("skips without an API key and does not call the client", async () => {
    delete process.env.CS2SH_API_KEY;
    let called = false;
    const client: Cs2ShClient = {
      fetchSchema: async () => {
        called = true;
        return CS2SH_SCHEMA_FIXTURE;
      },
      fetchLatestPrices: async () => {
        called = true;
        return CS2SH_PRICES_FIXTURE;
      },
    };
    const summary = await importCs2ShCatalog(client);
    expect(summary.skipped).toBe(true);
    expect(summary.skipReason).toBe("missing_api_key");
    expect(called).toBe(false);
  });

  it("upserts tradable skins idempotently and updates referencePriceUsd", async () => {
    process.env.CS2SH_API_KEY = "test-key";
    const first = await importCs2ShCatalog(fakeClient());
    expect(first.skipped).toBe(false);
    expect(first.productsUpserted).toBe(3);
    expect(first.schemaSkipped).toBe(2);
    expect(first.listingsUpserted).toBe(0);

    const printstream = await prisma.product.findUnique({
      where: { marketHashName: "USP-S | Printstream (Factory New)" },
    });
    expect(printstream?.weapon).toBe("USP-S");
    expect(printstream?.skinName).toBe("Printstream");
    expect(printstream?.referencePriceUsd?.equals(new Prisma.Decimal("144.99"))).toBe(true);
    expect(printstream?.cs2ShGenerationId).toBe("gen-test-1");

    const second = await importCs2ShCatalog(fakeClient(CS2SH_PRICES_UPDATED_FIXTURE));
    expect(second.productsUpserted).toBe(3);
    const products = await prisma.product.count({
      where: { marketHashName: { not: null } },
    });
    expect(products).toBe(3);
    const listings = await prisma.listing.count({
      where: { id: { startsWith: "listing-cs2sh-" } },
    });
    expect(listings).toBe(0);

    const updated = await prisma.product.findUnique({
      where: { marketHashName: "USP-S | Printstream (Factory New)" },
    });
    expect(updated?.referencePriceUsd?.equals(new Prisma.Decimal("150.00"))).toBe(true);
  });

});
