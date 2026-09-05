import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Prisma, PrismaClient } from "@prisma/client";
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
} from "./demoCatalog.js";

export type SeedSummary = {
  users: number;
  sellers: number;
  products: number;
  listings: number;
  reviews: number;
};

const RESERVATION_TTL_MS = 30 * 60 * 1000;

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
      const seller = await client.seller.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          storeName: account.seller.storeName,
          commissionRate: account.seller.commissionRate,
          balance: account.seller.balance,
          isApproved: account.seller.isApproved,
        },
      });
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
