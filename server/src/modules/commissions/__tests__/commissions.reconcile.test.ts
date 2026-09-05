import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { DomainInvariant } from "../../../shared/domain/invariants.js";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    seller: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    sellerTransaction: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../commissions.repository.js", () => ({
  commissionsRepository: {
    findMany: vi.fn(),
    findManyBySellerId: vi.fn(),
    getBalance: vi.fn(),
    listProjections: vi.fn(),
    sumPaidNetGrouped: vi.fn(),
    lockSellerForUpdate: vi.fn(),
    sumPaidNetForSeller: vi.fn(),
  },
}));

vi.mock("../../audit/audit.repository.js", () => ({
  auditRepository: {
    create: vi.fn(),
  },
}));

vi.mock("../../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from "../../../shared/database/index.js";
import { commissionsRepository } from "../commissions.repository.js";
import { auditRepository } from "../../audit/audit.repository.js";
import { commissionsService } from "../commissions.service.js";
import { AuditAction, AuditResourceType } from "../../audit/audit.types.js";
import { logger } from "../../../shared/logger.js";

describe(`${DomainInvariant.SELLER_LEDGER_SOURCE} reconcileSellerLedger()`, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) =>
      fn(prisma)
    );
  });

  it("does not write when every projection already matches PAID SUM", async () => {
    vi.mocked(commissionsRepository.listProjections).mockResolvedValue([
      { id: "seller-1", balance: new Prisma.Decimal("90.00") },
    ] as never);
    vi.mocked(commissionsRepository.sumPaidNetGrouped).mockResolvedValue([
      { sellerId: "seller-1", _sum: { netAmount: new Prisma.Decimal("90.00") } },
    ] as never);

    const result = await commissionsService.reconcileSellerLedger();

    expect(result).toEqual({ scanned: 1, driftCandidates: 0, corrected: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.seller.update).not.toHaveBeenCalled();
    expect(auditRepository.create).not.toHaveBeenCalled();
    expect(prisma.sellerTransaction.create).not.toHaveBeenCalled();
    expect(prisma.sellerTransaction.deleteMany).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("sets the projection to PAID SUM once and writes a system audit row", async () => {
    vi.mocked(commissionsRepository.listProjections).mockResolvedValue([
      { id: "seller-1", balance: new Prisma.Decimal("80.00") },
    ] as never);
    vi.mocked(commissionsRepository.sumPaidNetGrouped).mockResolvedValue([
      { sellerId: "seller-1", _sum: { netAmount: new Prisma.Decimal("90.00") } },
    ] as never);
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({
      balance: new Prisma.Decimal("80.00"),
    } as never);
    vi.mocked(commissionsRepository.sumPaidNetForSeller).mockResolvedValue(new Prisma.Decimal("90.00"));
    vi.mocked(prisma.seller.update).mockResolvedValue({} as never);
    vi.mocked(auditRepository.create).mockResolvedValue({} as never);

    const result = await commissionsService.reconcileSellerLedger();

    expect(result.corrected).toBe(1);
    expect(commissionsRepository.lockSellerForUpdate).toHaveBeenCalledWith(prisma, "seller-1");
    const updateArg = vi.mocked(prisma.seller.update).mock.calls[0]?.[0] as {
      where: { id: string };
      data: { balance: Prisma.Decimal };
    };
    expect(updateArg.where).toEqual({ id: "seller-1" });
    expect(updateArg.data.balance.equals(new Prisma.Decimal("90.00"))).toBe(true);
    expect(auditRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        actorRole: null,
        action: AuditAction.SELLER_BALANCE_RECONCILED,
        resourceType: AuditResourceType.Seller,
        resourceId: "seller-1",
      }),
      prisma
    );
    const auditInput = vi.mocked(auditRepository.create).mock.calls[0]?.[0] as unknown as {
      before: { balance: string };
      after: { balance: string };
    };
    expect(new Prisma.Decimal(auditInput.before.balance).equals(new Prisma.Decimal("80"))).toBe(true);
    expect(new Prisma.Decimal(auditInput.after.balance).equals(new Prisma.Decimal("90"))).toBe(true);
    expect(prisma.sellerTransaction.create).not.toHaveBeenCalled();
    expect(prisma.sellerTransaction.deleteMany).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: "seller-1" }),
      "seller ledger projection drifted; corrected to PAID SUM"
    );
  });

  it("is a no-op when the locked re-read is already aligned", async () => {
    vi.mocked(commissionsRepository.listProjections).mockResolvedValue([
      { id: "seller-1", balance: new Prisma.Decimal("80.00") },
    ] as never);
    vi.mocked(commissionsRepository.sumPaidNetGrouped).mockResolvedValue([
      { sellerId: "seller-1", _sum: { netAmount: new Prisma.Decimal("90.00") } },
    ] as never);
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({
      balance: new Prisma.Decimal("90.00"),
    } as never);
    vi.mocked(commissionsRepository.sumPaidNetForSeller).mockResolvedValue(new Prisma.Decimal("90.00"));

    const result = await commissionsService.reconcileSellerLedger();

    expect(result).toEqual({ scanned: 1, driftCandidates: 1, corrected: 0 });
    expect(prisma.seller.update).not.toHaveBeenCalled();
    expect(auditRepository.create).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("corrects a stale non-zero projection when the PAID ledger is empty", async () => {
    vi.mocked(commissionsRepository.listProjections).mockResolvedValue([
      { id: "seller-1", balance: new Prisma.Decimal("1250.75") },
    ] as never);
    vi.mocked(commissionsRepository.sumPaidNetGrouped).mockResolvedValue([]);
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({
      balance: new Prisma.Decimal("1250.75"),
    } as never);
    vi.mocked(commissionsRepository.sumPaidNetForSeller).mockResolvedValue(new Prisma.Decimal(0));
    vi.mocked(prisma.seller.update).mockResolvedValue({} as never);
    vi.mocked(auditRepository.create).mockResolvedValue({} as never);

    const result = await commissionsService.reconcileSellerLedger();

    expect(result.corrected).toBe(1);
    const updateArg = vi.mocked(prisma.seller.update).mock.calls[0]?.[0] as {
      where: { id: string };
      data: { balance: Prisma.Decimal };
    };
    expect(updateArg.where).toEqual({ id: "seller-1" });
    expect(updateArg.data.balance.equals(new Prisma.Decimal(0))).toBe(true);
    const auditInput = vi.mocked(auditRepository.create).mock.calls[0]?.[0] as unknown as {
      before: { balance: string };
      after: { balance: string };
    };
    expect(new Prisma.Decimal(auditInput.before.balance).equals(new Prisma.Decimal("1250.75"))).toBe(
      true
    );
    expect(new Prisma.Decimal(auditInput.after.balance).equals(new Prisma.Decimal(0))).toBe(true);
  });
});
