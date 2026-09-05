import { prisma } from "../../shared/database/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import { logger } from "../../shared/logger.js";
import {
  createPayPalOrder,
  getPayPalApprovalLink,
  getPayPalOrder,
} from "../../shared/utils/paypal.js";
import {
  PAYPAL_EVENT_CAPTURE_COMPLETED,
  PAYPAL_EVENT_ORDER_APPROVED,
  parsePayPalWebhookEvent,
} from "../../shared/utils/paypalWebhook.js";
import {
  PAYPAL_RECONCILE_BATCH_SIZE,
  PAYPAL_RECONCILE_MIN_AGE_MS,
} from "../../shared/config/paypal.js";
import { Prisma } from "@prisma/client";
import type { CreatePaymentInput } from "./payments.dto.js";
import { PaymentProvider, type WebhookEventStatus } from "../../shared/types/roles.js";
import { appMetrics } from "../../shared/observability/metrics.js";
import { markSpanOutcome } from "../../shared/observability/outcomes.js";
import { withSpan } from "../../shared/observability/tracing.js";

const WEBHOOK_PROVIDER = PaymentProvider.PAYPAL;

export const paymentsService = {
  async createPaymentLink(userId: string, input: CreatePaymentInput) {
    return withSpan("payments.create_link", {}, async (span) => {
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        include: { items: true, paymentLink: true },
      });
      if (!order) throw new AppError(404, "Order not found");
      if (order.customerId !== userId) throw new AppError(403, "Not your order");
      if (order.paymentStatus === "PAID") throw new AppError(400, "Order already paid");
      if (order.status === "CANCELLED") throw new AppError(400, "Order is cancelled");

      const existing = replayablePaymentLink(order);
      if (existing) {
        markSpanOutcome(span, "idempotency_replay");
        return existing;
      }

      try {
        await prisma.paymentLink.create({
          data: { orderId: order.id, status: "IN_PROGRESS" },
        });
      } catch (err) {
        if (!isPaymentLinkPrimaryKeyError(err)) throw err;
        return replayOrConflictPaymentLink(order.id, span);
      }

      let openedPaypalOrderId: string | undefined;
      try {
        const amount = order.totalAmount.toFixed(2);
        // OrdersCreate is not retried by the PayPal client. This call happens
        // only after a durable PaymentLink claim is inserted.
        const paypalOrder = await createPayPalOrder(amount, "BRL", order.id);
        openedPaypalOrderId = (paypalOrder as { id?: string }).id;
        if (!openedPaypalOrderId) {
          throw new AppError(500, "Failed to create PayPal order");
        }
        const approvalLink =
          getPayPalApprovalLink(
            paypalOrder as { links?: Array<{ href?: string; rel?: string }> }
          ) ?? paypalCheckoutUrl(openedPaypalOrderId);

        await prisma.$transaction(async (tx) => {
          await tx.paymentLink.update({
            where: { orderId: order.id },
            data: {
              status: "COMPLETED",
              paypalOrderId: openedPaypalOrderId,
              approvalUrl: approvalLink,
            },
          });
          await tx.order.update({
            where: { id: order.id },
            data: { paypalOrderId: openedPaypalOrderId },
          });
        });

        markSpanOutcome(span, "created");
        return {
          orderId: order.id,
          paypalOrderId: openedPaypalOrderId,
          approvalUrl: approvalLink,
        };
      } catch (err) {
        if (!openedPaypalOrderId) {
          await prisma.paymentLink.deleteMany({
            where: { orderId: order.id, status: "IN_PROGRESS" },
          });
        }
        throw err;
      }
    });
  },

  async handleWebhook(body: unknown) {
    return withSpan(
      "paypal.webhook.handle",
      { attributes: { "paypal.event_type": "unknown" } },
      async (span) => {
    const parsed = parsePayPalWebhookEvent(body);
    if (!parsed) {
      logger.warn("paypal webhook missing event id or type");
      markSpanOutcome(span, "webhook_failed");
      appMetrics.webhooksReceived();
      appMetrics.webhooksFailed();
      return;
    }

    span.setAttribute("paypal.event_type", parsed.eventType);
    appMetrics.webhooksReceived();
    logger.info(
      { eventId: parsed.eventId, eventType: parsed.eventType },
      "paypal webhook received"
    );

    const claim = await claimWebhookEvent(parsed.eventId, parsed.eventType);
    if (claim === "duplicate") {
      markSpanOutcome(span, "webhook_duplicate");
      appMetrics.webhooksDuplicate();
      logger.info(
        { eventId: parsed.eventId, eventType: parsed.eventType },
        "paypal webhook duplicate ignored"
      );
      return;
    }

    try {
      if (parsed.eventType === PAYPAL_EVENT_CAPTURE_COMPLETED) {
        const orderId = await resolveLocalOrderId(parsed);
        if (!orderId) {
          await markWebhookEvent(parsed.eventId, {
            status: "FAILED",
            failureReason: "order_not_resolved",
          });
          logger.warn(
            { eventId: parsed.eventId, eventType: parsed.eventType },
            "paypal capture webhook could not resolve local order"
          );
          throw new AppError(503, "Local order not ready for capture confirmation");
        }
        await this.confirmPayment(orderId);
        await markWebhookEvent(parsed.eventId, { status: "PROCESSED", orderId });
        markSpanOutcome(span, "confirmed");
        logger.info(
          { eventId: parsed.eventId, eventType: parsed.eventType, orderId },
          "paypal capture webhook processed"
        );
        return;
      }

      if (parsed.eventType === PAYPAL_EVENT_ORDER_APPROVED) {
        const orderId = await resolveLocalOrderId(parsed);
        await markWebhookEvent(parsed.eventId, {
          status: "IGNORED",
          orderId,
          failureReason: "intermediate_event",
        });
        markSpanOutcome(span, "webhook_ignored");
        appMetrics.webhooksIgnored();
        logger.info(
          { eventId: parsed.eventId, eventType: parsed.eventType, orderId },
          "paypal approved webhook stored without capture confirmation"
        );
        return;
      }

      await markWebhookEvent(parsed.eventId, {
        status: "IGNORED",
        failureReason: "unhandled_event_type",
      });
      markSpanOutcome(span, "webhook_ignored");
      appMetrics.webhooksIgnored();
      logger.info(
        { eventId: parsed.eventId, eventType: parsed.eventType },
        "paypal webhook ignored: event type not applied locally"
      );
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 409) {
        await markWebhookEvent(parsed.eventId, {
          status: "FAILED",
          failureReason: "reservation_expired",
        });
        markSpanOutcome(span, "reservation_expired");
        appMetrics.webhooksFailed();
        logger.warn(
          { eventId: parsed.eventId, eventType: parsed.eventType },
          "paypal webhook not applied: reservation expired"
        );
        return;
      }
      if (err instanceof AppError && err.statusCode === 503) {
        appMetrics.webhooksFailed();
        throw err;
      }
      await markWebhookEvent(parsed.eventId, {
        status: "FAILED",
        failureReason: "processing_error",
      });
      appMetrics.webhooksFailed();
      throw err;
    }
      }
    );
  },

  async confirmPayment(orderId: string) {
    return withSpan("payments.confirm", {}, async (span) => {
    let claimedCount = 0;
    try {
    await withSpan("payments.confirm.transaction", {}, async () =>
    prisma.$transaction(async (tx) => {
      // Claim unpaid pending orders only. Duplicate webhooks and cancelled
      // expired orders see count = 0 and do not issue another seller payout.
      const claimed = await tx.order.updateMany({
        where: {
          id: orderId,
          paymentStatus: "PENDING",
          status: "PENDING",
        },
        data: { paymentStatus: "PAID", status: "CONFIRMED" },
      });

      claimedCount = claimed.count;
      if (claimed.count === 0) return;

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new AppError(404, "Order not found");

      const soldAt = new Date();
      const listingIds = order.items.map((item) => item.listingId);
      const sold = await tx.listing.updateMany({
        where: {
          id: { in: listingIds },
          status: "RESERVED",
          reservedByOrderId: orderId,
          reservationExpiresAt: { gt: soldAt },
        },
        data: { status: "SOLD", soldAt },
      });

      // If any listing has expired, was released, or is held by another order,
      // roll back the payment claim. Expiration uses
      // `status = RESERVED AND reservationExpiresAt <= now`. Payment also
      // requires reservedByOrderId = this order so a stale capture cannot sell
      // a later buyer's hold.
      if (sold.count !== listingIds.length) {
        throw new AppError(409, "Reservation expired or listing is no longer reserved");
      }

      const bySeller = new Map<string, { grossAmount: Prisma.Decimal; commissionRate: Prisma.Decimal }>();
      for (const item of order.items) {
        const seller = await tx.seller.findUnique({
          where: { id: item.sellerId },
          select: { commissionRate: true },
        });
        if (!seller) throw new AppError(404, `Seller not found: ${item.sellerId}`);

        const existing = bySeller.get(item.sellerId);
        if (existing) {
          existing.grossAmount = existing.grossAmount.plus(item.priceSnapshot);
        } else {
          bySeller.set(item.sellerId, {
            grossAmount: item.priceSnapshot,
            commissionRate: seller.commissionRate,
          });
        }
      }

      for (const [sellerId, data] of bySeller) {
        const commissionAmount = data.grossAmount.mul(data.commissionRate);
        const netAmount = data.grossAmount.minus(commissionAmount);

        await tx.sellerTransaction.create({
          data: {
            sellerId,
            orderId,
            grossAmount: data.grossAmount,
            commissionAmount,
            netAmount,
            status: "PAID",
          },
        });

        await tx.seller.update({
          where: { id: sellerId },
          data: { balance: { increment: netAmount } },
        });
      }
    })
    );
      if (claimedCount === 0) {
        markSpanOutcome(span, "already_confirmed");
        return;
      }
      markSpanOutcome(span, "confirmed");
      appMetrics.paymentsConfirmed();
    } catch (err) {
      appMetrics.paymentsFailed();
      throw err;
    }
    });
  },

  async reconcilePendingPaypalOrders() {
    return withSpan("payments.reconcile", {}, async (span) => {
    const cutoff = new Date(Date.now() - PAYPAL_RECONCILE_MIN_AGE_MS);
    const pending = await prisma.order.findMany({
      where: {
        paymentStatus: "PENDING",
        status: "PENDING",
        paypalOrderId: { not: null },
        updatedAt: { lte: cutoff },
      },
      take: PAYPAL_RECONCILE_BATCH_SIZE,
      orderBy: { updatedAt: "asc" },
    });

    let confirmed = 0;
    for (const order of pending) {
      if (!order.paypalOrderId) continue;
      try {
        const remote = await getPayPalOrder(order.paypalOrderId);
        if (remote.status === "COMPLETED") {
          await this.confirmPayment(order.id);
          confirmed += 1;
          logger.info({ orderId: order.id }, "paypal reconciliation confirmed captured order");
        }
      } catch (err) {
        if (err instanceof AppError && err.statusCode === 409) {
          logger.warn({ orderId: order.id }, "paypal reconciliation skipped: reservation expired");
          continue;
        }
        logger.warn({ err, orderId: order.id }, "paypal reconciliation lookup failed");
      }
    }
    span.setAttribute("app.reconcile_scanned", pending.length);
    span.setAttribute("app.reconcile_confirmed", confirmed);
    return { scanned: pending.length, confirmed };
    });
  },
};

