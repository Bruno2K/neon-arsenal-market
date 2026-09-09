import paypal from "@paypal/checkout-server-sdk";
import { AppError } from "../errors/AppError.js";
import { logger } from "../logger.js";
import { getPayPalApiBaseUrl, getPayPalApiTimeoutMs, PAYPAL_IDEMPOTENT_RETRY } from "../config/paypal.js";
import { withPaypalOperation } from "../observability/paypal.js";
import { classifyHttpStatus, isTimeoutError, withRetry } from "../resilience/retry.js";
import { isOneOf, isRecord } from "../types/guards.js";
import { MONEY_CURRENCY } from "../money/policy.js";

/**
 * Checkout Orders v2 `status` labels.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_get
 * Unknown labels are discarded so they cannot be compared as COMPLETED via a cast.
 */
export const PAYPAL_ORDER_STATUSES = [
  "CREATED",
  "SAVED",
  "APPROVED",
  "VOIDED",
  "COMPLETED",
  "PAYER_ACTION_REQUIRED",
] as const;
export type PayPalOrderStatus = (typeof PAYPAL_ORDER_STATUSES)[number];

export type PayPalOrderLink = {
  href: string;
  rel: string;
};

export type ParsedPayPalOrder = {
  id?: string;
  status?: PayPalOrderStatus;
  captureId?: string;
  links?: PayPalOrderLink[];
};

export const PAYPAL_REFUND_STATUSES = ["CANCELLED", "FAILED", "PENDING", "COMPLETED"] as const;
export type PayPalRefundStatus = (typeof PAYPAL_REFUND_STATUSES)[number];

export type ParsedPayPalRefund = {
  id: string;
  status: PayPalRefundStatus;
};

export function isPayPalOrderStatus(value: unknown): value is PayPalOrderStatus {
  return isOneOf(value, PAYPAL_ORDER_STATUSES);
}

export function isPayPalCompletedStatus(value: unknown): value is "COMPLETED" {
  return value === "COMPLETED";
}

export function isPayPalApprovedStatus(value: unknown): value is "APPROVED" {
  return value === "APPROVED";
}

export function parsePayPalOrderResource(value: unknown): ParsedPayPalOrder {
  if (!isRecord(value)) {
    throw new AppError(502, "PayPal order response is not an object");
  }

  const parsed: ParsedPayPalOrder = {};
  if (typeof value.id === "string" && value.id.length > 0) {
    parsed.id = value.id;
  }
  if (isPayPalOrderStatus(value.status)) {
    parsed.status = value.status;
  }
  const captureId = parseRefundablePayPalCaptureId(value.purchase_units);
  if (captureId) {
    parsed.captureId = captureId;
  }
  const links = parsePayPalOrderLinks(value.links);
  if (links.length > 0) {
    parsed.links = links;
  }
  return parsed;
}

function parseRefundablePayPalCaptureId(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const unit of value) {
    if (!isRecord(unit) || !isRecord(unit.payments) || !Array.isArray(unit.payments.captures)) {
      continue;
    }
    for (const capture of unit.payments.captures) {
      if (
        isRecord(capture) &&
        (capture.status === "COMPLETED" || capture.status === "REFUNDED") &&
        typeof capture.id === "string" &&
        capture.id.length > 0
      ) {
        return capture.id;
      }
    }
  }
  return undefined;
}

export function parsePayPalRefundResource(value: unknown): ParsedPayPalRefund {
  if (!isRecord(value)) {
    throw new AppError(502, "PayPal refund response is not an object");
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new AppError(502, "PayPal refund response id is missing");
  }
  if (!isOneOf(value.status, PAYPAL_REFUND_STATUSES)) {
    throw new AppError(502, "PayPal refund response status is invalid");
  }
  return { id: value.id, status: value.status };
}

function parsePayPalOrderLinks(value: unknown): PayPalOrderLink[] {
  if (!Array.isArray(value)) return [];
  const links: PayPalOrderLink[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.href !== "string" || item.href.length === 0) continue;
    if (typeof item.rel !== "string" || item.rel.length === 0) continue;
    links.push({ href: item.href, rel: item.rel });
  }
  return links;
}

