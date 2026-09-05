import { describe, expect, it } from "vitest";
import { AppError } from "../../errors/AppError.js";
import { classifyThrownError, isBusinessError } from "../outcomes.js";

describe("telemetry error semantics", () => {
  it("treats expected 4xx AppErrors as business outcomes", () => {
    expect(classifyThrownError(new AppError(409, "Idempotency key was already used"))).toBe(
      "idempotency_conflict"
    );
    expect(classifyThrownError(new AppError(400, "Listing x is not available (status: RESERVED)"))).toBe(
      "reservation_conflict"
    );
    expect(classifyThrownError(new AppError(409, "Reservation expired or listing is no longer reserved"))).toBe(
      "reservation_expired"
    );
    expect(isBusinessError(new AppError(409, "Idempotency key was already used"))).toBe(true);
  });

  it("treats timeouts, provider failures and unexpected errors as operational", () => {
    expect(classifyThrownError(new AppError(504, "PayPal OrdersCreate timed out"))).toBe("timeout");
    expect(classifyThrownError(new AppError(502, "PayPal OrdersGet failed: 500"))).toBe("provider_error");
    expect(classifyThrownError(new Error("ECONNREFUSED"))).toBe("error");
    expect(isBusinessError(new AppError(502, "PayPal OrdersGet failed: 500"))).toBe(false);
  });
});