type PaymentLinkResult = {
  orderId: string;
  paypalOrderId: string;
  approvalUrl: string;
};

function replayablePaymentLink(order: {
  id: string;
  paypalOrderId: string | null;
  paymentLink?: {
    status: string;
    paypalOrderId: string | null;
    approvalUrl: string | null;
  } | null;
}): PaymentLinkResult | null {
  const link = order.paymentLink;
  if (link?.status === "COMPLETED" && link.paypalOrderId && link.approvalUrl) {
    return {
      orderId: order.id,
      paypalOrderId: link.paypalOrderId,
      approvalUrl: link.approvalUrl,
    };
  }
  if (order.paypalOrderId) {
    return {
      orderId: order.id,
      paypalOrderId: order.paypalOrderId,
      approvalUrl: link?.approvalUrl ?? paypalCheckoutUrl(order.paypalOrderId),
    };
  }
  return null;
}

async function replayOrConflictPaymentLink(
  orderId: string,
  span: Parameters<typeof markSpanOutcome>[0]
): Promise<PaymentLinkResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { paymentLink: true },
  });
  if (!order) throw new AppError(404, "Order not found");
  const existing = replayablePaymentLink(order);
  if (existing) {
    markSpanOutcome(span, "idempotency_replay");
    return existing;
  }
  markSpanOutcome(span, "idempotency_conflict");
  throw new AppError(409, "Payment link creation is still in progress for this order");
}