function parsePayPalAccessToken(value: unknown): { access_token: string; expires_in?: number } {
  if (!isRecord(value) || typeof value.access_token !== "string" || value.access_token.length === 0) {
    throw new AppError(502, "PayPal OAuth token missing");
  }
  return {
    access_token: value.access_token,
    expires_in: typeof value.expires_in === "number" && Number.isFinite(value.expires_in)
      ? value.expires_in
      : undefined,
  };
}

function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
  const secret = process.env.PAYPAL_SECRET ?? "";
  const mode = process.env.PAYPAL_MODE ?? "sandbox";
  if (mode === "production") {
    return new paypal.core.LiveEnvironment(clientId, secret);
  }
  return new paypal.core.SandboxEnvironment(clientId, secret);
}

const client = new paypal.core.PayPalHttpClient(environment());

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

/** Mutating PayPal calls are not retried; lookups and token/cert fetches may retry. */
export const PAYPAL_HTTP_POLICY = {
  orders_create: { retry: false, reason: "OrdersCreate can open a second PayPal order" },
  orders_capture: { retry: false, reason: "OrdersCapture can capture funds more than once" },
  captures_refund: {
    retry: false,
    reason: "Refund replay is coordinated from durable state with the same PayPal-Request-Id",
  },
  orders_get: { retry: true, ...PAYPAL_IDEMPOTENT_RETRY },
  oauth_token: { retry: true, ...PAYPAL_IDEMPOTENT_RETRY },
  cert_download: { retry: true, ...PAYPAL_IDEMPOTENT_RETRY },
} as const;

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  const ms = getPayPalApiTimeoutMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError(504, `${label} timed out`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type PayPalCheckoutUrls = {
  returnUrl?: string;
  cancelUrl?: string;
};

type PayPalOrdersCreateBody = {
  intent: "CAPTURE";
  purchase_units: Array<{
    reference_id: string;
    amount: { currency_code: string; value: string };
  }>;
  application_context?: {
    return_url?: string;
    cancel_url?: string;
  };
};

/** PayPal Orders v2 body. Omits application_context unless client URLs were supplied. */
export function buildPayPalOrdersCreateBody(
  amount: string,
  currency: string,
  orderId: string,
  urls?: PayPalCheckoutUrls
): PayPalOrdersCreateBody {
  const body: PayPalOrdersCreateBody = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: orderId,
        amount: {
          currency_code: currency,
          value: amount,
        },
      },
    ],
  };
  const application_context: { return_url?: string; cancel_url?: string } = {};
  if (urls?.returnUrl) application_context.return_url = urls.returnUrl;
  if (urls?.cancelUrl) application_context.cancel_url = urls.cancelUrl;
  if (application_context.return_url || application_context.cancel_url) {
    body.application_context = application_context;
  }
  return body;
}

export async function createPayPalOrder(
  amount: string,
  currency = MONEY_CURRENCY,
  orderId: string,
  urls?: PayPalCheckoutUrls
): Promise<ParsedPayPalOrder> {
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody(buildPayPalOrdersCreateBody(amount, currency, orderId, urls));
  return withPaypalOperation("orders_create", async () => {
    // OrdersCreate is not retried: a retry can create a second PayPal order.
    try {
      const response = await withTimeout(client.execute(request), "PayPal OrdersCreate");
      return parsePayPalOrderResource(response.result);
    } catch (err) {
      throw mapPayPalHttpError(err);
    }
  });
}

export async function capturePayPalOrder(orderId: string): Promise<ParsedPayPalOrder> {
  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});
  return withPaypalOperation("orders_capture", async () => {
    // OrdersCapture is not retried: a retry can capture funds more than once.
    try {
      const response = await withTimeout(client.execute(request), "PayPal OrdersCapture");
      return parsePayPalOrderResource(response.result);
    } catch (err) {
      throw mapPayPalHttpError(err);
    }
  });
}

export async function getPayPalOrder(paypalOrderId: string): Promise<ParsedPayPalOrder> {
  return withPaypalOperation("orders_get", async () => {
    const token = await getPayPalAccessToken();
    const url = `${getPayPalApiBaseUrl()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`;
    try {
      return await withRetry(
        async () => {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(getPayPalApiTimeoutMs()),
          });
          if (!response.ok) {
            throw Object.assign(
              new AppError(502, `PayPal OrdersGet failed: ${response.status}`),
              classifyHttpStatus(response.status)
            );
          }
          return parsePayPalOrderResource(await response.json());
        },
        {
          maxAttempts: PAYPAL_HTTP_POLICY.orders_get.maxAttempts,
          baseDelayMs: PAYPAL_HTTP_POLICY.orders_get.baseDelayMs,
          onRetry: ({ attempt, reason }) => {
            logger.warn({ attempt, reason }, "PayPal OrdersGet retrying");
          },
        }
      );
    } catch (err) {
      if (isTimeoutError(err)) throw new AppError(504, "PayPal OrdersGet timed out");
      throw err;
    }
  });
}

