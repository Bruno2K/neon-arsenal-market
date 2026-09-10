import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import { MONEY_PRICE_SCALE } from "../../shared/money/policy.js";
import { computeSellerLedgerCompensation } from "../../shared/money/sellerLedger.js";
import { logger } from "../../shared/logger.js";
import { appMetrics } from "../../shared/observability/metrics.js";
import { withSpan } from "../../shared/observability/tracing.js";
import {
  PAYPAL_REFUND_FAILED_RETRY_MS,
  PAYPAL_REFUND_OPERATOR_AGE_MS,
  PAYPAL_REFUND_PENDING_RETRY_MS,
  PAYPAL_REFUND_PROCESSING_RETRY_MS,
  PAYPAL_REFUND_RECONCILE_BATCH_SIZE,
} from "../../shared/config/paypal.js";
import {
  paypalProvider,
  type PaypalProviderRefund,
  type PaypalRefundStatus,
} from "./paypal-provider.gateway.js";

export type CreateRefundObligationInput = {
  orderId: string;
  providerCaptureId: string;
  amount: Prisma.Decimal;
};

export type RecordProviderConfirmedRefundInput = {
  refundId: string;
  providerRefundId: string;
};

export type RecordProviderRefundObservationInput = RecordProviderConfirmedRefundInput & {
  status: Exclude<PaypalRefundStatus, "COMPLETED">;
};

export type RefundReconciliationResult = {
  scanned: number;
  attempted: number;
  converged: number;
  stillPending: number;
  retryableFailures: number;
  terminalFailures: number;
  operatorRequired: number;
};

