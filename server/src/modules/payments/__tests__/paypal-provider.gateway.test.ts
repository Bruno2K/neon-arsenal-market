import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../shared/errors/AppError.js";

vi.mock("../../../shared/utils/paypal.js", () => ({
  createPayPalOrder: vi.fn(),
  capturePayPalOrder: vi.fn(),
  getPayPalApprovalLink: vi.fn(),
  getPayPalOrder: vi.fn(),
  isPayPalOrderAlreadyCapturedError: vi.fn(),
  refundPayPalCapture: vi.fn(),
}));

vi.mock("../paypal-refunds.client.js", () => ({
  getPayPalRefund: vi.fn(),
}));

import {
  capturePayPalOrder,
  createPayPalOrder,
  getPayPalApprovalLink,
  getPayPalOrder,
  isPayPalOrderAlreadyCapturedError,
  refundPayPalCapture,
} from "../../../shared/utils/paypal.js";
import { getPayPalRefund } from "../paypal-refunds.client.js";
import { paypalProvider } from "../paypal-provider.gateway.js";

describe("paypalProvider gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes order creation to the application-facing shape", async () => {
    vi.mocked(createPayPalOrder).mockResolvedValue({
      id: "PAYPAL-1",
      status: "CREATED",
      links: [{ rel: "approve", href: "https://paypal.example/approve" }],
    });
    vi.mocked(getPayPalApprovalLink).mockReturnValue("https://paypal.example/approve");

    await expect(
      paypalProvider.createOrder({
        amount: "150.00",
        currency: "BRL",
        orderId: "order-1",
      })
    ).resolves.toEqual({
      id: "PAYPAL-1",
      status: "CREATED",
      captureId: undefined,
      approvalUrl: "https://paypal.example/approve",
    });
    expect(createPayPalOrder).toHaveBeenCalledWith("150.00", "BRL", "order-1", undefined);
  });

  it("recovers an already-captured response through the trusted GET", async () => {
    const alreadyCaptured = new Error("ORDER_ALREADY_CAPTURED");
    vi.mocked(capturePayPalOrder).mockRejectedValue(alreadyCaptured);
    vi.mocked(isPayPalOrderAlreadyCapturedError).mockReturnValue(true);
    vi.mocked(getPayPalOrder).mockResolvedValue({ id: "PAYPAL-1", status: "COMPLETED" });

    await expect(paypalProvider.captureOrder("PAYPAL-1")).resolves.toMatchObject({
      status: "COMPLETED",
    });
    expect(isPayPalOrderAlreadyCapturedError).toHaveBeenCalledWith(alreadyCaptured);
    expect(getPayPalOrder).toHaveBeenCalledWith("PAYPAL-1");
  });

  it("does not hide unrelated capture failures", async () => {
    const failure = new Error("provider unavailable");
    vi.mocked(capturePayPalOrder).mockRejectedValue(failure);
    vi.mocked(isPayPalOrderAlreadyCapturedError).mockReturnValue(false);

    await expect(paypalProvider.captureOrder("PAYPAL-1")).rejects.toBe(failure);
    expect(getPayPalOrder).not.toHaveBeenCalled();
  });

  it("exposes refund POST and GET through one provider fake point", async () => {
    vi.mocked(refundPayPalCapture).mockResolvedValue({ id: "REFUND-1", status: "PENDING" });
    vi.mocked(getPayPalRefund).mockResolvedValue({ id: "REFUND-1", status: "COMPLETED" });

    await expect(paypalProvider.refundCapture("CAPTURE-1", "request-1")).resolves.toMatchObject({
      status: "PENDING",
    });
    await expect(paypalProvider.getRefund("REFUND-1")).resolves.toMatchObject({
      status: "COMPLETED",
    });
  });

  it.each([
    [new AppError(504, "PayPal timed out"), "paypal_timeout"],
    [new Error("PREVIOUS_REQUEST_IN_PROGRESS"), "paypal_request_in_progress"],
    [new Error("PayPal failed: 429"), "paypal_throttled"],
    [new Error("PayPal failed: 503"), "paypal_provider_unavailable"],
    [new Error("unexpected"), "reconciliation_technical_failure"],
  ])("normalizes refund failure %s as %s", (error, expected) => {
    expect(paypalProvider.classifyRefundFailure(error)).toBe(expected);
  });
});
