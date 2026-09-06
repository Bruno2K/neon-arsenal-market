import { describe, expect, it } from "vitest";
import { AppError } from "../../errors/AppError.js";
import {
  getPayPalApprovalLink,
  isPayPalApprovedStatus,
  isPayPalCompletedStatus,
  isPayPalOrderStatus,
  parsePayPalOrderResource,
} from "../paypal.js";

describe("parsePayPalOrderResource", () => {
  it("keeps documented COMPLETED and APPROVED statuses", () => {
    expect(parsePayPalOrderResource({ id: "paypal-1", status: "COMPLETED" })).toEqual({
      id: "paypal-1",
      status: "COMPLETED",
    });
    expect(parsePayPalOrderResource({ id: "paypal-2", status: "APPROVED" })).toEqual({
      id: "paypal-2",
      status: "APPROVED",
    });
  });

  it("does not treat local payment labels or case variants as COMPLETED", () => {
    expect(parsePayPalOrderResource({ id: "paypal-1", status: "PAID" }).status).toBeUndefined();
    expect(parsePayPalOrderResource({ id: "paypal-1", status: "completed" }).status).toBeUndefined();
    expect(parsePayPalOrderResource({ id: "paypal-1", status: "CAPTURED" }).status).toBeUndefined();
    expect(isPayPalCompletedStatus("PAID")).toBe(false);
    expect(isPayPalCompletedStatus("completed")).toBe(false);
    expect(isPayPalCompletedStatus("COMPLETED")).toBe(true);
    expect(isPayPalApprovedStatus("APPROVED")).toBe(true);
    expect(isPayPalApprovedStatus("approved")).toBe(false);
  });

  it("rejects a non-object PayPal body instead of casting it", () => {
    try {
      parsePayPalOrderResource("COMPLETED");
      throw new Error("expected parse to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: 502,
        message: "PayPal order response is not an object",
      });
    }
  });

  it("extracts only well-formed approve links", () => {
    const parsed = parsePayPalOrderResource({
      id: "paypal-1",
      status: "CREATED",
      links: [
        { href: "https://www.sandbox.paypal.com/checkoutnow?token=paypal-1", rel: "approve" },
        { href: 1, rel: "approve" },
        "not-a-link",
      ],
    });

    expect(getPayPalApprovalLink(parsed)).toBe(
      "https://www.sandbox.paypal.com/checkoutnow?token=paypal-1"
    );
    expect(isPayPalOrderStatus(parsed.status)).toBe(true);
  });
});