/**
 * Issues one full capture refund attempt. The caller owns durable retry state and
 * must reuse requestId after ambiguous outcomes. No amount is sent, so PayPal
 * refunds the remaining captured amount in full.
 */
export async function refundPayPalCapture(
  captureId: string,
  requestId: string
): Promise<ParsedPayPalRefund> {
  if (!captureId.trim() || !requestId.trim()) {
    throw new AppError(400, "PayPal refund capture id and request id are required");
  }

  return withPaypalOperation("captures_refund", async () => {
    const token = await getPayPalAccessToken();
    const url = `${getPayPalApiBaseUrl()}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": requestId,
          Prefer: "return=representation",
        },
        body: "{}",
        signal: AbortSignal.timeout(getPayPalApiTimeoutMs()),
      });
      if (!response.ok) {
        throw new AppError(502, `PayPal CapturesRefund failed: ${response.status}`);
      }
      return parsePayPalRefundResource(await response.json());
    } catch (err) {
      if (isTimeoutError(err)) throw new AppError(504, "PayPal CapturesRefund timed out");
      throw mapPayPalHttpError(err);
    }
  });
}

export async function getPayPalAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  return withPaypalOperation("oauth_token", async () => {
    const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
    const secret = process.env.PAYPAL_SECRET ?? "";
    const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");
    try {
      const body = await withRetry(
        async () => {
          const response = await fetch(`${getPayPalApiBaseUrl()}/v1/oauth2/token`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${credentials}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
            signal: AbortSignal.timeout(getPayPalApiTimeoutMs()),
          });
          if (!response.ok) {
            throw Object.assign(
              new AppError(502, "PayPal OAuth token request failed"),
              classifyHttpStatus(response.status)
            );
          }
          return parsePayPalAccessToken(await response.json());
        },
        {
          maxAttempts: PAYPAL_HTTP_POLICY.oauth_token.maxAttempts,
          baseDelayMs: PAYPAL_HTTP_POLICY.oauth_token.baseDelayMs,
          onRetry: ({ attempt, reason }) => {
            logger.warn({ attempt, reason }, "PayPal OAuth token retrying");
          },
        }
      );
      const ttlMs = Math.max(30_000, ((body.expires_in ?? 300) - 30) * 1000);
      tokenCache = { token: body.access_token, expiresAt: Date.now() + ttlMs };
      return tokenCache.token;
    } catch (err) {
      if (isTimeoutError(err)) throw new AppError(504, "PayPal OAuth token request timed out");
      throw err;
    }
  });
}

export const PAYPAL_CLIENT_AUTH_FAILED = "PayPal client authentication failed";

export function isPayPalOrderAlreadyCapturedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /ORDER_ALREADY_CAPTURED|ORDER_ALREADY_COMPLETED/i.test(message);
}

export function isPayPalClientAuthError(err: unknown): boolean {
  const status = isRecord(err) ? err.statusCode : undefined;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    status === 401 ||
    /invalid_client|Client Authentication failed/i.test(message)
  );
}

/** Stable AppError for REST credential failures. Does not echo PayPal JSON. */
export function mapPayPalHttpError(err: unknown): Error {
  if (err instanceof AppError) return err;
  if (isPayPalClientAuthError(err)) {
    return new AppError(503, PAYPAL_CLIENT_AUTH_FAILED);
  }
  return err instanceof Error ? err : new Error(String(err));
}

export function getPayPalOrderIdFromResult(result: ParsedPayPalOrder): string | undefined {
  return result.id;
}

export function getPayPalApprovalLink(result: ParsedPayPalOrder): string | undefined {
  const link = result.links?.find((l) => l.rel === "approve");
  return link?.href;
}

/** Test seam so failure-recovery tests can force a fresh OAuth token fetch. */
export function resetPayPalTokenCacheForTests(): void {
  tokenCache = null;
}
