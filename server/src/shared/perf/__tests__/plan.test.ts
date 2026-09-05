import { describe, expect, it } from "vitest";
import { flattenPlans, usesIndexAccess, usesSeqScan, type ExplainNode } from "../plan.js";

function node(partial: ExplainNode): ExplainNode {
  return partial;
}

describe("EXPLAIN plan helpers", () => {
  it("detects index access on a nested plan", () => {
    const plan = node({
      "Node Type": "Limit",
      Plans: [
        {
          "Node Type": "Index Scan",
          "Relation Name": "Listing",
          "Index Name": "Listing_status_createdAt_idx",
        },
      ],
    });
    expect(flattenPlans(plan)).toHaveLength(2);
    expect(usesIndexAccess(plan, "Listing")).toBe(true);
    expect(usesSeqScan(plan, "Listing")).toBe(false);
  });

  it("detects sequential scans on the named relation only", () => {
    const plan = node({
      "Node Type": "Nested Loop",
      Plans: [
        { "Node Type": "Seq Scan", "Relation Name": "Listing" },
        { "Node Type": "Index Scan", "Relation Name": "Product", "Index Name": "Product_pkey" },
      ],
    });
    expect(usesSeqScan(plan, "Listing")).toBe(true);
    expect(usesIndexAccess(plan, "Product")).toBe(true);
    expect(usesSeqScan(plan, "Product")).toBe(false);
  });
});
