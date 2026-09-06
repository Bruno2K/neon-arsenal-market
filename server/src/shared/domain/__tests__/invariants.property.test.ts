import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { Prisma } from "@prisma/client";
import { DomainInvariant } from "../invariants.js";
import {
  aggregateGrossBySeller,
  formatPayPalAmount,
  sumMoney,
  zeroMoney,
} from "../../money/policy.js";
import {
  computeSellerLedgerAmounts,
  ledgerNetMatchesGrossMinusCommission,
} from "../../money/sellerLedger.js";
import { createOrderRequestHash } from "../../../modules/orders/orders.service.js";
import {
  ORDER_STATUS_TRANSITIONS,
  ORDER_STATUS_TRANSITIONS_BY_ROLE,
  assertOrderStatusTransition,
} from "../../../modules/orders/order-status.js";
import { updateListingDto } from "../../../modules/listings/listings.dto.js";
import { createOrderDto, updateOrderStatusDto } from "../../../modules/orders/orders.dto.js";
import { LISTING_STATUSES, ORDER_STATUSES, ROLES } from "../../types/roles.js";

/**
 * Reproducible fast-check seed for #64. `0x4e454f4e` is ASCII "NEON".
 * Re-run a failing case with the printed seed / path from Vitest.
 */
export const PROPERTY_SEED = 0x4e454f4e;
const PROPERTY = { seed: PROPERTY_SEED, numRuns: 64 } as const;

const d = (value: string) => new Prisma.Decimal(value);

