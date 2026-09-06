import { afterEach, describe, expect, it } from "vitest";
import {
  getCs2ShImportStatus,
  importCs2ShCatalog,
  resetCs2ShImportStateForTests,
  scheduleCs2ShBootImport,
  tryStartCs2ShCatalogImport,
} from "../cs2shImport.service.js";
import type { Cs2ShClient } from "../../../shared/integrations/cs2sh/cs2sh.client.js";
import { CS2SH_PRICES_FIXTURE, CS2SH_SCHEMA_FIXTURE } from "../../../shared/integrations/cs2sh/__tests__/cs2sh.fixtures.js";

const originalKey = process.env.CS2SH_API_KEY;
const originalImport = process.env.CS2SH_IMPORT;

function hangingClient(): { client: Cs2ShClient; fail: (err: unknown) => void } {
  let fail = (_err: unknown) => {};
  const gate = new Promise<typeof CS2SH_SCHEMA_FIXTURE>((_resolve, reject) => {
    fail = reject;
  });
  void gate.catch(() => undefined);
  return {
    client: {
      fetchSchema: () => gate,
      fetchLatestPrices: async () => CS2SH_PRICES_FIXTURE,
    },
    fail,
  };
}

const hangingRuns: Array<(err: unknown) => void> = [];

afterEach(() => {
  for (const fail of hangingRuns.splice(0)) {
    fail(new Error("test cleanup"));
  }
  if (originalKey === undefined) delete process.env.CS2SH_API_KEY;
  else process.env.CS2SH_API_KEY = originalKey;
  if (originalImport === undefined) delete process.env.CS2SH_IMPORT;
  else process.env.CS2SH_IMPORT = originalImport;
  resetCs2ShImportStateForTests();
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

  it("rejects a concurrent import with 409 and tryStart returns false", async () => {
    process.env.CS2SH_API_KEY = "test-key";
    const { client, fail } = hangingClient();
    hangingRuns.push(fail);
    const first = importCs2ShCatalog(client);
    expect(getCs2ShImportStatus().running).toBe(true);
    expect(tryStartCs2ShCatalogImport(client)).toBe(false);
    await expect(importCs2ShCatalog(client)).rejects.toMatchObject({
      statusCode: 409,
      message: "A importação do catálogo cs2.sh já está em andamento",
    });
    fail(new Error("stop hung import"));
    hangingRuns.length = 0;
    await expect(first).rejects.toBeInstanceOf(Error);
    expect(getCs2ShImportStatus().running).toBe(false);
  });
});

describe("scheduleCs2ShBootImport", () => {
  it("does nothing when CS2SH_IMPORT is unset", () => {
    delete process.env.CS2SH_IMPORT;
    process.env.CS2SH_API_KEY = "test-key";
    const { client, fail } = hangingClient();
    hangingRuns.push(fail);
    scheduleCs2ShBootImport(client);
    expect(getCs2ShImportStatus().running).toBe(false);
  });

  it("does not start when CS2SH_IMPORT=true but the API key is missing", () => {
    process.env.CS2SH_IMPORT = "true";
    delete process.env.CS2SH_API_KEY;
    const { client, fail } = hangingClient();
    hangingRuns.push(fail);
    scheduleCs2ShBootImport(client);
    expect(getCs2ShImportStatus().running).toBe(false);
  });

  it("starts after listen when CS2SH_IMPORT=true and the key is set", () => {
    process.env.CS2SH_IMPORT = "true";
    process.env.CS2SH_API_KEY = "test-key";
    const { client, fail } = hangingClient();
    hangingRuns.push(fail);
    scheduleCs2ShBootImport(client);
    expect(getCs2ShImportStatus().running).toBe(true);
  });
});
