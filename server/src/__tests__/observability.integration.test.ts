import { randomUUID } from "node:crypto";
import { SpanStatusCode } from "@opentelemetry/api";
import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "../shared/database/index.js";
import { listingsService } from "../modules/listings/listings.service.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import {
  collectMetrics,
  collectSpans,
  resetTestTelemetry,
  shutdownTelemetry,
  spanOutcomes,
  spansNamed,
  sumMetric,
  telemetryContainsSensitive,
  useTestTelemetry,
} from "../shared/observability/test.js";
import { createCheckoutGraph, createOrder, createUser, orderKey } from "./helpers/index.js";

function captureEvent(eventId: string, localOrderId: string) {
  return {
    id: eventId,
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: `CAPTURE-${eventId}`,
      purchase_units: [{ reference_id: localOrderId }],
    },
  };
}

function approvedEvent(eventId: string, localOrderId: string) {
  return {
    id: eventId,
    event_type: "CHECKOUT.ORDER.APPROVED",
    resource: {
      id: `PAYPAL-${localOrderId}`,
      purchase_units: [{ reference_id: localOrderId }],
    },
  };
}

describe("critical-flow telemetry (postgres)", () => {
  beforeAll(async () => {
    await useTestTelemetry();
  });

  afterAll(async () => {
    await shutdownTelemetry();
  });

  beforeEach(async () => {
    await resetTestTelemetry();
  });

  it("records order creation spans and metrics, including database work", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("otel-create"));

    expect(created.id).toBeTruthy();
    const spans = await collectSpans();
    expect(spansNamed(spans, "orders.create").length).toBeGreaterThanOrEqual(1);
    expect(spansNamed(spans, "orders.create.transaction").length).toBeGreaterThanOrEqual(1);
    expect(spansNamed(spans, "listings.reserve").length).toBeGreaterThanOrEqual(1);
    expect(spansNamed(spans, "db.prisma").length).toBeGreaterThan(0);
    expect(spanOutcomes(spans, "orders.create")).toContain("created");
    expect(spansNamed(spans, "db.prisma")[0]?.attributes["db.system"]).toBe("postgresql");
    expect(spansNamed(spans, "db.prisma")[0]?.attributes["db.statement"]).toBeUndefined();

    const metrics = await collectMetrics();
    expect(sumMetric(metrics, "orders.created")).toBeGreaterThanOrEqual(1);
    expect(sumMetric(metrics, "reservations.created")).toBeGreaterThanOrEqual(1);
    expect(sumMetric(metrics, "db.client.operation.duration")).toBeGreaterThan(0);
    expect(telemetryContainsSensitive(spans, metrics)).toBe(false);
  });

  it("distinguishes idempotency replay from a conflicting key reuse", async () => {
    const fixture = await createCheckoutGraph(2);
    const key = orderKey("otel-replay");
    const first = await createOrder(fixture.customer.id, [fixture.listings[0].id], key);
    const replay = await createOrder(fixture.customer.id, [fixture.listings[0].id], key);
    expect(replay.id).toBe(first.id);

    await expect(createOrder(fixture.customer.id, [fixture.listings[1].id], key)).rejects.toMatchObject({
      statusCode: 409,
    });

    const spans = await collectSpans();
    expect(spanOutcomes(spans, "orders.create")).toEqual(
      expect.arrayContaining(["created", "idempotency_replay", "idempotency_conflict"])
    );
    const conflict = spansNamed(spans, "orders.create").find(
      (span) => span.attributes["app.outcome"] === "idempotency_conflict"
    );
    expect(conflict?.status.code).toBe(SpanStatusCode.UNSET);

    const metrics = await collectMetrics();
    expect(sumMetric(metrics, "orders.idempotency_replay")).toBeGreaterThanOrEqual(1);
    expect(sumMetric(metrics, "orders.idempotency_conflict")).toBeGreaterThanOrEqual(1);
    const listing = await prisma.listing.findUnique({ where: { id: fixture.listings[1].id } });
    expect(listing?.status).toBe("ACTIVE");
  });

  it("records reservation success, conflict and expiration as distinct outcomes", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const otherBuyer = await createUser({ name: "Otel Buyer 2" });

    const results = await Promise.allSettled([
      createOrder(fixture.customer.id, [listingId], orderKey("otel-reserve-a")),
      createOrder(otherBuyer.id, [listingId], orderKey("otel-reserve-b")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const reserved = await prisma.listing.findUnique({ where: { id: listingId } });
    await prisma.listing.update({
      where: { id: listingId },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await listingsService.expireReservations();
    expect(expired.expiredListingCount).toBeGreaterThanOrEqual(1);

    const spans = await collectSpans();
    expect(spanOutcomes(spans, "orders.create")).toEqual(
      expect.arrayContaining(["created", "reservation_conflict"])
    );
    expect(spansNamed(spans, "listings.expire").length).toBeGreaterThanOrEqual(1);

    const metrics = await collectMetrics();
    expect(sumMetric(metrics, "reservations.created")).toBeGreaterThanOrEqual(1);
    expect(sumMetric(metrics, "reservations.conflict")).toBeGreaterThanOrEqual(1);
    expect(sumMetric(metrics, "reservations.expired")).toBeGreaterThanOrEqual(1);
    expect(reserved?.status).toBe("RESERVED");
  });

  it("records payment confirmation, failure and duplicate webhook outcomes", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("otel-pay"));
    const eventId = `WH-${randomUUID()}`;

    await paymentsService.handleWebhook(approvedEvent(`WH-approved-${randomUUID()}`, order.id));
    await paymentsService.handleWebhook(captureEvent(eventId, order.id));
    await paymentsService.handleWebhook(captureEvent(eventId, order.id));

    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    expect(paid?.paymentStatus).toBe("PAID");

    const expiredFixture = await createCheckoutGraph();
    const expiredOrder = await createOrder(
      expiredFixture.customer.id,
      [expiredFixture.listings[0].id],
      orderKey("otel-pay-fail")
    );
    await prisma.listing.update({
      where: { id: expiredFixture.listings[0].id },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });
    await paymentsService.handleWebhook(
      captureEvent(`WH-expired-${randomUUID()}`, expiredOrder.id)
    );

    const spans = await collectSpans();
    expect(spansNamed(spans, "paypal.webhook.handle").length).toBeGreaterThanOrEqual(3);
    expect(spansNamed(spans, "payments.confirm").length).toBeGreaterThanOrEqual(1);
    expect(spansNamed(spans, "payments.confirm.transaction").length).toBeGreaterThanOrEqual(1);
    expect(spanOutcomes(spans, "paypal.webhook.handle")).toEqual(
      expect.arrayContaining(["webhook_ignored", "confirmed", "webhook_duplicate", "reservation_expired"])
    );

    const metrics = await collectMetrics();
    expect(sumMetric(metrics, "payments.confirmed")).toBeGreaterThanOrEqual(1);
    expect(sumMetric(metrics, "payments.failed")).toBeGreaterThanOrEqual(1);
    expect(sumMetric(metrics, "paypal.webhooks.received")).toBeGreaterThanOrEqual(4);
    expect(sumMetric(metrics, "paypal.webhooks.duplicate")).toBeGreaterThanOrEqual(1);
    expect(sumMetric(metrics, "paypal.webhooks.ignored")).toBeGreaterThanOrEqual(1);
    expect(sumMetric(metrics, "paypal.webhooks.failed")).toBeGreaterThanOrEqual(1);
    expect(telemetryContainsSensitive(spans, metrics)).toBe(false);
  });
});
