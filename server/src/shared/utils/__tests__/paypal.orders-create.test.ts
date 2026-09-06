import { describe, expect, it } from "vitest";
import {
  buildPayPalOrdersCreateBody,
  mapPayPalHttpError,
  PAYPAL_CLIENT_AUTH_FAILED,
  PAYPAL_HTTP_POLICY,
  isPayPalOrderAlreadyCapturedError,
} from "../paypal.js";

describe("PayPal OrdersCreate body", () => {
  it("includes application_context URLs when the client supplies both", () => {
    const returnUrl = "https://app.example/orders/order-1/return";
    const cancelUrl = "https://app.example/orders/order-1/cancel";

    expect(buildPayPalOrdersCreateBody("150.00", "BRL", "order-1", { returnUrl, cancelUrl })).toEqual({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: "order-1",
          amount: { currency_code: "BRL", value: "150.00" },
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    });
  });

  it("omits application_context when no checkout URLs are supplied", () => {
    const body = buildPayPalOrdersCreateBody("10.00", "BRL", "order-2");
    expect(body.application_context).toBeUndefined();
    expect(body).toEqual({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: "order-2",
          amount: { currency_code: "BRL", value: "10.00" },
        },
      ],
    });
  });

  it("does not invent a missing return or cancel URL", () => {
    const returnOnly = buildPayPalOrdersCreateBody("10.00", "BRL", "order-3", {
      returnUrl: "https://app.example/orders/order-3/return",
    });
    expect(returnOnly.application_context).toEqual({
      return_url: "https://app.example/orders/order-3/return",
    });
    expect(returnOnly.application_context).not.toHaveProperty("cancel_url");

    const empty = buildPayPalOrdersCreateBody("10.00", "BRL", "order-4", {});
    expect(empty.application_context).toBeUndefined();
  });

  it("still does not retry OrdersCreate", () => {
    expect(PAYPAL_HTTP_POLICY.orders_create.retry).toBe(false);
  });
});

describe("mapPayPalHttpError", () => {
  it("maps invalid_client 401 to a stable 503 without echoing PayPal JSON", () => {
    const err = Object.assign(
      new Error('{"error":"invalid_client","error_description":"Client Authentication failed"}'),
      { statusCode: 401 }
    );
    const mapped = mapPayPalHttpError(err);
    expect(mapped).toMatchObject({ statusCode: 503, message: PAYPAL_CLIENT_AUTH_FAILED });
    expect(mapped.message).not.toMatch(/invalid_client/);
  });

  it("leaves unrelated errors unchanged", () => {
    const err = new Error("PayPal OrdersCreate timed out");
    expect(mapPayPalHttpError(err)).toBe(err);
  });
});

describe("isPayPalOrderAlreadyCapturedError", () => {
  it("detects PayPal ORDER_ALREADY_CAPTURED without treating it as auth failure", () => {
    const err = new Error('{"name":"UNPROCESSABLE_ENTITY","details":[{"issue":"ORDER_ALREADY_CAPTURED"}]}');
    expect(isPayPalOrderAlreadyCapturedError(err)).toBe(true);
    expect(mapPayPalHttpError(err)).toBe(err);
  });
});
