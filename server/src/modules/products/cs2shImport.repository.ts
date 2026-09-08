import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/index.js";
import { CS2SH_CATALOG_UPSERT_CHUNK_SIZE } from "../../shared/config/cs2sh.js";
import type { MappedCatalogProduct } from "../../shared/integrations/cs2sh/cs2sh.types.js";

export type CatalogUpsertRow = MappedCatalogProduct & {
  referencePriceUsd: string | null;
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
};
