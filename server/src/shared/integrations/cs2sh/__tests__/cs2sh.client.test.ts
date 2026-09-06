import { afterEach, describe, expect, it, vi } from "vitest";
import { createCs2ShClient } from "../cs2sh.client.js";

const originalKey = process.env.CS2SH_API_KEY;
const originalTimeout = process.env.CS2SH_API_TIMEOUT_MS;
const originalBase = process.env.CS2SH_API_BASE_URL;

afterEach(() => {
  if (originalKey === undefined) delete process.env.CS2SH_API_KEY;
  else process.env.CS2SH_API_KEY = originalKey;
  if (originalTimeout === undefined) delete process.env.CS2SH_API_TIMEOUT_MS;
  else process.env.CS2SH_API_TIMEOUT_MS = originalTimeout;
  if (originalBase === undefined) delete process.env.CS2SH_API_BASE_URL;
  else process.env.CS2SH_API_BASE_URL = originalBase;
  vi.useRealTimers();
});

describe("cs2.sh HTTP client", () => {
  it("sends Bearer auth and Accept-Encoding: gzip on schema GET", async () => {
    process.env.CS2SH_API_KEY = "test-secret";
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ generation_id: "g1", items: {} }),
    });
    const client = createCs2ShClient({ fetch: fetchFn });
    await client.fetchSchema();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.cs2.sh/v1/schema");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-secret");
    expect(headers["Accept-Encoding"]).toBe("gzip");
    expect(init.method).toBe("GET");
  });

  it("retries HTTP 503 then succeeds", async () => {
    process.env.CS2SH_API_KEY = "test-secret";
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currency: "USD", items: {} }),
      });
    const client = createCs2ShClient({ fetch: fetchFn, sleep: async () => undefined });
    await expect(client.fetchLatestPrices()).resolves.toEqual({ currency: "USD", items: {} });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does not retry HTTP 400", async () => {
    process.env.CS2SH_API_KEY = "test-secret";
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    const client = createCs2ShClient({ fetch: fetchFn });
    await expect(client.fetchSchema()).rejects.toMatchObject({ statusCode: 502 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("maps timeouts to 504", async () => {
    process.env.CS2SH_API_KEY = "test-secret";
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    const fetchFn = vi.fn().mockRejectedValue(timeout);
    const client = createCs2ShClient({ fetch: fetchFn, sleep: async () => undefined });
    await expect(client.fetchSchema()).rejects.toMatchObject({
      statusCode: 504,
      message: "cs2.sh schema timed out",
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
