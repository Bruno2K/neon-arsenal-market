import { AppError } from "../errors/AppError.js";

export const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
export const DEFAULT_RETRY_BASE_DELAY_MS = 200;

export type RetryReason =
  | "timeout"
  | "network"
  | "http_429"
  | "http_5xx"
  | "http_4xx"
  | "non_retryable"
  | "unknown";

export type RetryClassification = {
  retryable: boolean;
  reason: RetryReason;
};

export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  classify?: (err: unknown) => RetryClassification;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (info: {
    attempt: number;
    maxAttempts: number;
    delayMs: number;
    reason: RetryReason;
    error: unknown;
  }) => void;
};

export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

export function classifyHttpStatus(status: number): RetryClassification {
  if (status === 429) return { retryable: true, reason: "http_429" };
  if (status >= 500) return { retryable: true, reason: "http_5xx" };
  if (status >= 400) return { retryable: false, reason: "http_4xx" };
  return { retryable: false, reason: "unknown" };
}

export function classifyExternalFailure(err: unknown): RetryClassification {
  const tagged = readTaggedClassification(err);
  if (tagged) return tagged;
  if (isTimeoutError(err)) return { retryable: true, reason: "timeout" };
  if (err instanceof AppError) {
    if (err.statusCode === 504) return { retryable: true, reason: "timeout" };
    if (err.statusCode >= 500) return { retryable: false, reason: "non_retryable" };
    return { retryable: false, reason: "non_retryable" };
  }
  if (isNetworkError(err)) return { retryable: true, reason: "network" };
  return { retryable: false, reason: "unknown" };
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts);
  const classify = options.classify ?? classifyExternalFailure;
  const sleepFn = options.sleep ?? sleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const decision = classify(err);
      if (!decision.retryable || attempt >= maxAttempts) {
        throw err;
      }
      const delayMs = options.baseDelayMs * 2 ** (attempt - 1);
      options.onRetry?.({
        attempt,
        maxAttempts,
        delayMs,
        reason: decision.reason,
        error: err,
      });
      await sleepFn(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Retry exhausted");
}

function readTaggedClassification(err: unknown): RetryClassification | undefined {
  if (!err || typeof err !== "object") return undefined;
  if (!("retryable" in err) || !("reason" in err)) return undefined;
  const retryable = Boolean((err as { retryable: unknown }).retryable);
  const reason = (err as { reason: unknown }).reason;
  if (
    reason !== "timeout" &&
    reason !== "network" &&
    reason !== "http_429" &&
    reason !== "http_5xx" &&
    reason !== "http_4xx" &&
    reason !== "non_retryable" &&
    reason !== "unknown"
  ) {
    return undefined;
  }
  return { retryable, reason };
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "TypeError") return true;
  return /ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EPIPE|fetch failed/i.test(err.message);
}
