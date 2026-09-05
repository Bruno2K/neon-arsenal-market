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
  const now = new Date("2026-09-05T12:00:00.000Z");
  const recentTime = "2026-09-05T11:59:30Z";
  const rawBody = Buffer.from(
    JSON.stringify({
      id: "WH-EVENT-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
    })
  );

  function headersFor(transmissionTime: string) {
    return {
      "paypal-transmission-id": "tx-1",
      "paypal-transmission-time": transmissionTime,
      "paypal-transmission-sig": signWebhook({
        rawBody,
        webhookId,
        transmissionId: "tx-1",
        transmissionTime,
        privateKeyPem: privatePem,
      }),
      "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
      "paypal-auth-algo": "SHA256withRSA" as const,
    };
  }

  it("accepts a valid RSA-SHA256 signature with a recent transmission time", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: headersFor(recentTime),
      webhookId,
      nodeEnv: "production",
      now,
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(true);
  });

  it("rejects an old transmission time even when the signature is valid", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: headersFor("2026-09-05T11:54:59Z"),
      webhookId,
      nodeEnv: "production",
      now,
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(false);
  });

  it("rejects a malformed transmission time even when the signature is valid", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: headersFor("not-a-timestamp"),
      webhookId,
      nodeEnv: "production",
      now,
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(false);
  });

  it("rejects a calendar-overflow transmission time", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: headersFor("2026-02-31T12:00:00Z"),
      webhookId,
      nodeEnv: "production",
      now,
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(false);
  });

  it("rejects a transmission time more than 5 minutes in the future", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: headersFor("2026-09-05T12:05:01Z"),
      webhookId,
      nodeEnv: "production",
      now,
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(false);
  });

  it("accepts a transmission time slightly in the future within the 5-minute clock-skew window", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: headersFor("2026-09-05T12:02:00Z"),
      webhookId,
      nodeEnv: "production",
      now,
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(true);
  });

  it("rejects an invalid signature", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: { ...headersFor(recentTime), "paypal-transmission-sig": "not-a-valid-signature" },
      webhookId,
      nodeEnv: "production",
      now,
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
      now,
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(false);
  });

  it("never skips verification in production when PAYPAL_WEBHOOK_ID is missing", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: headersFor(recentTime),
      webhookId: "",
      nodeEnv: "production",
      now,
      fetchCertificate: async () => publicPem,
    });

    expect(verified).toBe(false);
  });

  it("rejects a certificate URL that is not on the PayPal allowlist", async () => {
    const verified = await verifyPayPalWebhookSignature({
      rawBody,
      headers: {
        ...headersFor(recentTime),
        "paypal-cert-url": "https://evil.example/cert.pem",
      },
      webhookId,
      nodeEnv: "production",
      now,
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
