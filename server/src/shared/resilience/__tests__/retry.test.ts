import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../errors/AppError.js";
import {
  classifyExternalFailure,
  classifyHttpStatus,
  withRetry,
} from "../retry.js";

describe("retry classification", () => {
  it("retries HTTP 429 and 5xx and refuses other 4xx", () => {
    expect(classifyHttpStatus(429)).toEqual({ retryable: true, reason: "http_429" });
    expect(classifyHttpStatus(503)).toEqual({ retryable: true, reason: "http_5xx" });
    expect(classifyHttpStatus(400)).toEqual({ retryable: false, reason: "http_4xx" });
    expect(classifyHttpStatus(404)).toEqual({ retryable: false, reason: "http_4xx" });
  });

  it("retries timeouts and tagged network failures", () => {
    const timeout = new Error("Aborted");
    timeout.name = "TimeoutError";
    expect(classifyExternalFailure(timeout)).toEqual({ retryable: true, reason: "timeout" });
    expect(classifyExternalFailure(new AppError(504, "PayPal OrdersGet timed out"))).toEqual({
      retryable: true,
      reason: "timeout",
    });
    expect(classifyExternalFailure(new TypeError("fetch failed"))).toEqual({
      retryable: true,
      reason: "network",
    });
  });

  it("does not retry ordinary 4xx AppErrors", () => {
    expect(classifyExternalFailure(new AppError(400, "bad request"))).toEqual({
      retryable: false,
      reason: "non_retryable",
    });
  });
});

describe("withRetry", () => {
  it("retries retryable failures with exponential backoff then succeeds", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw Object.assign(new Error("upstream"), classifyHttpStatus(503));
        }
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 200, sleep }
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([200, 400]);
  });

  it("does not retry non-retryable failures", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const operation = vi.fn(async () => {
      throw Object.assign(new AppError(502, "PayPal OrdersGet failed: 404"), classifyHttpStatus(404));
    });
    await expect(withRetry(operation, { maxAttempts: 3, baseDelayMs: 200, sleep })).rejects.toMatchObject({
      statusCode: 502,
    });
    expect(operation).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops after maxAttempts for retryable failures", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const operation = vi.fn(async () => {
      throw Object.assign(new Error("upstream"), classifyHttpStatus(503));
    });
    await expect(withRetry(operation, { maxAttempts: 3, baseDelayMs: 50, sleep })).rejects.toMatchObject({
      message: "upstream",
    });
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