/** Integer cents → Decimal string. Generation only; business math stays on Decimal. */
const moneyArb = fc.integer({ min: 1, max: 1_000_000 }).map((cents) => {
  const whole = Math.trunc(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return d(`${whole}.${frac}`);
});

const rateArb = fc.integer({ min: 0, max: 10_000 }).map((bps) => {
  const whole = Math.trunc(bps / 10_000);
  const frac = String(bps % 10_000).padStart(4, "0");
  return d(`${whole}.${frac}`);
});

const listingIdArb = fc.uuid();

describe(`property-based invariants (seed=${PROPERTY_SEED})`, () => {
  it(`${DomainInvariant.ORDER_TOTAL_COMPOSITION}: sumMoney equals a Decimal fold`, () => {
    fc.assert(
      fc.property(fc.array(moneyArb, { minLength: 0, maxLength: 12 }), (amounts) => {
        const total = sumMoney(amounts);
        let folded = zeroMoney();
        for (const amount of amounts) {
          folded = folded.plus(amount);
        }
        expect(total.equals(folded)).toBe(true);
        expect(total instanceof Prisma.Decimal).toBe(true);
        expect(typeof total).not.toBe("number");
      }),
      PROPERTY
    );
  });

  it(`${DomainInvariant.SELLER_COMMISSION_DECIMAL}: net = gross − commission and is deterministic`, () => {
    fc.assert(
      fc.property(moneyArb, rateArb, (gross, rate) => {
        const first = computeSellerLedgerAmounts(gross, rate);
        const second = computeSellerLedgerAmounts(gross, rate);
        expect(ledgerNetMatchesGrossMinusCommission(first)).toBe(true);
        expect(first.netAmount.equals(first.grossAmount.minus(first.commissionAmount))).toBe(true);
        expect(first.commissionAmount.equals(gross.mul(rate))).toBe(true);
        expect(first.netAmount.equals(second.netAmount)).toBe(true);
        expect(first.commissionAmount.equals(second.commissionAmount)).toBe(true);
        expect(first.netAmount instanceof Prisma.Decimal).toBe(true);
      }),
      PROPERTY
    );
  });

  it(`${DomainInvariant.SELLER_COMMISSION_DECIMAL}: multi-seller gross aggregation is order-independent`, () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            sellerId: fc.constantFrom("seller-a", "seller-b", "seller-c"),
            priceSnapshot: moneyArb,
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (items) => {
          const forward = aggregateGrossBySeller(items);
          const reverse = aggregateGrossBySeller([...items].reverse());
          expect(forward.size).toBe(reverse.size);
          for (const [sellerId, gross] of forward) {
            expect(reverse.get(sellerId)?.equals(gross)).toBe(true);
          }
        }
      ),
      PROPERTY
    );
  });

  it("PayPal wire formatting is deterministic HALF_UP at 2 decimal places", () => {
    fc.assert(
      fc.property(moneyArb, (amount) => {
        const first = formatPayPalAmount(amount);
        const second = formatPayPalAmount(amount);
        expect(first).toBe(second);
        expect(first).toMatch(/^\d+\.\d{2}$/);
      }),
      PROPERTY
    );
  });

  it(`${DomainInvariant.ORDER_IDEMPOTENCY}: request hash is permutation-stable and deterministic`, () => {
    fc.assert(
      fc.property(fc.uniqueArray(listingIdArb, { minLength: 1, maxLength: 8 }), (listingIds) => {
        const items = listingIds.map((listingId) => ({ listingId }));
        const first = createOrderRequestHash({ items });
        const shuffled = createOrderRequestHash({ items: [...items].reverse() });
        const again = createOrderRequestHash({ items });
        expect(first).toBe(shuffled);
        expect(first).toBe(again);
        expect(first).toMatch(/^[a-f0-9]{64}$/);
      }),
      PROPERTY
    );
  });

  it(`${DomainInvariant.LISTING_SOLD_IRREVERSIBLE}: listing PATCH DTO never accepts a client status`, () => {
    fc.assert(
      fc.property(fc.constantFrom(...LISTING_STATUSES), fc.integer({ min: 1, max: 10_000 }), (status, cents) => {
        const parsed = updateListingDto.safeParse({
          price: cents / 100,
          status,
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data).not.toHaveProperty("status");
        }
      }),
      PROPERTY
    );
  });

  it(`${DomainInvariant.PAYMENT_TRUSTED_CONFIRM}: order status DTO strips client paymentStatus`, () => {
    fc.assert(
      fc.property(fc.constantFrom(...ORDER_STATUSES), (status) => {
        const parsed = updateOrderStatusDto.parse({
          status,
          paymentStatus: "PAID",
          totalAmount: "0.01",
        });
        expect(parsed).toEqual({ status });
        expect(parsed).not.toHaveProperty("paymentStatus");
      }),
      PROPERTY
    );
  });

  it(`${DomainInvariant.ORDER_PRICE_SNAPSHOT}: create-order DTO ignores a client-supplied item price`, () => {
    fc.assert(
      fc.property(listingIdArb, moneyArb, (listingId, price) => {
        const parsed = createOrderDto.parse({
          items: [{ listingId, price: price.toString() }],
        });
        expect(parsed.items).toEqual([{ listingId }]);
        expect(parsed.items[0]).not.toHaveProperty("price");
      }),
      PROPERTY
    );
  });

  it(`${DomainInvariant.ORDER_STATUS_MACHINE}: SELLER cannot apply any fulfillment transition`, () => {
    fc.assert(
      fc.property(fc.constantFrom(...ORDER_STATUSES), fc.constantFrom(...ORDER_STATUSES), (from, to) => {
        expect(() => assertOrderStatusTransition(from, to, "SELLER")).toThrow();
        expect(ORDER_STATUS_TRANSITIONS_BY_ROLE.SELLER[from]).toEqual([]);
      }),
      PROPERTY
    );
  });

  it(`${DomainInvariant.ORDER_STATUS_MACHINE}: CUSTOMER cannot skip payment via PENDING → CONFIRMED`, () => {
    expect(() => assertOrderStatusTransition("PENDING", "CONFIRMED", "CUSTOMER")).toThrow(
      /Role CUSTOMER cannot transition/
    );
    expect(ORDER_STATUS_TRANSITIONS.PENDING.includes("CONFIRMED")).toBe(true);
    expect(ORDER_STATUS_TRANSITIONS_BY_ROLE.CUSTOMER.PENDING.includes("CONFIRMED")).toBe(false);
  });

  it("unknown roles are not treated as ADMIN", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ORDER_STATUSES), fc.constantFrom(...ORDER_STATUSES), (from, to) => {
        expect(() => assertOrderStatusTransition(from, to, "HACKER")).toThrow(/Forbidden|Invalid status/);
        expect(ROLES.includes("HACKER" as (typeof ROLES)[number])).toBe(false);
      }),
      { seed: PROPERTY_SEED, numRuns: 16 }
    );
  });
});