export const refundsService = {
  async createObligation(input: CreateRefundObligationInput) {
    if (!input.providerCaptureId.trim()) {
      throw new AppError(400, "Provider capture id is required");
    }
    if (!input.amount.isPositive() || input.amount.decimalPlaces() > MONEY_PRICE_SCALE) {
      throw new AppError(400, "Refund amount must be a positive full BRL amount");
    }

    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, totalAmount: true },
    });
    if (!order) throw new AppError(404, "Order not found");
    if (!order.totalAmount.equals(input.amount)) {
      throw new AppError(409, "Refund obligation must equal the full order amount");
    }

    const refund = await prisma.refund.upsert({
      where: {
        provider_providerCaptureId: {
          provider: "PAYPAL",
          providerCaptureId: input.providerCaptureId,
        },
      },
      create: {
        orderId: input.orderId,
        provider: "PAYPAL",
        providerCaptureId: input.providerCaptureId,
        amount: input.amount,
        reason: "UNFULFILLABLE_CAPTURE",
      },
      update: {},
    });

    if (
      refund.orderId !== input.orderId ||
      !refund.amount.equals(input.amount) ||
      refund.reason !== "UNFULFILLABLE_CAPTURE"
    ) {
      throw new AppError(409, "Provider capture already belongs to another refund obligation");
    }
    return refund;
  },

  /**
   * Persist already-trusted provider completion and its local financial effect.
   * This method performs no provider I/O. Refund state, compensating movements,
   * and Seller.balance projections commit or roll back together.
   */
  async recordProviderConfirmedCompletion(input: RecordProviderConfirmedRefundInput) {
    if (!input.providerRefundId.trim()) {
      throw new AppError(400, "Provider refund id is required");
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.refund.findUnique({ where: { id: input.refundId } });
      if (!existing) throw new AppError(404, "Refund obligation not found");
      if (existing.providerRefundId && existing.providerRefundId !== input.providerRefundId) {
        throw new AppError(409, "Refund already has another provider identity");
      }

      await tx.refund.updateMany({
        where: { id: existing.id, status: { not: "COMPLETED" } },
        data: {
          providerRefundId: input.providerRefundId,
          status: "COMPLETED",
          completedAt: new Date(),
          failureReason: null,
        },
      });

      const resolved = await tx.refund.findUniqueOrThrow({ where: { id: existing.id } });
      if (resolved.providerRefundId !== input.providerRefundId) {
        throw new AppError(409, "Refund is already completed with another provider identity");
      }

      await tx.order.update({
        where: { id: resolved.orderId },
        data: { paymentStatus: "REFUNDED" },
      });
      const compensatedSellers = await appendCompletedRefundCompensation(tx, existing.id);
      return { refund: resolved, compensatedSellers };
    });
  },

  /**
   * Persists a trusted non-completed provider result without allowing stale or
   * out-of-order observations to downgrade an already completed refund.
   */
  async recordProviderObservation(input: RecordProviderRefundObservationInput) {
    if (!input.providerRefundId.trim()) {
      throw new AppError(400, "Provider refund id is required");
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.refund.findUnique({ where: { id: input.refundId } });
      if (!existing) throw new AppError(404, "Refund obligation not found");
      if (existing.providerRefundId && existing.providerRefundId !== input.providerRefundId) {
        throw new AppError(409, "Refund already has another provider identity");
      }
      if (existing.status === "COMPLETED") return existing;

      const failed = input.status === "FAILED" || input.status === "CANCELLED";
      await tx.refund.updateMany({
        where: { id: existing.id, status: { not: "COMPLETED" } },
        data: {
          providerRefundId: input.providerRefundId,
          status: failed ? "FAILED" : "PROCESSING",
          failureReason: failed ? `paypal_refund_${input.status.toLowerCase()}` : null,
        },
      });
      return tx.refund.findUniqueOrThrow({ where: { id: existing.id } });
    });
  },

  /**
   * Claims and performs one idempotent provider attempt. The PostgreSQL claim
   * commits before PayPal I/O. PROCESSING is intentionally replayable because
   * it can mean the provider succeeded before this process persisted the result.
   */
  async executeProviderRefund(refundId: string) {
    await prisma.refund.updateMany({
      where: { id: refundId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PROCESSING", failureReason: null },
    });

    const refund = await prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new AppError(404, "Refund obligation not found");
    if (refund.status === "COMPLETED") {
      return { refund, compensatedSellers: 0, requestId: buildPayPalRefundRequestId(refund.id) };
    }
    if (refund.provider !== "PAYPAL") {
      throw new AppError(409, "Refund provider is not supported");
    }

    const requestId = buildPayPalRefundRequestId(refund.id);
    const providerResult = await paypalProvider.refundCapture(
      refund.providerCaptureId,
      requestId
    );

    if (providerResult.status === "COMPLETED") {
      const completed = await refundsService.recordProviderConfirmedCompletion({
        refundId: refund.id,
        providerRefundId: providerResult.id,
      });
      return { ...completed, requestId };
    }

    const observed = await refundsService.recordProviderObservation({
      refundId: refund.id,
      providerRefundId: providerResult.id,
      status: providerResult.status,
    });
    return { refund: observed, compensatedSellers: 0, requestId };
  },

  /**
   * Reconciles a bounded, persisted-time-selected batch. A conditional updatedAt
   * claim keeps concurrent API replicas from issuing duplicate provider work in
   * the same sweep; PayPal idempotency remains the cross-crash safety boundary.
   */
  async reconcileUnresolvedRefunds(now = new Date()): Promise<RefundReconciliationResult> {
    return withSpan("refund.reconcile.sweep", {}, async (span) => {
      const candidates = await prisma.refund.findMany({
        where: {
          OR: [
            {
              status: "PENDING",
              updatedAt: { lte: new Date(now.getTime() - PAYPAL_REFUND_PENDING_RETRY_MS) },
            },
            {
              status: "PROCESSING",
              updatedAt: { lte: new Date(now.getTime() - PAYPAL_REFUND_PROCESSING_RETRY_MS) },
            },
            {
              status: "FAILED",
              updatedAt: { lte: new Date(now.getTime() - PAYPAL_REFUND_FAILED_RETRY_MS) },
            },
          ],
        },
        orderBy: { updatedAt: "asc" },
        take: PAYPAL_REFUND_RECONCILE_BATCH_SIZE,
      });

      const result: RefundReconciliationResult = {
        scanned: candidates.length,
        attempted: 0,
        converged: 0,
        stillPending: 0,
        retryableFailures: 0,
        terminalFailures: 0,
        operatorRequired: 0,
      };
      appMetrics.refundReconciliationScanned(candidates.length);

      for (const candidate of candidates) {
        const claimed = await prisma.refund.updateMany({
          where: {
            id: candidate.id,
            status: candidate.status,
            updatedAt: candidate.updatedAt,
          },
          data: { updatedAt: now },
        });
        if (claimed.count === 0) continue;

        result.attempted += 1;
        appMetrics.refundReconciliationAttempted();
        const agedOut = now.getTime() - candidate.createdAt.getTime() >= PAYPAL_REFUND_OPERATOR_AGE_MS;

        await withSpan(
          "refund.reconcile",
          {
            attributes: {
              "refund.id": candidate.id,
              "order.id": candidate.orderId,
              "paypal.capture_id": candidate.providerCaptureId,
              "paypal.refund_id": candidate.providerRefundId ?? undefined,
              "refund.status_before": candidate.status,
            },
          },
          async (itemSpan) => {
            try {
              const reconciled = candidate.providerRefundId
                ? await applyProviderObservation(
                    candidate.id,
                    await paypalProvider.getRefund(candidate.providerRefundId)
                  )
                : await refundsService.executeProviderRefund(candidate.id);

              itemSpan.setAttribute("refund.status_after", reconciled.refund.status);
              if (reconciled.refund.status === "COMPLETED") {
                result.converged += 1;
                appMetrics.refundReconciliationConverged();
                logger.info(refundLog(candidate, "COMPLETED", "provider_completed"), "refund reconciliation converged");
                return;
              }
              if (reconciled.refund.status === "FAILED") {
                result.terminalFailures += 1;
                result.operatorRequired += 1;
                appMetrics.refundReconciliationTerminalFailure();
                appMetrics.refundReconciliationOperatorRequired();
                logger.error(refundLog(candidate, "FAILED", reconciled.refund.failureReason ?? "provider_terminal_failure"), "refund reconciliation requires operator investigation");
                return;
              }

              result.stillPending += 1;
              appMetrics.refundReconciliationPending();
              logger.info(refundLog(candidate, reconciled.refund.status, "provider_pending"), "refund reconciliation remains unresolved");
              if (agedOut) {
                result.operatorRequired += 1;
                appMetrics.refundReconciliationOperatorRequired();
                logger.error(refundLog(candidate, reconciled.refund.status, "unresolved_age_threshold"), "refund reconciliation requires operator investigation");
              }
            } catch (err) {
              const reason = paypalProvider.classifyRefundFailure(err);
              await recordRetryableFailure(candidate.id, candidate.status, reason);
              itemSpan.setAttribute("refund.status_after", candidate.status === "FAILED" ? "FAILED" : "PROCESSING");
              itemSpan.setAttribute("refund.reconciliation_reason", reason);
              result.retryableFailures += 1;
              appMetrics.refundReconciliationRetryable();
              logger.warn(refundLog(candidate, candidate.status === "FAILED" ? "FAILED" : "PROCESSING", reason), "refund reconciliation retry deferred");
              if (agedOut) {
                result.operatorRequired += 1;
                appMetrics.refundReconciliationOperatorRequired();
                logger.error(refundLog(candidate, candidate.status, "unresolved_age_threshold"), "refund reconciliation requires operator investigation");
              }
            }
          }
        );
      }

      span.setAttribute("app.refund_reconcile_scanned", result.scanned);
      span.setAttribute("app.refund_reconcile_attempted", result.attempted);
      span.setAttribute("app.refund_reconcile_converged", result.converged);
      return result;
    });
  },
};

