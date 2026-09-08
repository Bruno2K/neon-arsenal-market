import type {
  Cs2ShPriceItem,
  Cs2ShPricesResponse,
  Cs2ShSchemaItem,
  Cs2ShSchemaResponse,
  MappedCatalogProduct,
  ReferenceAsk,
} from "./cs2sh.types.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Catalog reference only. JSON numbers are formatted to 2 dp; no arithmetic.
 * Steam ask first, then CSFloat, then Skinport. No average.
 */
export function selectReferenceAsk(item: Cs2ShPriceItem | undefined): ReferenceAsk | null {
  if (!item) return null;
  const usd =
    formatAskUsd(item.steam?.ask) ??
    formatAskUsd(item.csfloat?.ask) ??
    formatAskUsd(item.skinport?.ask);
  if (!usd || usd === "0.00") return null;
  const volume = finiteNumber(item.steam?.ask_volume);
  return { usd, steamAskVolume: volume !== null && volume > 0 ? volume : 0 };
}

export function formatAskUsd(ask: unknown): string | null {
  if (ask === null || ask === undefined) return null;
  if (typeof ask === "number") {
    if (!Number.isFinite(ask) || ask < 0) return null;
    return ask.toFixed(2);
  }
  if (typeof ask !== "string") return null;
  const trimmed = ask.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const cents = (frac + "00").slice(0, 2);
  return `${whole}.${cents}`;
}

export function isImportableSkin(item: Cs2ShSchemaItem | undefined): item is Cs2ShSchemaItem & {
  market_hash_name: string;
  weapon: string;
  finish: string;
  wear: string;
} {
  if (!item) return false;
  if (item.category !== "skin") return false;
  if (item.is_tradable !== true) return false;
  return (
    isNonEmptyString(item.market_hash_name) &&
    isNonEmptyString(item.weapon) &&
    isNonEmptyString(item.finish) &&
    isNonEmptyString(item.wear)
  );
}

export function mapSchemaItem(
  item: Cs2ShSchemaItem,
  generationId: string | null
): MappedCatalogProduct | null {
  if (!isImportableSkin(item)) return null;
  const rarity = isNonEmptyString(item.rarity?.name) ? item.rarity.name : "Unknown";
  const collection =
    Array.isArray(item.collections) && isNonEmptyString(item.collections[0])
      ? item.collections[0]
      : null;
  const min = finiteNumber(item.wear_float_range?.min);
  const max = finiteNumber(item.wear_float_range?.max);
  return {
    marketHashName: item.market_hash_name,
    game: "CS2",
    weapon: item.weapon,
    skinName: item.finish,
    rarity,
    exterior: item.wear,
    collection,
    imageUrl: isNonEmptyString(item.image) ? item.image : null,
    isStattrak: item.stattrak === true,
    isSouvenir: item.souvenir === true,
    cs2ShGenerationId: generationId,
    wearFloatMin: min,
    wearFloatMax: max,
  };
}

export function mapSchemaCatalog(schema: Cs2ShSchemaResponse): {
  generationId: string | null;
  products: MappedCatalogProduct[];
  skipped: number;
} {
  const generationId = isNonEmptyString(schema.generation_id) ? schema.generation_id : null;
  const items = schema.items ?? {};
  const products: MappedCatalogProduct[] = [];
  let skipped = 0;
  for (const item of Object.values(items)) {
    const mapped = mapSchemaItem(item, generationId);
    if (!mapped) {
      skipped += 1;
      continue;
    }
    products.push(mapped);
  }
  return { generationId, products, skipped };
}

export function attachReferencePrices(
  products: MappedCatalogProduct[],
  prices: Cs2ShPricesResponse
): Map<string, string> {
  const priceItems = prices.items ?? {};
  const byName = new Map<string, string>();
  for (const product of products) {
    const ask = selectReferenceAsk(priceItems[product.marketHashName]);
    if (ask) byName.set(product.marketHashName, ask.usd);
  }
  return byName;
}
