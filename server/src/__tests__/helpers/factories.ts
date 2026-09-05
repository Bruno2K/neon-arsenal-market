import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/index.js";
import type { CreateOrderInput } from "../../modules/orders/orders.dto.js";
import { ordersService } from "../../modules/orders/orders.service.js";
import type { ListingStatus, Role } from "../../shared/types/roles.js";

export function uniqueSuffix() {
  return randomUUID();
}

export function orderKey(label: string) {
  return `idem-${label}-${randomUUID()}`;
}

export async function createUser(overrides: {
  name?: string;
  email?: string;
  role?: Role;
} = {}) {
  const suffix = uniqueSuffix();
  return prisma.user.create({
    data: {
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `user-${suffix}@test.local`,
      password: "hash",
      role: overrides.role ?? "CUSTOMER",
    },
  });
}

export async function createSeller(userId?: string) {
  const sellerUserId = userId ?? (await createUser({ name: "Seller", role: "SELLER" })).id;
  return prisma.seller.create({
    data: {
      userId: sellerUserId,
      storeName: `Store ${uniqueSuffix()}`,
      isApproved: true,
      commissionRate: new Prisma.Decimal("0.1"),
    },
  });
}

export async function createProduct(overrides: { skinName?: string } = {}) {
  return prisma.product.create({
    data: {
      game: "CS2",
      weapon: "AK-47",
      skinName: overrides.skinName ?? `Skin ${uniqueSuffix()}`,
      rarity: "Classified",
      exterior: "Field-Tested",
    },
  });
}

export async function createListing(input: {
  productId: string;
  sellerId: string;
  price?: string;
  status?: ListingStatus;
  floatValue?: string;
}) {
  return prisma.listing.create({
    data: {
      productId: input.productId,
      sellerId: input.sellerId,
      floatValue: new Prisma.Decimal(input.floatValue ?? "0.15"),
      price: new Prisma.Decimal(input.price ?? "100.00"),
      status: input.status ?? "ACTIVE",
    },
  });
}

/**
 * Small checkout graph: one customer, one seller, one product, N listings.
 * Extra buyers are created with `createUser` when a test needs them.
 */
export async function createCheckoutGraph(listingCount = 1) {
  const customer = await createUser({ name: "Buyer", role: "CUSTOMER" });
  const sellerUser = await createUser({ name: "Seller", role: "SELLER" });
  const seller = await createSeller(sellerUser.id);
  const product = await createProduct();
  const listings = [];
  for (let index = 0; index < listingCount; index += 1) {
    listings.push(
      await createListing({
        productId: product.id,
        sellerId: seller.id,
        price: `${100 + index}.00`,
        floatValue: `0.${15 + index}`,
      })
    );
  }
  return { customer, sellerUser, seller, product, listings };
}

export function orderInput(listingIds: string[]): CreateOrderInput {
  return { items: listingIds.map((listingId) => ({ listingId })) };
}

export async function createOrder(customerId: string, listingIds: string[], key: string) {
  return ordersService.create(customerId, orderInput(listingIds), key);
}
