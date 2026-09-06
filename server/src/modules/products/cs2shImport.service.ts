import { logger } from "../../shared/logger.js";
import {
  getCs2ShDemoListingCount,
  isCs2ShConfigured,
} from "../../shared/config/cs2sh.js";
import { createCs2ShClient, type Cs2ShClient } from "../../shared/integrations/cs2sh/cs2sh.client.js";
import {
  attachReferencePrices,
  demoListingId,
  rankDemoListingCandidates,
  mapSchemaCatalog,
  syntheticPattern,
} from "../../shared/integrations/cs2sh/cs2sh.mapper.js";
import { cs2shImportRepository } from "./cs2shImport.repository.js";

export type Cs2ShImportSummary = {
  skipped: boolean;
  skipReason?: "missing_api_key";
  generationId: string | null;
  productsUpserted: number;
  schemaSkipped: number;
  listingsUpserted: number;
};

export async function importCs2ShCatalog(
  client: Cs2ShClient = createCs2ShClient()
): Promise<Cs2ShImportSummary> {
  if (!isCs2ShConfigured()) {
    logger.info("cs2.sh catalog import skipped: CS2SH_API_KEY is not set");
    return {
      skipped: true,
      skipReason: "missing_api_key",
      generationId: null,
      productsUpserted: 0,
      schemaSkipped: 0,
      listingsUpserted: 0,
    };
  }

  const schema = await client.fetchSchema();
  const mapped = mapSchemaCatalog(schema);
  const prices = await client.fetchLatestPrices();
  const referenceByName = attachReferencePrices(mapped.products, prices);

  const catalogRows = mapped.products.map((product) => ({
    ...product,
    referencePriceUsd: referenceByName.get(product.marketHashName) ?? null,
  }));

  const productsUpserted = await cs2shImportRepository.upsertCatalog(catalogRows);

  const listingLimit = getCs2ShDemoListingCount();
  const candidates = rankDemoListingCandidates(mapped.products, prices, listingLimit);
  const sellerIds = await cs2shImportRepository.listApprovedSellerIds();

  let listingsUpserted = 0;
  if (sellerIds.length === 0) {
    logger.warn(
      { productCount: productsUpserted },
      "cs2.sh demo listings skipped: no approved sellers"
    );
  } else {
    const productIds = await cs2shImportRepository.findIdsByMarketHashNames(
      candidates.map((candidate) => candidate.marketHashName)
    );
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index]!;
      const productId = productIds.get(candidate.marketHashName);
      if (!productId) continue;
      const sellerId = sellerIds[index % sellerIds.length]!;
      await cs2shImportRepository.upsertDemoListing({
        id: demoListingId(candidate.marketHashName),
        productId,
        sellerId,
        price: candidate.referencePriceUsd,
        floatValue: candidate.floatValue,
        pattern: syntheticPattern(candidate.marketHashName),
        steamAssetId: `cs2sh-${demoListingId(candidate.marketHashName)}`,
      });
      listingsUpserted += 1;
    }
  }

  const summary: Cs2ShImportSummary = {
    skipped: false,
    generationId: mapped.generationId,
    productsUpserted,
    schemaSkipped: mapped.skipped,
    listingsUpserted,
  };
  logger.info(summary, "cs2.sh catalog import complete");
  return summary;
}
