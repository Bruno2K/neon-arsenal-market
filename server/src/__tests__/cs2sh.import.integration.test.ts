import { afterEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { importCs2ShCatalog } from "../modules/products/cs2shImport.service.js";
import type { Cs2ShClient } from "../shared/integrations/cs2sh/cs2sh.client.js";
import {
  CS2SH_PRICES_FIXTURE,
  CS2SH_PRICES_UPDATED_FIXTURE,
  CS2SH_SCHEMA_FIXTURE,
} from "../shared/integrations/cs2sh/__tests__/cs2sh.fixtures.js";
import { demoListingId } from "../shared/integrations/cs2sh/cs2sh.mapper.js";
import { prisma } from "../shared/database/index.js";
import { createSeller } from "./helpers/index.js";

const originalKey = process.env.CS2SH_API_KEY;
const originalCount = process.env.CS2SH_DEMO_LISTING_COUNT;

function fakeClient(
  prices = CS2SH_PRICES_FIXTURE
): Cs2ShClient {
  return {
    fetchSchema: async () => CS2SH_SCHEMA_FIXTURE,
    fetchLatestPrices: async () => prices,
  };
}

afterEach(() => {
  if (originalKey === undefined) delete process.env.CS2SH_API_KEY;
  else process.env.CS2SH_API_KEY = originalKey;
  if (originalCount === undefined) delete process.env.CS2SH_DEMO_LISTING_COUNT;
  else process.env.CS2SH_DEMO_LISTING_COUNT = originalCount;
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
    process.env.CS2SH_DEMO_LISTING_COUNT = "2";
    await createSeller();

    const first = await importCs2ShCatalog(fakeClient());
    expect(first.skipped).toBe(false);
    expect(first.productsUpserted).toBe(3);
    expect(first.schemaSkipped).toBe(2);
    expect(first.listingsUpserted).toBe(2);

    const printstream = await prisma.product.findUnique({
      where: { marketHashName: "USP-S | Printstream (Factory New)" },
    });
    expect(printstream?.weapon).toBe("USP-S");
    expect(printstream?.skinName).toBe("Printstream");
    expect(printstream?.referencePriceUsd?.equals(new Prisma.Decimal("144.99"))).toBe(true);
    expect(printstream?.cs2ShGenerationId).toBe("gen-test-1");

    const listingId = demoListingId("StatTrak™ AK-47 | Redline (Field-Tested)");
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(listing?.currency).toBe("USD");
    expect(listing?.status).toBe("ACTIVE");
    expect(listing?.price.equals(new Prisma.Decimal("65.50"))).toBe(true);

    const second = await importCs2ShCatalog(fakeClient(CS2SH_PRICES_UPDATED_FIXTURE));
    expect(second.productsUpserted).toBe(3);
    const products = await prisma.product.count({
      where: { marketHashName: { not: null } },
    });
    expect(products).toBe(3);
    const listings = await prisma.listing.count({
      where: { id: { startsWith: "listing-cs2sh-" } },
    });
    expect(listings).toBe(2);

    const updated = await prisma.product.findUnique({
      where: { marketHashName: "USP-S | Printstream (Factory New)" },
    });
    expect(updated?.referencePriceUsd?.equals(new Prisma.Decimal("150.00"))).toBe(true);
  });

  it("does not revive a SOLD demo listing on re-import", async () => {
    process.env.CS2SH_API_KEY = "test-key";
    process.env.CS2SH_DEMO_LISTING_COUNT = "1";
    await createSeller();
    await importCs2ShCatalog(fakeClient());

    const soldId = demoListingId("StatTrak™ AK-47 | Redline (Field-Tested)");
    await prisma.listing.update({
      where: { id: soldId },
      data: { status: "SOLD", soldAt: new Date() },
    });

    await importCs2ShCatalog(fakeClient());
    const listing = await prisma.listing.findUnique({ where: { id: soldId } });
    expect(listing?.status).toBe("SOLD");
  });
});
