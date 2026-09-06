import { afterEach, describe, expect, it } from "vitest";
import { importCs2ShCatalog } from "../cs2shImport.service.js";
import type { Cs2ShClient } from "../../../shared/integrations/cs2sh/cs2sh.client.js";
import { CS2SH_PRICES_FIXTURE, CS2SH_SCHEMA_FIXTURE } from "../../../shared/integrations/cs2sh/__tests__/cs2sh.fixtures.js";

const originalKey = process.env.CS2SH_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.CS2SH_API_KEY;
  else process.env.CS2SH_API_KEY = originalKey;
});

describe("importCs2ShCatalog", () => {
  it("no-ops without CS2SH_API_KEY and does not call the provider", async () => {
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
    expect(summary).toMatchObject({ skipped: true, skipReason: "missing_api_key", productsUpserted: 0 });
    expect(called).toBe(false);
  });
});
