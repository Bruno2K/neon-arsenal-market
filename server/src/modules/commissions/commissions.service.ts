import { prisma } from "../../shared/database/index.js";
import { commissionsRepository } from "./commissions.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { logger } from "../../shared/logger.js";
import { appMetrics } from "../../shared/observability/metrics.js";
import { withSpan } from "../../shared/observability/tracing.js";
import {
  findSellerProjectionDrifts,
  sellerProjectionMatchesLedger,
} from "../../shared/money/sellerLedger.js";
import { auditRepository } from "../audit/audit.repository.js";
import { AuditAction, AuditResourceType } from "../audit/audit.types.js";
import { systemAuditActor } from "../audit/audit.service.js";
import { computeSellerLedgerCompensation } from "../../shared/money/sellerLedger.js";

export const commissionsService = {
  async listTransactions(userId: string, role: string) {
    if (role === "ADMIN") {
      return commissionsRepository.findMany();
    }
    const seller = await prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new AppError(404, "Seller not found");
    return commissionsRepository.findManyBySellerId(seller.id);
  },

  async getBalance(userId: string) {
    const seller = await prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new AppError(404, "Seller not found");
    const balance = await commissionsRepository.getBalance(seller.id);
    // Projection only (ADR 0011). Pass Prisma Decimal through so JSON.stringify
    // uses Decimal#toJSON (a string), matching listing price / order totalAmount.
    return { balance };
  },

  /**
   * Append one exact inverse movement per credited seller for a durable refund.
   * Unique economic-event identity plus createMany(skipDuplicates) makes
   * retries/concurrency no-ops; the projection changes only when insertion wins.
   */
  async applyRefundCompensation(refundId: string) {
    return prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUnique({ where: { id: refundId } });
      if (!refund) throw new AppError(404, "Refund obligation not found");

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
      return { applied };
    });
  },

  /**
   * INV-SELLER-LEDGER-SOURCE / issue #45
   *
   * Compare `Seller.balance` to `SUM(netAmount) WHERE status = PAID`.
   * On confirmed mismatch: audit + SET the projection to the ledger SUM in
   * one transaction. Never insert/delete SellerTransaction rows.
   * A second run is a no-op when already aligned.
   */
  async reconcileSellerLedger() {
    return withSpan("seller.ledger.reconcile", {}, async (span) => {
      const projections = await commissionsRepository.listProjections();
      const grouped = await commissionsRepository.sumPaidNetGrouped();
      const drifts = findSellerProjectionDrifts(
        projections,
        grouped.map((row) => ({ sellerId: row.sellerId, netAmount: row._sum.netAmount }))
      );

      span.setAttribute("app.reconcile_scanned", projections.length);
      span.setAttribute("app.reconcile_drift_candidates", drifts.length);

      let corrected = 0;
      for (const drift of drifts) {
        const didCorrect = await correctSellerProjectionIfDrifted(drift.sellerId);
        if (didCorrect) corrected += 1;
      }

      span.setAttribute("app.reconcile_corrected", corrected);
      return {
        scanned: projections.length,
        driftCandidates: drifts.length,
        corrected,
      };
    });
  },
};

async function correctSellerProjectionIfDrifted(sellerId: string): Promise<boolean> {
  const result = await prisma.$transaction(async (tx) => {
    await commissionsRepository.lockSellerForUpdate(tx, sellerId);
    const row = await tx.seller.findUnique({
      where: { id: sellerId },
      select: { balance: true },
    });
    if (!row) return null;

    const ledgerSum = await commissionsRepository.sumPaidNetForSeller(tx, sellerId);
    if (sellerProjectionMatchesLedger(row.balance, ledgerSum)) {
      return { corrected: false as const };
    }

    await tx.seller.update({
      where: { id: sellerId },
      data: { balance: ledgerSum },
    });

    await auditRepository.create(
      {
        ...systemAuditActor(),
        action: AuditAction.SELLER_BALANCE_RECONCILED,
        resourceType: AuditResourceType.Seller,
        resourceId: sellerId,
        before: { balance: row.balance.toString() },
        after: { balance: ledgerSum.toString() },
      },
      tx
    );

    return {
      corrected: true as const,
      projected: row.balance.toString(),
      ledgerSum: ledgerSum.toString(),
    };
  });

  if (!result?.corrected) return false;

  appMetrics.sellerLedgerDriftDetected();
  appMetrics.sellerLedgerCorrected();
  logger.warn(
    { sellerId, projected: result.projected, ledgerSum: result.ledgerSum },
    "seller ledger projection drifted; corrected to PAID SUM"
  );
  return true;
}
