import { AppError } from "../../shared/errors/AppError.js";
import { logger } from "../../shared/logger.js";
import {
  getCs2ShDemoListingCount,
  isCs2ShConfigured,
  isCs2ShImportEnabled,
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

export type Cs2ShImportStatus = {
  running: boolean;
  lastResult: Cs2ShImportSummary | null;
};

let inFlight: Promise<Cs2ShImportSummary> | null = null;
let lastResult: Cs2ShImportSummary | null = null;

export function isCs2ShImportRunning(): boolean {
  return inFlight !== null;
}

export function getCs2ShImportStatus(): Cs2ShImportStatus {
  return { running: inFlight !== null, lastResult };
}

export function resetCs2ShImportStateForTests(): void {
  inFlight = null;
  lastResult = null;
}

/**
 * Render has no SSH/shell on the web service. Trigger import after listen
 * (`CS2SH_IMPORT=true`) or via ADMIN POST. Never block `/ready`.
 */
export function scheduleCs2ShBootImport(
  client: Cs2ShClient = createCs2ShClient()
): void {
  if (!isCs2ShImportEnabled()) return;
  if (!isCs2ShConfigured()) {
    logger.info("cs2.sh boot import skipped: CS2SH_API_KEY is not set");
    return;
  }
  const started = tryStartCs2ShCatalogImport(client);
  if (started) {
    logger.info("cs2.sh catalog import scheduled after listen");
  }
}

function beginCs2ShCatalogImport(
  client: Cs2ShClient
): Promise<Cs2ShImportSummary> | null {
  if (inFlight) return null;
  const run = runCs2ShCatalogImport(client);
  inFlight = run.finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function tryStartCs2ShCatalogImport(
  client: Cs2ShClient = createCs2ShClient()
): boolean {
  const run = beginCs2ShCatalogImport(client);
  if (!run) return false;
  void run.catch((err) => {
    logger.error({ err }, "cs2.sh catalog import failed");
  });
  return true;
}

export async function importCs2ShCatalog(
  client: Cs2ShClient = createCs2ShClient()
): Promise<Cs2ShImportSummary> {
  const run = beginCs2ShCatalogImport(client);
  if (!run) {
    throw new AppError(409, "A importação do catálogo cs2.sh já está em andamento");
  }
  return run;
}

async function runCs2ShCatalogImport(client: Cs2ShClient): Promise<Cs2ShImportSummary> {
  if (!isCs2ShConfigured()) {
    logger.info("cs2.sh catalog import skipped: CS2SH_API_KEY is not set");
    const skipped: Cs2ShImportSummary = {
      skipped: true,
      skipReason: "missing_api_key",
      generationId: null,
      productsUpserted: 0,
      schemaSkipped: 0,
      listingsUpserted: 0,
    };
    lastResult = skipped;
    return skipped;
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
  lastResult = summary;
  return summary;
}
