import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("../payments.service.js", () => ({
  paymentsService: {
    handleWebhook: vi.fn(),
    createPaymentLink: vi.fn(),
  },
}));

vi.mock("../../../shared/utils/paypalWebhook.js", () => ({
  verifyPayPalWebhookSignature: vi.fn(),
}));

import { paymentsController } from "../payments.controller.js";
import { paymentsService } from "../payments.service.js";
import { verifyPayPalWebhookSignature } from "../../../shared/utils/paypalWebhook.js";

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe("paymentsController.webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a webhook without the raw body used for signature verification", async () => {
    const req = { headers: {}, body: {}, requestId: "r1" } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await paymentsController.webhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(paymentsService.handleWebhook).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid PayPal signature", async () => {
    vi.mocked(verifyPayPalWebhookSignature).mockResolvedValue(false);
    const req = {
      rawBody: Buffer.from("{}"),
      headers: { "paypal-transmission-id": "tx" },
      body: { id: "WH-1" },
      requestId: "r1",
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await paymentsController.webhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(paymentsService.handleWebhook).not.toHaveBeenCalled();
  });

  it("processes a valid webhook", async () => {
    vi.mocked(verifyPayPalWebhookSignature).mockResolvedValue(true);
    vi.mocked(paymentsService.handleWebhook).mockResolvedValue(undefined);
    const body = { id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED" };
    const req = {
      rawBody: Buffer.from(JSON.stringify(body)),
      headers: {
        "paypal-transmission-id": "tx",
        "paypal-transmission-time": "2026-09-04T12:00:00Z",
        "paypal-transmission-sig": "sig",
        "paypal-cert-url": "https://api.sandbox.paypal.com/cert",
        "paypal-auth-algo": "SHA256withRSA",
      },
      body,
      requestId: "r1",
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await paymentsController.webhook(req, res, next);

    expect(paymentsService.handleWebhook).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
