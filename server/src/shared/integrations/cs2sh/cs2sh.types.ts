/** Subset of GET /v1/schema used by the catalog import. Extra fields are ignored. */
export type Cs2ShSchemaRarity = {
  name?: string;
};

export type Cs2ShWearFloatRange = {
  min?: number;
  max?: number;
};

export type Cs2ShSchemaItem = {
  market_hash_name?: string;
  category?: string;
  image?: string;
  is_tradable?: boolean;
  rarity?: Cs2ShSchemaRarity;
  collections?: string[];
  weapon?: string;
  finish?: string;
  wear?: string;
  stattrak?: boolean;
  souvenir?: boolean;
  wear_float_range?: Cs2ShWearFloatRange;
};

export type Cs2ShSchemaResponse = {
  generation_id?: string;
  items?: Record<string, Cs2ShSchemaItem>;
};

export type Cs2ShPriceSource = {
  ask?: number | string | null;
  ask_volume?: number | string | null;
};

export type Cs2ShPriceItem = {
  market_hash_name?: string;
  steam?: Cs2ShPriceSource | null;
  csfloat?: Cs2ShPriceSource | null;
  skinport?: Cs2ShPriceSource | null;
};

export type Cs2ShPricesResponse = {
  currency?: string;
  items?: Record<string, Cs2ShPriceItem>;
};

export type MappedCatalogProduct = {
  marketHashName: string;
  game: "CS2";
  weapon: string;
  skinName: string;
  rarity: string;
  exterior: string;
  collection: string | null;
  imageUrl: string | null;
  isStattrak: boolean;
  isSouvenir: boolean;
  cs2ShGenerationId: string | null;
  wearFloatMin: number | null;
  wearFloatMax: number | null;
};

export type ReferenceAsk = {
  usd: string;
  steamAskVolume: number;
};
