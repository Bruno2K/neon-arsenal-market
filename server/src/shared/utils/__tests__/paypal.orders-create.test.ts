import { describe, expect, it } from "vitest";
import { buildPayPalOrdersCreateBody, PAYPAL_HTTP_POLICY } from "../paypal.js";

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
