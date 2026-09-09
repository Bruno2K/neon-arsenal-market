import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../shared/errors/AppError.js";
import {
  parsePayPalRefundResource,
  parsePayPalOrderResource,
  refundPayPalCapture,
  resetPayPalTokenCacheForTests,
} from "../shared/utils/paypal.js";
import { getPayPalRefund } from "../modules/payments/paypal-refunds.client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PayPal full capture refunds", () => {
  beforeEach(() => {
    resetPayPalTokenCacheForTests();
    process.env.PAYPAL_CLIENT_ID = "test-client";
    process.env.PAYPAL_SECRET = "test-secret";
    process.env.PAYPAL_MODE = "sandbox";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetPayPalTokenCacheForTests();
  });

  it("strictly parses only a refund id and recognized status", () => {
    expect(parsePayPalRefundResource({ id: "REFUND-1", status: "COMPLETED" })).toEqual({
      id: "REFUND-1",
      status: "COMPLETED",
    });
    expect(() => parsePayPalRefundResource({ id: "REFUND-1", status: "PAID" })).toThrow(
      AppError
    );
    expect(() => parsePayPalRefundResource({ status: "COMPLETED" })).toThrow(AppError);
    expect(() => parsePayPalRefundResource("COMPLETED")).toThrow(AppError);
  });

  it("extracts a completed or already-refunded capture identity from a trusted order response", () => {
    expect(
      parsePayPalOrderResource({
        id: "ORDER-1",
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                { id: "CAPTURE-PENDING", status: "PENDING" },
                { id: "CAPTURE-COMPLETED", status: "COMPLETED" },
              ],
            },
          },
        ],
      }).captureId
    ).toBe("CAPTURE-COMPLETED");
    expect(
      parsePayPalOrderResource({
        id: "ORDER-1",
        status: "COMPLETED",
        purchase_units: [
          { payments: { captures: [{ id: "CAPTURE-REFUNDED", status: "REFUNDED" }] } },
        ],
      }).captureId
    ).toBe("CAPTURE-REFUNDED");
    expect(
      parsePayPalOrderResource({
        id: "ORDER-1",
        status: "COMPLETED",
        purchase_units: [{ payments: { captures: [{ id: 123, status: "COMPLETED" }] } }],
      }).captureId
    ).toBeUndefined();
  });

  it("posts a full refund against the capture with the supplied stable request id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "token", expires_in: 300 }))
      .mockResolvedValueOnce(jsonResponse(201, { id: "REFUND-1", status: "COMPLETED" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(refundPayPalCapture("CAPTURE/1", "stable-request-id")).resolves.toEqual({
      id: "REFUND-1",
      status: "COMPLETED",
    });

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(
      "https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE%2F1/refund"
    );
    expect(init).toMatchObject({ method: "POST", body: "{}" });
    expect(init.headers).toMatchObject({
      Authorization: "Bearer token",
      "Content-Type": "application/json",
      "PayPal-Request-Id": "stable-request-id",
      Prefer: "return=representation",
    });
  });

  it("keeps a timeout ambiguous and does not retry inside the adapter", async () => {
    const timeout = new Error("The operation was aborted");
    timeout.name = "TimeoutError";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "token", expires_in: 300 }))
      .mockRejectedValueOnce(timeout);
    vi.stubGlobal("fetch", fetchMock);

    await expect(refundPayPalCapture("CAPTURE-1", "stable-request-id")).rejects.toMatchObject({
      statusCode: 504,
      message: "PayPal CapturesRefund timed out",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads current refund state by encoded provider refund id without an immediate retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "token", expires_in: 300 }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "REFUND/1", status: "PENDING" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPayPalRefund("REFUND/1")).resolves.toEqual({
      id: "REFUND/1",
      status: "PENDING",
    });

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/payments/refunds/REFUND%2F1");
    expect(init.method).toBeUndefined();
    expect(init.headers).toMatchObject({ Authorization: "Bearer token" });
  });

  it("keeps RefundsGet timeout and 5xx outcomes retryable for the persisted sweep", async () => {
    const timeout = new Error("The operation was aborted");
    timeout.name = "TimeoutError";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "token", expires_in: 300 }))
      .mockRejectedValueOnce(timeout);
    vi.stubGlobal("fetch", fetchMock);
    await expect(getPayPalRefund("REFUND-TIMEOUT")).rejects.toMatchObject({ statusCode: 504 });

    resetPayPalTokenCacheForTests();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "token-2", expires_in: 300 }))
      .mockResolvedValueOnce(jsonResponse(503, { name: "INTERNAL_SERVER_ERROR" }));
    await expect(getPayPalRefund("REFUND-503")).rejects.toMatchObject({
      statusCode: 502,
      message: "PayPal RefundsGet failed: 503",
    });
  });
});
