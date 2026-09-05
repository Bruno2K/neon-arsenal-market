import { createSign, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  computePaypalCrc32,
  parsePayPalWebhookEvent,
  verifyPayPalWebhookSignature,
} from "../paypalWebhook.js";

function signWebhook(params: {
  rawBody: Buffer;
  webhookId: string;
  transmissionId: string;
  transmissionTime: string;
  privateKeyPem: string;
}): string {
  const crc = computePaypalCrc32(params.rawBody);
  const message = `${params.transmissionId}|${params.transmissionTime}|${params.webhookId}|${crc}`;
  return createSign("SHA256").update(message).sign(params.privateKeyPem, "base64");
}

describe("verifyPayPalWebhookSignature", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const webhookId = "WH-TEST-ID";
  const rawBody = Buffer.from(
    JSON.stringify({
      id: "WH-EVENT-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
    })
  );
  const headers = {
    "paypal-transmission-id": "tx-1",
    "paypal-transmission-time": "2026-09-04T12:00:00Z",
    "paypal-transmission-sig": "",
    "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
    "paypal-auth-algo": "SHA256withRSA",
  };

  it("accepts a valid RSA-SHA256 webhook signature", async () => {
    const sig = signWebhook({
      rawBody,
      webhookId,
      transmissionId: headers["paypal-transmission-id"],
      transmissionTime: headers["paypal-transmission-time"],
      privateKeyPem: privatePem,
    });

    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: { ...headers, "paypal-transmission-sig": sig },
      webhookId,
      nodeEnv: "production",
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(true);
  });

  it("rejects an invalid signature", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: { ...headers, "paypal-transmission-sig": "not-a-valid-signature" },
      webhookId,
      nodeEnv: "production",
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(false);
  });

  it("rejects missing transmission headers", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: { "paypal-auth-algo": "SHA256withRSA" },
      webhookId,
      nodeEnv: "production",
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(false);
  });

  it("never skips verification in production when PAYPAL_WEBHOOK_ID is missing", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers,
      webhookId: "",
      nodeEnv: "production",
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(false);
  });

  it("rejects a certificate URL that is not on the PayPal allowlist", async () => {
    const sig = signWebhook({
      rawBody,
      webhookId,
      transmissionId: headers["paypal-transmission-id"],
      transmissionTime: headers["paypal-transmission-time"],
      privateKeyPem: privatePem,
    });

    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: {
        ...headers,
        "paypal-transmission-sig": sig,
        "paypal-cert-url": "https://evil.example/cert.pem",
      },
      webhookId,
      nodeEnv: "production",
    });

    expect(verified).toBe(false);
  });
});

describe("parsePayPalWebhookEvent", () => {
  it("reads the PayPal order id from capture supplementary data, not the capture id", () => {
    const parsed = parsePayPalWebhookEvent({
      id: "WH-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAPTURE-1",
        supplementary_data: { related_ids: { order_id: "PAYPAL-ORDER-1" } },
      },
    });

    expect(parsed).toMatchObject({
      eventId: "WH-1",
      eventType: "PAYMENT.CAPTURE.COMPLETED",
      resourceId: "CAPTURE-1",
      paypalOrderId: "PAYPAL-ORDER-1",
    });
  });

  it("uses resource.id as the PayPal order id for CHECKOUT.ORDER.APPROVED", () => {
    const parsed = parsePayPalWebhookEvent({
      id: "WH-2",
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: "PAYPAL-ORDER-2", purchase_units: [{ reference_id: "local-order" }] },
    });

    expect(parsed).toMatchObject({
      paypalOrderId: "PAYPAL-ORDER-2",
      referenceOrderId: "local-order",
    });
  });
});
