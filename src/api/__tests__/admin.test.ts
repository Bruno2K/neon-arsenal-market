import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAdminOrders } from "../admin";

const get = vi.fn();

vi.mock("../client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
  },
}));

describe("listAdminOrders", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue([]);
  });

  it("GETs /admin/orders without query when called without filters", async () => {
    await listAdminOrders();
    expect(get).toHaveBeenCalledWith("/admin/orders");
  });

  it("sends status and paymentStatus query params the admin API already accepts", async () => {
    await listAdminOrders({ status: "PENDING", paymentStatus: "PAID" });
    expect(get).toHaveBeenCalledWith(
      "/admin/orders?status=PENDING&paymentStatus=PAID",
    );
  });

  it("omits unknown filter values instead of inventing query params", async () => {
    await listAdminOrders({ status: "CANCELED", paymentStatus: "CAPTURED" });
    expect(get).toHaveBeenCalledWith("/admin/orders");
  });
});
