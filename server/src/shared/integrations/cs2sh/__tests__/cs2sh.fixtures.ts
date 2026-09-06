import type { Cs2ShPricesResponse, Cs2ShSchemaResponse } from "../cs2sh.types.js";

/** Minimal documented-shape fixture. Live cs2.sh is never called from tests. */
export const CS2SH_SCHEMA_FIXTURE: Cs2ShSchemaResponse = {
  generation_id: "gen-test-1",
  items: {
    "USP-S | Printstream (Factory New)": {
      market_hash_name: "USP-S | Printstream (Factory New)",
      category: "skin",
      image: "https://cs2.sh/image/printstream-fn",
      is_tradable: true,
      rarity: { name: "Covert" },
      collections: ["The Recoil Collection"],
      weapon: "USP-S",
      finish: "Printstream",
      wear: "Factory New",
      stattrak: false,
      souvenir: false,
      wear_float_range: { min: 0, max: 0.07 },
    },
    "StatTrak™ AK-47 | Redline (Field-Tested)": {
      market_hash_name: "StatTrak™ AK-47 | Redline (Field-Tested)",
      category: "skin",
      image: "https://cs2.sh/image/redline-st-ft",
      is_tradable: true,
      rarity: { name: "Classified" },
      collections: ["The Huntsman Collection"],
      weapon: "AK-47",
      finish: "Redline",
      wear: "Field-Tested",
      stattrak: true,
      souvenir: false,
      wear_float_range: { min: 0.15, max: 0.38 },
    },
    "M4A4 | Howl (Factory New)": {
      market_hash_name: "M4A4 | Howl (Factory New)",
      category: "skin",
      image: "https://cs2.sh/image/howl-fn",
      is_tradable: true,
      rarity: { name: "Contraband" },
      collections: ["The Huntsman Collection"],
      weapon: "M4A4",
      finish: "Howl",
      wear: "Factory New",
      wear_float_range: { min: 0, max: 0.07 },
    },
    "Recoil Case": {
      market_hash_name: "Recoil Case",
      category: "container",
      image: "https://cs2.sh/image/recoil-case",
      is_tradable: true,
    },
    "AK-47 | Unwearable": {
      market_hash_name: "AK-47 | Unwearable",
      category: "skin",
      image: "https://cs2.sh/image/unwearable",
      is_tradable: true,
      weapon: "AK-47",
      finish: "Unwearable",
    },
  },
};

export const CS2SH_PRICES_FIXTURE: Cs2ShPricesResponse = {
  currency: "USD",
  items: {
    "USP-S | Printstream (Factory New)": {
      market_hash_name: "USP-S | Printstream (Factory New)",
      steam: { ask: 144.99, ask_volume: 75 },
      csfloat: { ask: 95, ask_volume: 241 },
      skinport: { ask: 105.55, ask_volume: 61 },
    },
    "StatTrak™ AK-47 | Redline (Field-Tested)": {
      market_hash_name: "StatTrak™ AK-47 | Redline (Field-Tested)",
      steam: { ask: 65.5, ask_volume: 200 },
      csfloat: { ask: 60, ask_volume: 10 },
    },
    "M4A4 | Howl (Factory New)": {
      market_hash_name: "M4A4 | Howl (Factory New)",
      steam: { ask: null, ask_volume: null },
      csfloat: { ask: null },
      skinport: { ask: "3800.00", ask_volume: 2 },
    },
  },
};

export const CS2SH_PRICES_UPDATED_FIXTURE: Cs2ShPricesResponse = {
  currency: "USD",
  items: {
    ...CS2SH_PRICES_FIXTURE.items,
    "USP-S | Printstream (Factory New)": {
      market_hash_name: "USP-S | Printstream (Factory New)",
      steam: { ask: 150.0, ask_volume: 80 },
      csfloat: { ask: 95, ask_volume: 241 },
    },
  },
};
