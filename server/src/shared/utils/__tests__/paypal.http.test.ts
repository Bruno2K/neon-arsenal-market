import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("PayPal HTTP policy", () => {
  const originalTimeout = process.env.PAYPAL_API_TIMEOUT_MS;
  const originalId = process.env.PAYPAL_CLIENT_ID;
  const originalSecret = process.env.PAYPAL_SECRET;
  const originalMode = process.env.PAYPAL_MODE;

  beforeEach(() => {
    vi.resetModules();
    process.env.PAYPAL_CLIENT_ID = "client";
    process.env.PAYPAL_SECRET = "secret";
    process.env.PAYPAL_MODE = "sandbox";
    process.env.PAYPAL_API_TIMEOUT_MS = "50";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalTimeout === undefined) delete process.env.PAYPAL_API_TIMEOUT_MS;
    else process.env.PAYPAL_API_TIMEOUT_MS = originalTimeout;
    if (originalId === undefined) delete process.env.PAYPAL_CLIENT_ID;
    else process.env.PAYPAL_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.PAYPAL_SECRET;
    else process.env.PAYPAL_SECRET = originalSecret;
    if (originalMode === undefined) delete process.env.PAYPAL_MODE;
    else process.env.PAYPAL_MODE = originalMode;
  });

  it("does not retry PayPal OrdersGet on HTTP 4xx", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "token", expires_in: 300 }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getPayPalOrder } = await import("../paypal.js");
    await expect(getPayPalOrder("paypal-missing")).rejects.toMatchObject({ statusCode: 502 });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/v2/checkout/orders"))).toHaveLength(1);
  });

  it("retries PayPal OrdersGet on HTTP 5xx then succeeds", async () => {
    let orderCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "token", expires_in: 300 }), { status: 200 });
      }
      orderCalls += 1;
      if (orderCalls < 3) return new Response("upstream", { status: 503 });
      return new Response(JSON.stringify({ id: "paypal-1", status: "COMPLETED" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getPayPalOrder } = await import("../paypal.js");
    await expect(getPayPalOrder("paypal-1")).resolves.toEqual({ id: "paypal-1", status: "COMPLETED" });
    expect(orderCalls).toBe(3);
  });

  it("times out a hung PayPal OrdersGet", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "token", expires_in: 300 }), { status: 200 });
      }
      await new Promise<never>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "TimeoutError";
          reject(err);
        });
      });
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getPayPalOrder } = await import("../paypal.js");
    await expect(getPayPalOrder("paypal-1")).rejects.toBeInstanceOf(Error);
  });
});
