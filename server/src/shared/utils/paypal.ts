import paypal from "@paypal/checkout-server-sdk";
import { AppError } from "../errors/AppError.js";
import { logger } from "../logger.js";
import { getPayPalApiBaseUrl, getPayPalApiTimeoutMs } from "../config/paypal.js";

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

export async function createPayPalOrder(amount: string, currency = "BRL", orderId: string) {
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
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
  });
  // OrdersCreate is not retried: a retry can create a second PayPal order.
  const response = await withTimeout(client.execute(request), "PayPal OrdersCreate");
  return response.result;
}

export async function capturePayPalOrder(orderId: string) {
  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});
  const response = await withTimeout(client.execute(request), "PayPal OrdersCapture");
  return response.result;
}

export async function getPayPalOrder(paypalOrderId: string): Promise<{ id?: string; status?: string }> {
  const token = await getPayPalAccessToken();
  const url = `${getPayPalApiBaseUrl()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(getPayPalApiTimeoutMs()),
      });
      if (response.status >= 500 || response.status === 429) {
        lastError = new AppError(502, `PayPal OrdersGet failed: ${response.status}`);
        if (attempt < 3) await delay(200 * attempt);
        continue;
      }
      if (!response.ok) {
        throw new AppError(502, `PayPal OrdersGet failed: ${response.status}`);
      }
      return (await response.json()) as { id?: string; status?: string };
    } catch (err) {
      if (err instanceof AppError && !isRetryablePayPalLookupError(err)) {
        throw err;
      }
      lastError = err;
      if (attempt < 3) await delay(200 * attempt);
    }
  }
  logger.warn({ err: lastError, paypalOrderId }, "PayPal OrdersGet exhausted retries");
  throw lastError instanceof Error ? lastError : new AppError(502, "PayPal OrdersGet failed");
}

export async function getPayPalAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
  const secret = process.env.PAYPAL_SECRET ?? "";
  const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");
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
    throw new AppError(502, "PayPal OAuth token request failed");
  }
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new AppError(502, "PayPal OAuth token missing");
  }
  const ttlMs = Math.max(30_000, ((body.expires_in ?? 300) - 30) * 1000);
  tokenCache = { token: body.access_token, expiresAt: Date.now() + ttlMs };
  return body.access_token;
}

export function getPayPalOrderIdFromResult(result: { id?: string }): string | undefined {
  return result.id;
}

export function getPayPalApprovalLink(result: { links?: Array<{ href?: string; rel?: string }> }): string | undefined {
  const link = result.links?.find((l) => l.rel === "approve");
  return link?.href;
}

function isRetryablePayPalLookupError(err: AppError): boolean {
  if (err.statusCode === 504) return true;
  const statusMatch = err.message.match(/PayPal OrdersGet failed: (\d+)/);
  if (!statusMatch) return false;
  const status = Number(statusMatch[1]);
  return status >= 500 || status === 429;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
