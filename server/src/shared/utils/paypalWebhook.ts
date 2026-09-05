import { createVerify } from "node:crypto";
import { crc32 as zlibCrc32 } from "node:zlib";
import { logger } from "../logger.js";
import { getPayPalApiTimeoutMs, PAYPAL_WEBHOOK_MAX_SKEW_MS } from "../config/paypal.js";

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
  /** Injected for tests. Production uses the current clock. */
  now?: Date;
};

/**
 * Official PayPal self-verification (preferred over postback).
 * Message: transmissionId|timeStamp|webhookId|crc32(rawBody)
 * Signature: RSA-SHA256 over that string using the cert at paypal-cert-url.
 * Freshness: |now − paypal-transmission-time| must be ≤ 5 minutes (PayPal replay guidance).
 * @see https://developer.paypal.com/api/rest/webhooks/rest/#link-messageverification
 * @see https://developer.paypal.com/api/invoicing/webhooks/#link-validationprocess
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

  if (!isPayPalTransmissionTimeFresh(transmissionTime, input.now ?? new Date())) {
    logger.warn("paypal webhook rejected: transmission time outside freshness window");
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

/**
 * PayPal documents transmission_time as RFC 3339 and requires it to be within
 * 5 minutes of the local clock (absolute skew) to prevent replay of a captured
 * signed request. Legitimate PayPal retries are new HTTP transmissions with a
 * new transmission-time and signature, so they are not blocked by this window.
 */
export function isPayPalTransmissionTimeFresh(
  transmissionTime: string,
  now: Date = new Date(),
  maxSkewMs: number = PAYPAL_WEBHOOK_MAX_SKEW_MS
): boolean {
  const transmittedAt = parsePaypalTransmissionTime(transmissionTime);
  if (!transmittedAt) return false;
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return false;
  return Math.abs(nowMs - transmittedAt.getTime()) <= maxSkewMs;
}

const RFC3339_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

export function parsePaypalTransmissionTime(value: string): Date | null {
  const match = RFC3339_DATE_TIME.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ? Number(`0${match[7]}`) : 0;
  const offset = match[8];

  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  let offsetMinutes = 0;
  if (offset !== "Z") {
    const sign = offset.startsWith("-") ? -1 : 1;
    const offsetHour = Number(offset.slice(1, 3));
    const offsetMinute = Number(offset.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return null;
    offsetMinutes = sign * (offsetHour * 60 + offsetMinute);
  }

  const utcMs =
    Date.UTC(year, month - 1, day, hour, minute, second, Math.round(fraction * 1000)) -
    offsetMinutes * 60_000;
  const parsed = new Date(utcMs);
  if (!Number.isFinite(parsed.getTime())) return null;

  // Reject calendar overflow such as 2026-02-31 by round-tripping wall time.
  const wall = new Date(parsed.getTime() + offsetMinutes * 60_000);
  if (
    wall.getUTCFullYear() !== year ||
    wall.getUTCMonth() + 1 !== month ||
    wall.getUTCDate() !== day ||
    wall.getUTCHours() !== hour ||
    wall.getUTCMinutes() !== minute ||
    wall.getUTCSeconds() !== second
  ) {
    return null;
  }

  return parsed;
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
