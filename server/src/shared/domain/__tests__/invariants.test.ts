import { describe, expect, it } from "vitest";
import { DomainInvariant, type DomainInvariantId } from "../invariants.js";

const REQUIRED_ISSUE_43: DomainInvariantId[] = [
  DomainInvariant.LISTING_EXCLUSIVE_RESERVE,
  DomainInvariant.LISTING_SOLD_IRREVERSIBLE,
  DomainInvariant.ORDER_TOTAL_COMPOSITION,
  DomainInvariant.PAYMENT_TRUSTED_CONFIRM,
  DomainInvariant.AUTH_OWNERSHIP,
  DomainInvariant.SELLER_COMMISSION_DECIMAL,
];

describe("DomainInvariant catalog IDs", () => {
  it("uses stable INV-* labels for every exported id", () => {
    for (const id of Object.values(DomainInvariant)) {
      expect(id).toMatch(/^INV-[A-Z0-9]+(?:-[A-Z0-9]+)+$/);
    }
  });

  it("includes the six issue #43 required topics", () => {
    const all = new Set(Object.values(DomainInvariant));
    for (const id of REQUIRED_ISSUE_43) {
      expect(all.has(id)).toBe(true);
    }
  });
});
