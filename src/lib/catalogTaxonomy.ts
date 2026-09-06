/** Static CS2 weapons aligned to the demo catalog. Not a recommendation engine. */
export const MARKET_WEAPONS = [
  "AK-47",
  "AWP",
  "M4A4",
  "M4A1-S",
  "USP-S",
  "Glock-18",
  "Desert Eagle",
  "Karambit",
  "Talon Knife",
  "Butterfly Knife",
] as const;

export const MARKET_RARITIES = [
  "Consumer Grade",
  "Industrial Grade",
  "Mil-Spec Grade",
  "Restricted",
  "Classified",
  "Covert",
  "Exceedingly Rare",
  "Contraband",
  "Extraordinary",
] as const;

export type MarketWeapon = (typeof MARKET_WEAPONS)[number] | "";
export type MarketRarity = (typeof MARKET_RARITIES)[number] | "";

export const PRODUCT_EXTERIORS = [
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
] as const;
