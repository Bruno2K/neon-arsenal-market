import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/index.js";
import { CS2SH_CATALOG_UPSERT_CHUNK_SIZE } from "../../shared/config/cs2sh.js";
import type { MappedCatalogProduct } from "../../shared/integrations/cs2sh/cs2sh.types.js";

export type CatalogUpsertRow = MappedCatalogProduct & {
  referencePriceUsd: string | null;
};

export type DemoListingUpsertInput = {
  id: string;
  productId: string;
  sellerId: string;
  price: string;
  floatValue: string;
  pattern: number;
  steamAssetId: string;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export const cs2shImportRepository = {
  async upsertCatalog(rows: CatalogUpsertRow[]): Promise<number> {
    let written = 0;
    for (const group of chunk(rows, CS2SH_CATALOG_UPSERT_CHUNK_SIZE)) {
      await prisma.$transaction(
        async (tx) => {
          for (const row of group) {
            await tx.product.upsert({
              where: { marketHashName: row.marketHashName },
              create: {
                game: row.game,
                weapon: row.weapon,
                skinName: row.skinName,
                rarity: row.rarity,
                exterior: row.exterior,
                collection: row.collection,
                imageUrl: row.imageUrl,
                isStattrak: row.isStattrak,
                isSouvenir: row.isSouvenir,
                marketHashName: row.marketHashName,
                referencePriceUsd: row.referencePriceUsd
                  ? new Prisma.Decimal(row.referencePriceUsd)
                  : null,
                cs2ShGenerationId: row.cs2ShGenerationId,
              },
              update: {
                game: row.game,
                weapon: row.weapon,
                skinName: row.skinName,
                rarity: row.rarity,
                exterior: row.exterior,
                collection: row.collection,
                imageUrl: row.imageUrl,
                isStattrak: row.isStattrak,
                isSouvenir: row.isSouvenir,
                referencePriceUsd: row.referencePriceUsd
                  ? new Prisma.Decimal(row.referencePriceUsd)
                  : null,
                cs2ShGenerationId: row.cs2ShGenerationId,
              },
            });
          }
        },
        { timeout: 60_000 }
      );
      written += group.length;
    }
    return written;
  },

  async findIdsByMarketHashNames(names: string[]): Promise<Map<string, string>> {
    if (names.length === 0) return new Map();
    const rows = await prisma.product.findMany({
      where: { marketHashName: { in: names } },
      select: { id: true, marketHashName: true },
    });
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.marketHashName) map.set(row.marketHashName, row.id);
    }
    return map;
  },

  async listApprovedSellerIds(): Promise<string[]> {
    const sellers = await prisma.seller.findMany({
      where: { isApproved: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return sellers.map((seller) => seller.id);
  },

  async upsertDemoListing(input: DemoListingUpsertInput): Promise<void> {
    const price = new Prisma.Decimal(input.price);
    const floatValue = new Prisma.Decimal(input.floatValue);
    await prisma.listing.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        productId: input.productId,
        sellerId: input.sellerId,
        floatValue,
        pattern: input.pattern,
        price,
        currency: "USD",
        status: "ACTIVE",
        steamAssetId: input.steamAssetId,
      },
      // Re-runs refresh catalog price/float; they must not revive SOLD/RESERVED rows.
      update: {
        price,
        floatValue,
        pattern: input.pattern,
      },
    });
  },
};
