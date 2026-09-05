import { createVerify } from "node:crypto";
import { crc32 as zlibCrc32 } from "node:zlib";
import { logger } from "../logger.js";
import { getPayPalApiTimeoutMs } from "../config/paypal.js";

const PAYPAL_CERT_HOSTS = new Set([
  "api.paypal.com",
  "api-m.paypal.com",
  "api.sandbox.paypal.com",
  "api-m.sandbox.paypal.com",
]);

const certCache = new Map<string, { pem: string; cachedAt: number }>();
const CERT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const PAYPAL_WEBHOOK_HEADERS = [
  "paypal-transmission-id",
  "paypal-transmission-time",
  "paypal-transmission-sig",
  "paypal-cert-url",
  "paypal-auth-algo",
] as const;

export type PayPalWebhookHeaders = {
  "paypal-transmission-id"?: string;
  "paypal-transmission-time"?: string;
  "paypal-transmission-sig"?: string;
  "paypal-cert-url"?: string;
  "paypal-auth-algo"?: string;
};

export type VerifyPayPalWebhookInput = {
  rawBody: Buffer;
  headers: PayPalWebhookHeaders;
  webhookId?: string;
  nodeEnv?: string;
  fetchCertificate?: (url: string) => Promise<string>;
};

/**
 * Official PayPal self-verification (preferred over postback).
 * Message: transmissionId|timeStamp|webhookId|crc32(rawBody)
 * Signature: RSA-SHA256 over that string using the cert at paypal-cert-url.
 * @see https://developer.paypal.com/api/rest/webhooks/rest/#link-messageverification
 */
export async function verifyPayPalWebhookSignature(input: VerifyPayPalWebhookInput): Promise<boolean> {
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const webhookId = input.webhookId ?? process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    if (nodeEnv === "production") {
      logger.error("PAYPAL_WEBHOOK_ID is required to verify webhooks in production");
      return false;
    }
    logger.warn("PAYPAL_WEBHOOK_ID missing; skipping webhook verification outside production");
    return true;
  }

  const transmissionId = input.headers["paypal-transmission-id"];
  const transmissionTime = input.headers["paypal-transmission-time"];
  const transmissionSig = input.headers["paypal-transmission-sig"];
  const certUrl = input.headers["paypal-cert-url"];
  const authAlgo = input.headers["paypal-auth-algo"];

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  if (authAlgo !== "SHA256withRSA") {
    logger.warn({ authAlgo }, "paypal webhook rejected: unsupported auth algo");
    return false;
  }

  const crc = computePaypalCrc32(input.rawBody);
  const message = `${transmissionId}|${transmissionTime}|${webhookId}|${crc}`;

  try {
    const certPem = await (input.fetchCertificate ?? downloadPayPalCertificate)(certUrl);
    const verifier = createVerify("SHA256");
    verifier.update(message);
    return verifier.verify(certPem, transmissionSig, "base64");
  } catch (err) {
    logger.warn({ err }, "paypal webhook signature verification failed");
    return false;
  }
}

export function computePaypalCrc32(rawBody: Buffer): number {
  if (typeof zlibCrc32 === "function") {
    return zlibCrc32(rawBody) >>> 0;
  }
  return fallbackCrc32(rawBody);
}

function fallbackCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function downloadPayPalCertificate(url: string): Promise<string> {
  const cached = certCache.get(url);
  if (cached && Date.now() - cached.cachedAt < CERT_CACHE_TTL_MS) {
    return cached.pem;
  }

  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("PayPal certificate URL must be https");
  }
  if (!PAYPAL_CERT_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("PayPal certificate URL host is not allowlisted");
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(getPayPalApiTimeoutMs()) });
  if (!response.ok) {
    throw new Error(`PayPal certificate download failed: ${response.status}`);
  }
  const pem = await response.text();
  certCache.set(url, { pem, cachedAt: Date.now() });
  return pem;
}

export const PAYPAL_EVENT_CAPTURE_COMPLETED = "PAYMENT.CAPTURE.COMPLETED";
export const PAYPAL_EVENT_ORDER_APPROVED = "CHECKOUT.ORDER.APPROVED";

export type ParsedPayPalWebhookEvent = {
  eventId: string;
  eventType: string;
  resourceId?: string;
  referenceOrderId?: string;
  paypalOrderId?: string;
};

export function parsePayPalWebhookEvent(body: unknown): ParsedPayPalWebhookEvent | null {
  if (!body || typeof body !== "object") return null;
  const event = body as {
    id?: unknown;
    event_type?: unknown;
    resource?: {
      id?: unknown;
      purchase_units?: Array<{ reference_id?: unknown }>;
      supplementary_data?: { related_ids?: { order_id?: unknown } };
    };
  };
  if (typeof event.id !== "string" || event.id.length === 0) return null;
  if (typeof event.event_type !== "string" || event.event_type.length === 0) return null;

  const reference = event.resource?.purchase_units?.[0]?.reference_id;
  const relatedOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
  const resourceId = typeof event.resource?.id === "string" ? event.resource.id : undefined;

  return {
    eventId: event.id,
    eventType: event.event_type,
    resourceId,
    referenceOrderId: typeof reference === "string" ? reference : undefined,
    paypalOrderId:
      typeof relatedOrderId === "string"
        ? relatedOrderId
        : event.event_type === PAYPAL_EVENT_ORDER_APPROVED
          ? resourceId
          : undefined,
  };
}
