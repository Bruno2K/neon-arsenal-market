import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
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
import {
  collectMetrics,
  collectSpans,
  resetTestTelemetry,
  shutdownTelemetry,
  spanOutcomes,
  spansNamed,
  sumMetric,
  useTestTelemetry,
} from "../../../shared/observability/test.js";

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe("paymentsController webhook telemetry", () => {
  beforeAll(async () => {
    await useTestTelemetry();
  });

  afterAll(async () => {
    await shutdownTelemetry();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTestTelemetry();
  });

  it("records signature rejection without storing the webhook signature", async () => {
    vi.mocked(verifyPayPalWebhookSignature).mockResolvedValue(false);
    const req = {
      rawBody: Buffer.from("{}"),
      headers: { "paypal-transmission-sig": "super-secret-signature" },
      body: { id: "WH-1" },
      requestId: "r-webhook",
    } as unknown as Request;
    const res = mockRes();

    await paymentsController.webhook(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(paymentsService.handleWebhook).not.toHaveBeenCalled();

    const spans = await collectSpans();
    const verify = spansNamed(spans, "paypal.webhook.verify")[0];
    expect(spanOutcomes(spans, "paypal.webhook.verify")).toEqual(["webhook_failed"]);
    expect(verify?.attributes["paypal-transmission-sig"]).toBeUndefined();
    expect(JSON.stringify(verify?.attributes ?? {})).not.toContain("super-secret-signature");

    const metrics = await collectMetrics();
    expect(sumMetric(metrics, "paypal.webhooks.received")).toBe(1);
    expect(sumMetric(metrics, "paypal.webhooks.failed")).toBe(1);
  });
});
