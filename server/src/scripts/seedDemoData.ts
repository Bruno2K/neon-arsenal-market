import path from "node:path";
import { pathToFileURL } from "node:url";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../shared/database/index.js";
import { hashPassword } from "../shared/utils/hash.js";
import { logger } from "../shared/logger.js";
import {
  DEMO_PRODUCTS,
  DEMO_REVIEWS,
  DEMO_USERS,
  assertDemoCatalog,
  getDemoListings,
  listingId,
  listingPrice,
  type DemoListing,
  type DemoProduct,
  type DemoSellerProfile,
} from "./demoCatalog.js";

export type SeedSummary = {
  users: number;
  sellers: number;
  products: number;
  listings: number;
  reviews: number;
};

const RESERVATION_TTL_MS = 30 * 60 * 1000;

/**
 * Demo re-seed of `Seller.balance` (INV-SELLER-LEDGER-SOURCE).
 *
 * Empty PAID ledger → catalog `"0.00"` so a stale pre-#140 projection
 * (1250.75 / 580.00 / 210.40) cannot survive `update: {}`.
 * Existing PAID rows → SUM(netAmount); seed does not wipe confirm credits
 * and is not a second production writer.
 */
export function projectedDemoSellerBalance(
  catalogBalance: string,
  paidLedgerNet: Prisma.Decimal | null
): Prisma.Decimal {
  if (paidLedgerNet === null) {
    return new Prisma.Decimal(catalogBalance);
  }
  return paidLedgerNet;
}

async function upsertDemoSeller(
  client: PrismaClient,
  userId: string,
  profile: DemoSellerProfile
) {
  return client.$transaction(async (tx) => {
    const existing = await tx.seller.findUnique({ where: { userId } });

    if (!existing) {
      return tx.seller.create({
        data: {
          userId,
          storeName: profile.storeName,
          commissionRate: profile.commissionRate,
          balance: profile.balance,
          isApproved: profile.isApproved,
        },
      });
    }

    // Hold the projection row so confirmPayment's increment cannot land
    // between the PAID SUM read and this write.
    await tx.$queryRaw`SELECT 1 FROM "Seller" WHERE id = ${existing.id} FOR UPDATE`;

    const paid = await tx.sellerTransaction.aggregate({
      where: { sellerId: existing.id, status: "PAID" },
      _sum: { netAmount: true },
    });

    return tx.seller.update({
      where: { id: existing.id },
      data: {
        balance: projectedDemoSellerBalance(profile.balance, paid._sum.netAmount),
      },
    });
  });
}

function listingCreateData(
  listing: DemoListing,
  product: DemoProduct,
  sellerId: string,
  index: number
): Prisma.ListingUncheckedCreateInput {
  const statusFields: Prisma.ListingUncheckedCreateInput = {
    id: listingId(listing),
    productId: product.id,
    sellerId,
    floatValue: listing.floatValue,
    pattern: listing.pattern,
    price: listingPrice(product, listing),
    currency: "USD",
    status: listing.status,
    steamAssetId: `7656119800000${String(index).padStart(4, "0")}`,
  };

  if (listing.status === "RESERVED") {
    const reservedAt = new Date();
    statusFields.reservedAt = reservedAt;
    statusFields.reservationExpiresAt = new Date(reservedAt.getTime() + RESERVATION_TTL_MS);
  }

  if (listing.status === "SOLD") {
    statusFields.soldAt = new Date();
  }

  return statusFields;
}

export async function seedDemoData(client: PrismaClient = prisma): Promise<SeedSummary> {
  assertDemoCatalog();

  const passwordHashes = new Map<string, string>();
  for (const user of DEMO_USERS) {
    if (!passwordHashes.has(user.password)) {
      passwordHashes.set(user.password, await hashPassword(user.password));
    }
  }

  const userIds = new Map<string, string>();
  const sellerIds = new Map<string, string>();

  for (const account of DEMO_USERS) {
    const user = await client.user.upsert({
      where: { email: account.email },
      update: {},
      create: {
        name: account.name,
        email: account.email,
        password: passwordHashes.get(account.password)!,
        role: account.role,
      },
    });
    userIds.set(account.email, user.id);

    if (account.seller) {
      const seller = await upsertDemoSeller(client, user.id, account.seller);
      sellerIds.set(account.email, seller.id);
    }
  }

  for (const product of DEMO_PRODUCTS) {
    await client.product.upsert({
      where: { id: product.id },
      update: {},
      create: {
        id: product.id,
        game: "CS2",
        weapon: product.weapon,
        skinName: product.skinName,
        rarity: product.rarity,
        exterior: product.exterior,
        collection: product.collection ?? null,
        imageUrl: product.imageUrl ?? null,
        isStattrak: product.isStattrak ?? false,
        isSouvenir: product.isSouvenir ?? false,
      },
    });
  }

  const listings = getDemoListings();
  for (let index = 0; index < listings.length; index += 1) {
    const listing = listings[index]!;
    const product = DEMO_PRODUCTS.find((item) => item.id === listing.productId);
    const sellerId = sellerIds.get(listing.sellerEmail);
    if (!product || !sellerId) {
      throw new Error(`Cannot seed listing ${listingId(listing)}`);
    }

    await client.listing.upsert({
      where: { id: listingId(listing) },
      update: {},
      create: listingCreateData(listing, product, sellerId, index),
    });
  }

  let reviewCount = 0;
  for (const review of DEMO_REVIEWS) {
    const userId = userIds.get(review.authorEmail);
    if (!userId) {
      throw new Error(`Cannot seed review for unknown user ${review.authorEmail}`);
    }

    await client.review.upsert({
      where: { productId_userId: { productId: review.productId, userId } },
      update: {},
      create: {
        productId: review.productId,
        userId,
        rating: review.rating,
        comment: review.comment,
      },
    });
    reviewCount += 1;
  }

  const summary: SeedSummary = {
    users: DEMO_USERS.length,
    sellers: sellerIds.size,
    products: DEMO_PRODUCTS.length,
    listings: listings.length,
    reviews: reviewCount,
  };

  logger.info(summary, "demo catalog seed complete");
  return summary;
}

function invokedAsCli(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

async function runCli(): Promise<void> {
  try {
    const summary = await seedDemoData();
    console.log("─────────────────────────────────────────");
    console.log("Demo accounts:");
    for (const account of DEMO_USERS) {
      const extra = account.seller
        ? account.seller.isApproved
          ? "approved seller"
          : "pending seller"
        : account.role.toLowerCase();
      console.log(`  ${account.email} / ${account.password} (${extra})`);
    }
    console.log(
      `\nCatalog: ${summary.products} skins · ${summary.listings} listings · ${summary.reviews} reviews`
    );
    console.log("─────────────────────────────────────────");
  } finally {
    await prisma.$disconnect();
  }
}

if (invokedAsCli()) {
  runCli().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
