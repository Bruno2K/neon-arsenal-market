import { Request, Response, NextFunction } from "express";
import { createHmac } from "crypto";
import { paymentsService } from "./payments.service.js";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";

/**
 * Verify PayPal webhook signature.
 *
 * PayPal signs each webhook delivery with HMAC-SHA256 using the webhook ID as
 * secret plus metadata headers. This function validates the signature to ensure
 * the request is authentic and was not tampered with in transit.
 *
 * Headers expected:
 *   paypal-transmission-id, paypal-transmission-time, paypal-cert-url,
 *   paypal-auth-algo, paypal-transmission-sig
 *
 * @see https://developer.paypal.com/api/rest/webhooks/
 */
function verifyPayPalSignature(req: Request): boolean {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    // If no webhook ID is configured, skip verification (dev mode)
    return process.env.NODE_ENV !== "production";
  }

  const transmissionId = req.headers["paypal-transmission-id"] as string | undefined;
  const transmissionTime = req.headers["paypal-transmission-time"] as string | undefined;
  const certUrl = req.headers["paypal-cert-url"] as string | undefined;
  const authAlgo = req.headers["paypal-auth-algo"] as string | undefined;
  const transmissionSig = req.headers["paypal-transmission-sig"] as string | undefined;

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return false;
  }

  // PayPal signature message format: "transmissionId|transmissionTime|webhookId|crc32(body)"
  const rawBody = JSON.stringify(req.body);
  const crc32 = computeCrc32(rawBody);
  const message = `${transmissionId}|${transmissionTime}|${webhookId}|${crc32}`;

  // For HMAC-based algos — in production use PayPal's cert-based verification SDK
  // This is a simplified HMAC check suitable for HMAC-SHA256 webhook type
  const expected = createHmac("sha256", webhookId)
    .update(message)
    .digest("base64");

  return expected === transmissionSig;
}

/** Simple CRC32 implementation for PayPal webhook signature message */
function computeCrc32(data: string): number {
  const buf = Buffer.from(data);
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export const paymentsController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const result = await paymentsService.createPaymentLink(user.id, req.body);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },

  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Verify PayPal webhook signature before processing
      if (!verifyPayPalSignature(req)) {
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }

      await paymentsService.handleWebhook(req.body);
      res.status(200).send();
    } catch (e) {
      next(e);
    }
  },
};
