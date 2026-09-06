import { describe, expect, it } from "vitest";
import {
  adminOrderListQuery,
  hasAdminOrderFilters,
  parseAdminOrderStatus,
  parseAdminPaymentStatus,
} from "../adminOrderFilters";

describe("adminOrderFilters", () => {
  it("accepts API status and paymentStatus values", () => {
    expect(parseAdminOrderStatus("CONFIRMED")).toBe("CONFIRMED");
    expect(parseAdminPaymentStatus("PENDING")).toBe("PENDING");
    expect(
      adminOrderListQuery({
        status: "SHIPPED",
        paymentStatus: "PAID",
      }),
    ).toEqual({ status: "SHIPPED", paymentStatus: "PAID" });
  });

  it("ignores empty or unknown query values instead of inventing filters", () => {
    expect(parseAdminOrderStatus("")).toBeUndefined();
    expect(parseAdminOrderStatus("CANCELED")).toBeUndefined();
    expect(parseAdminPaymentStatus("CAPTURED")).toBeUndefined();
    expect(adminOrderListQuery({ status: "nope", paymentStatus: " " })).toEqual(
      {},
    );
    expect(hasAdminOrderFilters({})).toBe(false);
    expect(hasAdminOrderFilters({ status: "PENDING" })).toBe(true);
  });
});
