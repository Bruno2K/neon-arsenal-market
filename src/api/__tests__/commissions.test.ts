import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCommissionBalance,
  listCommissionTransactions,
} from "../commissions";

const get = vi.fn();

vi.mock("../client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
  },
}));

describe("commissions API client", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("GETs /commissions/balance", async () => {
    get.mockResolvedValue({ balance: "135.00" });

    const result = await getCommissionBalance();

    expect(get).toHaveBeenCalledWith("/commissions/balance");
    expect(result).toEqual({ balance: "135.00" });
  });

  it("GETs /commissions/transactions", async () => {
    const rows = [
      {
        id: "tx-1",
        sellerId: "seller-1",
        orderId: "ord-1",
        grossAmount: "100.00",
        commissionAmount: "10.00",
        netAmount: "90.00",
        status: "PAID",
        createdAt: "2026-09-01T12:00:00.000Z",
      },
    ];
    get.mockResolvedValue(rows);

    const result = await listCommissionTransactions();

    expect(get).toHaveBeenCalledWith("/commissions/transactions");
    expect(result).toEqual(rows);
  });
});