function paypalCheckoutUrl(paypalOrderId: string): string {
  const mode = process.env.PAYPAL_MODE ?? "sandbox";
  const host = mode === "production" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";
  return `${host}/checkoutnow?token=${encodeURIComponent(paypalOrderId)}`;
}

function isPaymentLinkPrimaryKeyError(err: unknown) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  const target = err.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("orderId");
  }
  if (typeof target === "string") {
    return target.includes("PaymentLink_pkey") || target.includes("orderId");
  }
  return false;
}

async function resolveLocalOrderId(parsed: {
  referenceOrderId?: string;
  paypalOrderId?: string;
  resourceId?: string;
}): Promise<string | null> {
  if (parsed.referenceOrderId) {
    const byId = await prisma.order.findUnique({
      where: { id: parsed.referenceOrderId },
      select: { id: true },
    });
    if (byId) return byId.id;
  }

  if (parsed.paypalOrderId) {
    const byPaypal = await prisma.order.findUnique({
      where: { paypalOrderId: parsed.paypalOrderId },
      select: { id: true },
    });
    if (byPaypal) return byPaypal.id;
  }
  return null;
}

async function claimWebhookEvent(
  externalEventId: string,
  eventType: string
): Promise<"claimed" | "duplicate"> {
  try {
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: WEBHOOK_PROVIDER,
        externalEventId,
        eventType,
        status: "RECEIVED",
      },
    });
    return "claimed";
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.paymentWebhookEvent.findUnique({
        where: {
          provider_externalEventId: { provider: WEBHOOK_PROVIDER, externalEventId },
        },
      });
      if (!existing) return "claimed";
      if (existing.status === "PROCESSED" || existing.status === "IGNORED") {
        return "duplicate";
      }
      return "claimed";
    }
    throw err;
  }
}

async function markWebhookEvent(
  externalEventId: string,
  data: { status: WebhookEventStatus; orderId?: string | null; failureReason?: string }
) {
  await prisma.paymentWebhookEvent.update({
    where: {
      provider_externalEventId: { provider: WEBHOOK_PROVIDER, externalEventId },
    },
    data: {
      status: data.status,
      orderId: data.orderId ?? undefined,
      failureReason: data.failureReason,
      processedAt: new Date(),
    },
  });
}