async function applyProviderObservation(refundId: string, provider: PaypalProviderRefund) {
  if (provider.status === "COMPLETED") {
    return refundsService.recordProviderConfirmedCompletion({
      refundId,
      providerRefundId: provider.id,
    });
  }
  const refund = await refundsService.recordProviderObservation({
    refundId,
    providerRefundId: provider.id,
    status: provider.status,
  });
  return { refund, compensatedSellers: 0 };
}

async function recordRetryableFailure(
  refundId: string,
  previousStatus: string,
  reason: string
) {
  await prisma.refund.updateMany({
    where: { id: refundId, status: { not: "COMPLETED" } },
    data: {
      status: previousStatus === "FAILED" ? "FAILED" : "PROCESSING",
      failureReason: previousStatus === "FAILED" ? undefined : reason,
    },
  });
}

function refundLog(
  refund: {
    id: string;
    orderId: string;
    providerCaptureId: string;
    providerRefundId: string | null;
    status: string;
  },
  statusAfter: string,
  reason: string
) {
  return {
    refundId: refund.id,
    orderId: refund.orderId,
    providerCaptureId: refund.providerCaptureId,
    providerRefundId: refund.providerRefundId ?? undefined,
    statusBefore: refund.status,
    statusAfter,
    reason,
  };
}

/** Stable 36-character key derived only from the durable local refund identity. */
export function buildPayPalRefundRequestId(refundId: string): string {
  if (!refundId.trim()) throw new AppError(400, "Refund id is required");
  const digest = createHash("sha256")
    .update(`neon-paypal-capture-refund:${refundId}`)
    .digest("hex")
    .slice(0, 32);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`;
}

/**
 * Transaction-scoped compensation primitive for TASK-0014 composition.
 * It refuses every pre-completion state, even if called directly. The caller
 * must transition trusted provider evidence to COMPLETED in this same tx.
 */
export async function appendCompletedRefundCompensation(
  tx: Prisma.TransactionClient,
  refundId: string
): Promise<number> {
  const refund = await tx.refund.findFirst({
    where: { id: refundId, status: "COMPLETED" },
  });
  if (!refund) return 0;

  const credits = await tx.sellerTransaction.findMany({
    where: {
      orderId: refund.orderId,
      entryType: "PAYMENT_CREDIT",
      status: "PAID",
    },
  });

  let applied = 0;
  for (const credit of credits) {
    const amounts = computeSellerLedgerCompensation(credit);
    const inserted = await tx.sellerTransaction.createMany({
      data: [
        {
          sellerId: credit.sellerId,
          orderId: credit.orderId,
          refundId: refund.id,
          entryType: "REFUND_COMPENSATION",
          economicEventId: refund.id,
          ...amounts,
          status: "PAID",
        },
      ],
      skipDuplicates: true,
    });
    if (inserted.count === 0) continue;

    await tx.seller.update({
      where: { id: credit.sellerId },
      data: { balance: { increment: amounts.netAmount } },
    });
    applied += 1;
  }
  return applied;
}
