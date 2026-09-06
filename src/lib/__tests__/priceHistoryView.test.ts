import { describe, expect, it } from "vitest";
import { PRICE_HISTORY_EMPTY, sparklinePoints } from "../priceHistoryView";

describe("priceHistoryView", () => {
  it("keeps empty copy honest", () => {
    expect(PRICE_HISTORY_EMPTY).toBe("Sem alterações de preço ainda");
  });

  it("builds svg points from newPrice values", () => {
    const points = sparklinePoints([
      {
        id: "1",
        listingId: "l1",
        oldPrice: 10,
        newPrice: 12,
        changedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "2",
        listingId: "l1",
        oldPrice: 12,
        newPrice: 8,
        changedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    expect(points.split(" ")).toHaveLength(2);
  });
});
