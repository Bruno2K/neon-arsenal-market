/**
 * SQL that matches the hot Prisma/raw queries in listings, orders and payments.
 * Used for EXPLAIN ANALYZE so index decisions are tied to executable plans,
 * not guessed from schema comments.
 */
export const PERF_QUERIES = {
  marketActiveCreatedAt: `
    SELECT l.id
    FROM "Listing" l
    WHERE l.status = 'ACTIVE'
    ORDER BY l."createdAt" DESC
    LIMIT 20
  `,
  marketActiveCount: `
    SELECT COUNT(*)::int AS count
    FROM "Listing"
    WHERE status = 'ACTIVE'
  `,
  marketActivePriceRange: `
    SELECT l.id
    FROM "Listing" l
    WHERE l.status = 'ACTIVE'
      AND l.price >= 50
      AND l.price <= 500
    ORDER BY l."createdAt" DESC
    LIMIT 20
  `,
  expireReserved: `
    SELECT l.id
    FROM "Listing" l
    WHERE l.status = 'RESERVED'
      AND (l."reservationExpiresAt" <= NOW() OR l."reservationExpiresAt" IS NULL)
  `,
  sellHeldListing: `
    SELECT l.id
    FROM "Listing" l
    WHERE l.status = 'RESERVED'
      AND l."reservedByOrderId" IS NOT NULL
      AND l."reservationExpiresAt" > NOW()
    LIMIT 20
  `,
  reconcilePendingPaypal: `
    SELECT o.id
    FROM "Order" o
    WHERE o."paymentStatus" = 'PENDING'
      AND o.status = 'PENDING'
      AND o."paypalOrderId" IS NOT NULL
      AND o."updatedAt" <= NOW() - INTERVAL '2 minutes'
    ORDER BY o."updatedAt" ASC
    LIMIT 20
  `,
  idempotencyLookup: `
    SELECT k.id
    FROM "OrderIdempotencyKey" k
    WHERE k."customerId" = $1 AND k.key = $2
  `,
  webhookEventLookup: `
    SELECT e.id
    FROM "PaymentWebhookEvent" e
    WHERE e.provider = 'PAYPAL' AND e."externalEventId" = $1
  `,
  cancelUnpaidWithoutHold: `
    SELECT o.id
    FROM "Order" o
    WHERE o."paymentStatus" = 'PENDING'
      AND o.status = 'PENDING'
      AND EXISTS (
        SELECT 1
        FROM "OrderItem" i
        INNER JOIN "Listing" l ON l.id = i."listingId"
        WHERE i."orderId" = o.id
          AND (l.status <> 'RESERVED' OR l."reservedByOrderId" IS DISTINCT FROM o.id)
      )
  `,
} as const;

export type PerfQueryName = keyof typeof PERF_QUERIES;
