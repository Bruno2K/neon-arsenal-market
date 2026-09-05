import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../database/index.js";

export const PERF_SEED = {
  activeListings: 2_500,
  reservedListings: 80,
  soldListings: 80,
  pendingPaypalOrders: 120,
  products: 40,
} as const;

/**
 * Catalog sized so the planner prefers indexes over seq scans for Listing/Order
 * hot paths. Keep this out of the demo seed: integration tests truncate after.
 */
export async function seedPerformanceCatalog() {
  const suffix = randomUUID();
  const customer = await prisma.user.create({
    data: {
      name: "Perf Buyer",
      email: `perf-buyer-${suffix}@test.local`,
      password: "hash",
      role: "CUSTOMER",
    },
  });
  const sellerUser = await prisma.user.create({
    data: {
      name: "Perf Seller",
      email: `perf-seller-${suffix}@test.local`,
      password: "hash",
      role: "SELLER",
    },
  });
  const seller = await prisma.seller.create({
    data: {
      userId: sellerUser.id,
      storeName: `Perf Store ${suffix}`,
      isApproved: true,
      commissionRate: new Prisma.Decimal("0.1"),
    },
  });

  await prisma.product.createMany({
    data: Array.from({ length: PERF_SEED.products }, (_, index) => ({
      game: "CS2",
      weapon: index % 2 === 0 ? "AK-47" : "AWP",
      skinName: `Perf Skin ${index}-${suffix}`,
      rarity: "Classified",
      exterior: index % 3 === 0 ? "Factory New" : "Field-Tested",
      isStattrak: index % 5 === 0,
    })),
  });
  const products = await prisma.product.findMany({ select: { id: true } });

  const listingRows: Prisma.ListingCreateManyInput[] = [
    ...Array.from({ length: PERF_SEED.activeListings }, (_, index) => ({
      productId: products[index % products.length].id,
      sellerId: seller.id,
      floatValue: new Prisma.Decimal(((index % 90) + 1) / 100),
      price: new Prisma.Decimal(50 + (index % 400)),
      status: "ACTIVE",
    })),
    ...Array.from({ length: PERF_SEED.reservedListings }, (_, index) => ({
      productId: products[index % products.length].id,
      sellerId: seller.id,
      floatValue: new Prisma.Decimal("0.12"),
      price: new Prisma.Decimal("120.00"),
      status: "RESERVED",
      reservedAt: new Date(Date.now() - 20 * 60 * 1000),
      reservationExpiresAt: new Date(Date.now() - 5 * 60 * 1000),
    })),
    ...Array.from({ length: PERF_SEED.soldListings }, (_, index) => ({
      productId: products[index % products.length].id,
      sellerId: seller.id,
      floatValue: new Prisma.Decimal("0.08"),
      price: new Prisma.Decimal("200.00"),
      status: "SOLD",
      soldAt: new Date(),
    })),
  ];

  const chunkSize = 500;
  for (let offset = 0; offset < listingRows.length; offset += chunkSize) {
    await prisma.listing.createMany({ data: listingRows.slice(offset, offset + chunkSize) });
  }

  const stale = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.order.createMany({
    data: Array.from({ length: PERF_SEED.pendingPaypalOrders }, (_, index) => ({
      customerId: customer.id,
      totalAmount: new Prisma.Decimal("100.00"),
      status: "PENDING",
      paymentStatus: "PENDING",
      paypalOrderId: `PAYPAL-PERF-${suffix}-${index}`,
      updatedAt: stale,
    })),
  });

  await prisma.$executeRaw`ANALYZE "Listing"`;
  await prisma.$executeRaw`ANALYZE "Order"`;
  await prisma.$executeRaw`ANALYZE "OrderItem"`;
  await prisma.$executeRaw`ANALYZE "OrderIdempotencyKey"`;
  await prisma.$executeRaw`ANALYZE "PaymentWebhookEvent"`;

  return { customer, seller, products };
}
