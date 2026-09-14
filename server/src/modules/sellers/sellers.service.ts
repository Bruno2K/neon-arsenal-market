import { prisma } from "../../shared/database/index.js";
import { sellersRepository } from "./sellers.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ApplySellerInput, UpdateSellerInput } from "./sellers.dto.js";
import { auditRepository } from "../audit/audit.repository.js";
import { AuditAction, AuditResourceType, type AuditActor } from "../audit/audit.types.js";

type SellerWithUser = {
  id: string;
  storeName: string;
  rating: number;
  user: { id: string; name: string } | null;
};

/**
 * AUD-008 (PR11): the only shape a caller with no relationship to the seller may
 * ever see. Excludes email, balance, commissionRate, isApproved, and any other
 * private/configuration field. Do not widen this without a new policy decision.
 */
export type PublicSeller = {
  id: string;
  storeName: string;
  rating: number;
  user: { id: string; name: string } | null;
};

function toPublicSeller(seller: SellerWithUser): PublicSeller {
  return {
    id: seller.id,
    storeName: seller.storeName,
    rating: seller.rating,
    user: seller.user ? { id: seller.user.id, name: seller.user.name } : null,
  };
}

export const sellersService = {
  async list(filters?: { isApproved?: boolean }) {
    return sellersRepository.findMany(filters);
  },

  /**
   * AUD-008 (PR11): public, unauthenticated seller browse. Always approved-only
   * (a client cannot request pending/rejected sellers) and always the narrow
   * public projection. `GET /admin/sellers` is the full-row equivalent for ADMIN.
   */
  async listPublic(): Promise<PublicSeller[]> {
    const sellers = await sellersRepository.findMany({ isApproved: true });
    return sellers.map(toPublicSeller);
  },

  async getById(id: string) {
    const seller = await sellersRepository.findById(id);
    if (!seller) throw new AppError(404, "Seller not found");
    return seller;
  },

  /**
   * AUD-008 (PR11): public, unauthenticated seller detail. A non-approved or
   * missing seller is indistinguishable (404) so the endpoint cannot be used to
   * enumerate pending/rejected sellers.
   */
  async getPublicById(id: string): Promise<PublicSeller> {
    const seller = await sellersRepository.findById(id);
    if (!seller || !seller.isApproved) throw new AppError(404, "Seller not found");
    return toPublicSeller(seller);
  },

  async getByUserId(userId: string) {
    const seller = await sellersRepository.findByUserId(userId);
    if (!seller) throw new AppError(404, "Seller not found");
    return seller;
  },

  async apply(userId: string, input: ApplySellerInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, "User not found");
    if (user.role !== "CUSTOMER" && user.role !== "SELLER")
      throw new AppError(403, "Only customers can apply to become sellers");
    const existing = await sellersRepository.findByUserId(userId);
    if (existing) throw new AppError(409, "Already a seller");
    // commissionRate is deliberately omitted: Prisma applies Seller.commissionRate's
    // database default (0.1). See AUD-005 (PR11) — no caller-controlled write path.
    const seller = await prisma.seller.create({
      data: {
        userId,
        storeName: input.storeName,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { role: "SELLER" },
    });
    return seller;
  },

  async update(sellerId: string, userId: string, role: string, input: UpdateSellerInput) {
    const seller = await sellersRepository.findById(sellerId);
    if (!seller) throw new AppError(404, "Seller not found");
    if (seller.userId !== userId && role !== "ADMIN")
      throw new AppError(403, "Cannot update another seller");
    return sellersRepository.update(sellerId, input);
  },

  async approve(sellerId: string, isApproved: boolean, actor?: AuditActor) {
    const seller = await sellersRepository.findById(sellerId);
    if (!seller) throw new AppError(404, "Seller not found");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.seller.update({
        where: { id: sellerId },
        data: { isApproved },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      await auditRepository.create(
        {
          actorId: actor?.actorId,
          actorRole: actor?.actorRole,
          ip: actor?.ip,
          userAgent: actor?.userAgent,
          action: AuditAction.SELLER_APPROVAL_CHANGED,
          resourceType: AuditResourceType.Seller,
          resourceId: sellerId,
          before: { isApproved: seller.isApproved },
          after: { isApproved },
        },
        tx
      );
      return updated;
    });
  },
};
