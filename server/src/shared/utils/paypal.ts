import paypal from "@paypal/checkout-server-sdk";
import { AppError } from "../errors/AppError.js";
import { logger } from "../logger.js";
import { getPayPalApiBaseUrl, getPayPalApiTimeoutMs, PAYPAL_IDEMPOTENT_RETRY } from "../config/paypal.js";
import { withPaypalOperation } from "../observability/paypal.js";
import { classifyHttpStatus, isTimeoutError, withRetry } from "../resilience/retry.js";

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
  currency = "BRL",
  orderId: string,
  urls?: PayPalCheckoutUrls
) {
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody(buildPayPalOrdersCreateBody(amount, currency, orderId, urls));
  return withPaypalOperation("orders_create", async () => {
    // OrdersCreate is not retried: a retry can create a second PayPal order.
    const response = await withTimeout(client.execute(request), "PayPal OrdersCreate");
    return response.result;
  });
}

export async function capturePayPalOrder(orderId: string) {
  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});
  return withPaypalOperation("orders_capture", async () => {
    const response = await withTimeout(client.execute(request), "PayPal OrdersCapture");
    return response.result;
  });
}

export async function getPayPalOrder(paypalOrderId: string): Promise<{ id?: string; status?: string }> {
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
          return (await response.json()) as { id?: string; status?: string };
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
          return (await response.json()) as { access_token?: string; expires_in?: number };
        },
        {
          maxAttempts: PAYPAL_HTTP_POLICY.oauth_token.maxAttempts,
          baseDelayMs: PAYPAL_HTTP_POLICY.oauth_token.baseDelayMs,
          onRetry: ({ attempt, reason }) => {
            logger.warn({ attempt, reason }, "PayPal OAuth token retrying");
          },
        }
      );
      if (!body.access_token) {
        throw new AppError(502, "PayPal OAuth token missing");
      }
      const ttlMs = Math.max(30_000, ((body.expires_in ?? 300) - 30) * 1000);
      tokenCache = { token: body.access_token, expiresAt: Date.now() + ttlMs };
      return tokenCache.token;
    } catch (err) {
      if (isTimeoutError(err)) throw new AppError(504, "PayPal OAuth token request timed out");
      throw err;
    }
  });
}

export function getPayPalOrderIdFromResult(result: { id?: string }): string | undefined {
  return result.id;
}

export function getPayPalApprovalLink(result: { links?: Array<{ href?: string; rel?: string }> }): string | undefined {
  const link = result.links?.find((l) => l.rel === "approve");
  return link?.href;
}
