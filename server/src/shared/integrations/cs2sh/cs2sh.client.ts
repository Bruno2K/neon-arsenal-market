import { AppError } from "../../errors/AppError.js";
import { logger } from "../../logger.js";
import {
  CS2SH_IDEMPOTENT_RETRY,
  getCs2ShApiBaseUrl,
  getCs2ShApiKey,
  getCs2ShApiTimeoutMs,
} from "../../config/cs2sh.js";
import {
  classifyHttpStatus,
  isTimeoutError,
  withRetry,
} from "../../resilience/retry.js";
import type { Cs2ShPricesResponse, Cs2ShSchemaResponse } from "./cs2sh.types.js";

export type Cs2ShFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type Cs2ShClient = {
  fetchSchema: () => Promise<Cs2ShSchemaResponse>;
  fetchLatestPrices: () => Promise<Cs2ShPricesResponse>;
};

export const CS2SH_HTTP_POLICY = {
  schema_get: { retry: true, ...CS2SH_IDEMPOTENT_RETRY },
  prices_get: { retry: true, ...CS2SH_IDEMPOTENT_RETRY },
} as const;

export function createCs2ShClient(deps: {
  fetch?: Cs2ShFetch;
  sleep?: (ms: number) => Promise<void>;
} = {}): Cs2ShClient {
  const fetchFn = deps.fetch ?? fetch;
  const sleepFn = deps.sleep;
  return {
    fetchSchema: () => getJson<Cs2ShSchemaResponse>("/v1/schema", "cs2.sh schema", fetchFn, sleepFn),
    fetchLatestPrices: () =>
      getJson<Cs2ShPricesResponse>("/v1/prices/latest", "cs2.sh prices", fetchFn, sleepFn),
  };
}

async function getJson<T>(
  path: string,
  label: string,
  fetchFn: Cs2ShFetch,
  sleepFn?: (ms: number) => Promise<void>
): Promise<T> {
  const apiKey = getCs2ShApiKey();
  if (!apiKey) {
    throw new AppError(503, "cs2.sh API key is not configured");
  }
  const url = `${getCs2ShApiBaseUrl()}${path}`;
  try {
    return await withRetry(
      async () => {
        let response: Response;
        try {
          response = await fetchFn(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: "application/json",
              "Accept-Encoding": "gzip",
            },
            signal: AbortSignal.timeout(getCs2ShApiTimeoutMs()),
          });
        } catch (err) {
          if (isTimeoutError(err)) {
            throw new AppError(504, `${label} timed out`);
          }
          throw Object.assign(new AppError(502, `${label} request failed`), {
            retryable: true,
            reason: "network" as const,
          });
        }
        if (!response.ok) {
          throw Object.assign(
            new AppError(502, `${label} failed: ${response.status}`),
            classifyHttpStatus(response.status)
          );
        }
        return (await response.json()) as T;
      },
        {
          maxAttempts: CS2SH_IDEMPOTENT_RETRY.maxAttempts,
          baseDelayMs: CS2SH_IDEMPOTENT_RETRY.baseDelayMs,
          sleep: sleepFn,
          onRetry: ({ attempt, reason }) => {
            logger.warn({ attempt, reason, label }, "cs2.sh GET retrying");
          },
        }
    );
  } catch (err) {
    if (isTimeoutError(err)) throw new AppError(504, `${label} timed out`);
    throw err;
  }
}
