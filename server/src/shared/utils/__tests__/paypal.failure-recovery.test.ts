import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../errors/AppError.js";
import { PAYPAL_IDEMPOTENT_RETRY } from "../../config/paypal.js";
import {
  PAYPAL_HTTP_POLICY,
  getPayPalAccessToken,
  getPayPalOrder,
  resetPayPalTokenCacheForTests,
} from "../paypal.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tokenResponse(): Response {
  return jsonResponse(200, { access_token: "token-test", expires_in: 300 });
}

function orderResponse(status = "COMPLETED"): Response {
  return jsonResponse(200, { id: "PAYPAL-ORDER-1", status });
}

describe("PayPal external failure recovery", () => {
  beforeEach(() => {
    resetPayPalTokenCacheForTests();
    process.env.PAYPAL_CLIENT_ID = "test-client";
    process.env.PAYPAL_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetPayPalTokenCacheForTests();
  });

  it("does not retry OrdersCreate or OrdersCapture (fail-fast, no circuit breaker)", () => {
    expect(PAYPAL_HTTP_POLICY.orders_create).toEqual({
      retry: false,
      reason: "OrdersCreate can open a second PayPal order",
    });
    expect(PAYPAL_HTTP_POLICY.orders_capture).toEqual({
      retry: false,
      reason: "OrdersCapture can capture funds more than once",
    });
    expect(PAYPAL_HTTP_POLICY.orders_get.retry).toBe(true);
    expect(PAYPAL_HTTP_POLICY.oauth_token.retry).toBe(true);
    expect(PAYPAL_HTTP_POLICY.cert_download.retry).toBe(true);
    expect(PAYPAL_HTTP_POLICY.orders_get.maxAttempts).toBe(PAYPAL_IDEMPOTENT_RETRY.maxAttempts);
    expect(PAYPAL_HTTP_POLICY.orders_get.baseDelayMs).toBe(PAYPAL_IDEMPOTENT_RETRY.baseDelayMs);
  });

  it("retries OAuth token HTTP 5xx then recovers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream", { status: 503 }))
      .mockResolvedValueOnce(tokenResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPayPalAccessToken()).resolves.toBe("token-test");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries OrdersGet HTTP 429 then recovers the COMPLETED status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(orderResponse("COMPLETED"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPayPalOrder("PAYPAL-ORDER-1")).resolves.toMatchObject({
      id: "PAYPAL-ORDER-1",
      status: "COMPLETED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries OrdersGet HTTP 5xx then recovers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(orderResponse("APPROVED"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPayPalOrder("PAYPAL-ORDER-1")).resolves.toMatchObject({
      status: "APPROVED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("fails fast on OrdersGet HTTP 4xx (no retry storm)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPayPalOrder("PAYPAL-ORDER-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "PayPal OrdersGet failed: 404",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps an OrdersGet timeout to HTTP 504 after retries exhaust", async () => {
    const timeout = new Error("The operation was aborted");
    timeout.name = "TimeoutError";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockRejectedValue(timeout);
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPayPalOrder("PAYPAL-ORDER-1")).rejects.toMatchObject({
      statusCode: 504,
      message: "PayPal OrdersGet timed out",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1 + PAYPAL_IDEMPOTENT_RETRY.maxAttempts);
  });

  it("recovers on a later call after a previous timeout exhausted retries", async () => {
    const timeout = new Error("The operation was aborted");
    timeout.name = "AbortError";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(orderResponse("COMPLETED"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPayPalOrder("PAYPAL-ORDER-1")).rejects.toBeInstanceOf(AppError);
    await expect(getPayPalOrder("PAYPAL-ORDER-1")).resolves.toMatchObject({
      status: "COMPLETED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
