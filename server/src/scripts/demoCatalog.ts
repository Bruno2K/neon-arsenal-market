export const DEMO_LISTING_STATUSES = ["ACTIVE", "RESERVED", "SOLD", "CANCELED"] as const;
export type DemoListingStatus = (typeof DEMO_LISTING_STATUSES)[number];

export type DemoSellerProfile = {
  storeName: string;
  commissionRate: string;
  balance: string;
  isApproved: boolean;
};

export type DemoUser = {
  email: string;
  password: string;
  name: string;
  role: "ADMIN" | "SELLER" | "CUSTOMER";
  seller?: DemoSellerProfile;
};

export type DemoProduct = {
  id: string;
  weapon: string;
  skinName: string;
  rarity: string;
  exterior: string;
  collection?: string;
  isStattrak?: boolean;
  isSouvenir?: boolean;
  imageUrl?: string;
  price: string;
};

export type DemoListing = {
  productId: string;
  sellerEmail: string;
  floatValue: number;
  pattern: number;
  priceOffset: string;
  status: DemoListingStatus;
};

export type DemoReview = {
  productId: string;
  authorEmail: string;
  rating: number;
  comment: string;
};

export const DEMO_USERS: DemoUser[] = [
  { email: "admin@skinmarket.gg", password: "admin123", name: "Admin", role: "ADMIN" },
  {
    email: "seller@skinmarket.gg",
    password: "seller123",
    name: "NeonTrader",
    role: "SELLER",
    seller: { storeName: "NeonTrader Store", commissionRate: "0.10", balance: "1250.75", isApproved: true },
  },
  {
    email: "pro_trader@skinmarket.gg",
    password: "seller456",
    name: "ProTrader",
    role: "SELLER",
    seller: { storeName: "ProTrader CS2", commissionRate: "0.08", balance: "580.00", isApproved: true },
  },
  {
    email: "rustking@skinmarket.gg",
    password: "seller123",
    name: "RustKing",
    role: "SELLER",
    seller: { storeName: "RustKing Trades", commissionRate: "0.10", balance: "210.40", isApproved: true },
  },
  {
    email: "pending_seller@skinmarket.gg",
    password: "seller123",
    name: "NewVendor",
    role: "SELLER",
    seller: { storeName: "NewVendor Shop", commissionRate: "0.10", balance: "0.00", isApproved: false },
  },
  { email: "buyer@skinmarket.gg", password: "buyer123", name: "Player One", role: "CUSTOMER" },
  { email: "collector@skinmarket.gg", password: "buyer123", name: "Skin Collector", role: "CUSTOMER" },
  { email: "casual@skinmarket.gg", password: "buyer123", name: "Casual Buyer", role: "CUSTOMER" },
];

export const DEMO_PRODUCTS: DemoProduct[] = [
  { id: "ak-redline-ft", weapon: "AK-47", skinName: "Redline", rarity: "Classified", exterior: "Field-Tested", collection: "The Huntsman Collection", price: "18.50", imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_ak47_gs_ak47_redline_light.7f09c5ae6eadeba18830c6600ed60ee04a2aa74b.png" },
  { id: "ak-redline-st-ft", weapon: "AK-47", skinName: "Redline", rarity: "Classified", exterior: "Field-Tested", collection: "The Huntsman Collection", isStattrak: true, price: "65.00", imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_ak47_gs_ak47_redline_light.7f09c5ae6eadeba18830c6600ed60ee04a2aa74b.png" },
  { id: "ak-asiimov-mw", weapon: "AK-47", skinName: "Asiimov", rarity: "Covert", exterior: "Minimal Wear", collection: "Operation Wildfire Case", price: "320.00" },
  { id: "ak-vulcan-fn", weapon: "AK-47", skinName: "Vulcan", rarity: "Covert", exterior: "Factory New", collection: "Operation Bravo Case", price: "145.00" },
  { id: "ak-fire-serpent-mw", weapon: "AK-47", skinName: "Fire Serpent", rarity: "Covert", exterior: "Minimal Wear", collection: "Operation Bravo Case", price: "2100.00" },
  { id: "ak-case-hardened-fn", weapon: "AK-47", skinName: "Case Hardened", rarity: "Classified", exterior: "Factory New", collection: "Arms Deal Collection", price: "280.00" },
  { id: "ak-neon-rider-ft", weapon: "AK-47", skinName: "Neon Rider", rarity: "Covert", exterior: "Field-Tested", collection: "Horizon Case", price: "42.00" },
  { id: "awp-asiimov-ft", weapon: "AWP", skinName: "Asiimov", rarity: "Covert", exterior: "Field-Tested", collection: "The Cache Collection", price: "110.00" },
  { id: "awp-dragon-lore-fn", weapon: "AWP", skinName: "Dragon Lore", rarity: "Covert", exterior: "Factory New", collection: "The Cobblestone Collection", price: "3200.00" },
  { id: "awp-lightning-fn", weapon: "AWP", skinName: "Lightning Strike", rarity: "Covert", exterior: "Factory New", collection: "Arms Deal Collection", price: "480.00" },
  { id: "awp-medusa-fn", weapon: "AWP", skinName: "Medusa", rarity: "Covert", exterior: "Factory New", collection: "The Gods and Monsters Collection", price: "4500.00" },
  { id: "awp-hyper-beast-ft", weapon: "AWP", skinName: "Hyper Beast", rarity: "Covert", exterior: "Field-Tested", collection: "Operation Wildfire Case", price: "38.00" },
  { id: "awp-printstream-mw", weapon: "AWP", skinName: "Printstream", rarity: "Covert", exterior: "Minimal Wear", collection: "Fracture Case", price: "95.00" },
  { id: "m4a4-howl-fn", weapon: "M4A4", skinName: "Howl", rarity: "Contraband", exterior: "Factory New", collection: "The Huntsman Collection", price: "3800.00" },
  { id: "m4a4-asiimov-fn", weapon: "M4A4", skinName: "Asiimov", rarity: "Covert", exterior: "Factory New", collection: "Operation Phoenix Case", price: "220.00" },
  { id: "m4a4-dragon-king-mw", weapon: "M4A4", skinName: "Dragon King", rarity: "Classified", exterior: "Minimal Wear", collection: "The Clutch Collection", isStattrak: true, price: "42.00" },
  { id: "m4a4-temukau-fn", weapon: "M4A4", skinName: "Temukau", rarity: "Covert", exterior: "Factory New", collection: "Revolution Case", price: "88.00" },
  { id: "m4a1s-hot-rod-fn", weapon: "M4A1-S", skinName: "Hot Rod", rarity: "Classified", exterior: "Factory New", collection: "The Chop Shop Collection", price: "310.00" },
  { id: "m4a1s-hyper-beast-mw", weapon: "M4A1-S", skinName: "Hyper Beast", rarity: "Covert", exterior: "Minimal Wear", collection: "Falchion Case", price: "65.00" },
  { id: "m4a1s-printstream-fn", weapon: "M4A1-S", skinName: "Printstream", rarity: "Covert", exterior: "Factory New", collection: "Operation Broken Fang Case", price: "410.00" },
  { id: "m4a1s-blue-phosphor-fn", weapon: "M4A1-S", skinName: "Blue Phosphor", rarity: "Classified", exterior: "Factory New", collection: "Control Collection", price: "175.00" },
  { id: "glock-fade-fn", weapon: "Glock-18", skinName: "Fade", rarity: "Restricted", exterior: "Factory New", collection: "Assault Collection", price: "380.00" },
  { id: "glock-water-elem-fn", weapon: "Glock-18", skinName: "Water Elemental", rarity: "Classified", exterior: "Factory New", collection: "Breakout Case", price: "12.50" },
  { id: "glock-gamma-doppler-fn", weapon: "Glock-18", skinName: "Gamma Doppler", rarity: "Covert", exterior: "Factory New", collection: "Operation Riptide Case", price: "95.00" },
  { id: "usps-kill-confirmed-mw", weapon: "USP-S", skinName: "Kill Confirmed", rarity: "Covert", exterior: "Minimal Wear", collection: "Shadow Case", price: "85.00" },
  { id: "usp-orion-fn", weapon: "USP-S", skinName: "Orion", rarity: "Classified", exterior: "Factory New", collection: "Huntsman Collection", price: "48.00" },
  { id: "usp-printstream-mw", weapon: "USP-S", skinName: "Printstream", rarity: "Covert", exterior: "Minimal Wear", collection: "Fracture Case", price: "62.00" },
  { id: "deagle-blaze-fn", weapon: "Desert Eagle", skinName: "Blaze", rarity: "Restricted", exterior: "Factory New", collection: "Dust 2 Collection", price: "195.00" },
  { id: "deagle-code-red-fn", weapon: "Desert Eagle", skinName: "Code Red", rarity: "Covert", exterior: "Factory New", collection: "Horizon Case", price: "125.00" },
  { id: "deagle-printstream-fn", weapon: "Desert Eagle", skinName: "Printstream", rarity: "Covert", exterior: "Factory New", collection: "Fracture Case", price: "86.00" },
  { id: "deagle-heat-treated-mw", weapon: "Desert Eagle", skinName: "Heat Treated", rarity: "Classified", exterior: "Minimal Wear", collection: "Graphic Design Collection", price: "34.00" },
  { id: "mp9-starlight-fn", weapon: "MP9", skinName: "Starlight Protector", rarity: "Covert", exterior: "Factory New", collection: "Operation Riptide Case", isStattrak: true, price: "22.00" },
  { id: "ump-primal-saber-mw", weapon: "UMP-45", skinName: "Primal Saber", rarity: "Classified", exterior: "Minimal Wear", collection: "Chroma 3 Case", price: "9.50" },
  { id: "mac10-neon-rider-ft", weapon: "MAC-10", skinName: "Neon Rider", rarity: "Classified", exterior: "Field-Tested", collection: "Chroma 2 Case", price: "7.25" },
  { id: "p250-see-ya-later-fn", weapon: "P250", skinName: "See Ya Later", rarity: "Covert", exterior: "Factory New", collection: "Spectrum 2 Case", price: "28.00" },
  { id: "tec9-fuel-injector-mw", weapon: "Tec-9", skinName: "Fuel Injector", rarity: "Classified", exterior: "Minimal Wear", collection: "Gamma Case", price: "14.00" },
  { id: "five-seven-hyper-beast-ft", weapon: "Five-SeveN", skinName: "Hyper Beast", rarity: "Covert", exterior: "Field-Tested", collection: "Gamma 2 Case", price: "16.50" },
  { id: "sg553-integrale-fn", weapon: "SG 553", skinName: "Integrale", rarity: "Classified", exterior: "Factory New", collection: "Prisma 2 Case", price: "28.00" },
  { id: "karambit-fade-fn", weapon: "Karambit", skinName: "Fade", rarity: "Covert", exterior: "Factory New", collection: "CS:GO Weapon Case", price: "950.00" },
  { id: "butterfly-crimson-fn", weapon: "Butterfly Knife", skinName: "Crimson Web", rarity: "Covert", exterior: "Factory New", collection: "Operation Breakout Case", price: "780.00" },
  { id: "bayonet-doppler-fn", weapon: "Bayonet", skinName: "Doppler", rarity: "Covert", exterior: "Factory New", collection: "Chroma Case", price: "620.00" },
  { id: "huntsman-fade-fn", weapon: "Huntsman Knife", skinName: "Fade", rarity: "Covert", exterior: "Factory New", collection: "Huntsman Collection", price: "410.00" },
  { id: "talon-marble-fade-fn", weapon: "Talon Knife", skinName: "Marble Fade", rarity: "Covert", exterior: "Factory New", collection: "Horizon Case", price: "720.00" },
  { id: "sport-gloves-pandora-ft", weapon: "Sport Gloves", skinName: "Pandora's Box", rarity: "Extraordinary", exterior: "Field-Tested", collection: "Glove Case", price: "1850.00" },
];

const APPROVED_SELLER_EMAILS = DEMO_USERS.filter((user) => user.seller?.isApproved).map((user) => user.email);

const LEGACY_LISTINGS: DemoListing[] = [
  { productId: "ak-redline-ft", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.2502, pattern: 123, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "ak-redline-ft", sellerEmail: "seller@skinmarket.gg", floatValue: 0.181, pattern: 456, priceOffset: "3.50", status: "ACTIVE" },
  { productId: "ak-redline-ft", sellerEmail: "seller@skinmarket.gg", floatValue: 0.3301, pattern: 789, priceOffset: "-1.00", status: "ACTIVE" },
  { productId: "ak-redline-st-ft", sellerEmail: "seller@skinmarket.gg", floatValue: 0.21, pattern: 321, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "ak-redline-st-ft", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.153, pattern: 654, priceOffset: "5.00", status: "ACTIVE" },
  { productId: "ak-asiimov-mw", sellerEmail: "seller@skinmarket.gg", floatValue: 0.0855, pattern: 200, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "ak-asiimov-mw", sellerEmail: "rustking@skinmarket.gg", floatValue: 0.12, pattern: 201, priceOffset: "-15.00", status: "ACTIVE" },
  { productId: "ak-vulcan-fn", sellerEmail: "seller@skinmarket.gg", floatValue: 0.0062, pattern: 400, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "ak-vulcan-fn", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.031, pattern: 401, priceOffset: "-10.00", status: "ACTIVE" },
  { productId: "awp-asiimov-ft", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.32, pattern: 500, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "awp-asiimov-ft", sellerEmail: "seller@skinmarket.gg", floatValue: 0.28, pattern: 501, priceOffset: "8.00", status: "ACTIVE" },
  { productId: "awp-dragon-lore-fn", sellerEmail: "seller@skinmarket.gg", floatValue: 0.0089, pattern: 600, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "awp-lightning-fn", sellerEmail: "rustking@skinmarket.gg", floatValue: 0.0032, pattern: 700, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "m4a4-howl-fn", sellerEmail: "seller@skinmarket.gg", floatValue: 0.021, pattern: 800, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "m4a4-asiimov-fn", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.0075, pattern: 900, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "m4a4-asiimov-fn", sellerEmail: "seller@skinmarket.gg", floatValue: 0.035, pattern: 901, priceOffset: "-20.00", status: "ACTIVE" },
  { productId: "m4a4-dragon-king-mw", sellerEmail: "seller@skinmarket.gg", floatValue: 0.12, pattern: 321, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "m4a4-dragon-king-mw", sellerEmail: "rustking@skinmarket.gg", floatValue: 0.075, pattern: 322, priceOffset: "4.00", status: "ACTIVE" },
  { productId: "m4a1s-hot-rod-fn", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.009, pattern: 1001, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "m4a1s-hyper-beast-mw", sellerEmail: "seller@skinmarket.gg", floatValue: 0.098, pattern: 1100, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "m4a1s-hyper-beast-mw", sellerEmail: "seller@skinmarket.gg", floatValue: 0.14, pattern: 1101, priceOffset: "-5.00", status: "ACTIVE" },
  { productId: "glock-fade-fn", sellerEmail: "rustking@skinmarket.gg", floatValue: 0.015, pattern: 1200, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "glock-fade-fn", sellerEmail: "seller@skinmarket.gg", floatValue: 0.007, pattern: 1201, priceOffset: "25.00", status: "ACTIVE" },
  { productId: "glock-water-elem-fn", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.0012, pattern: 1300, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "usps-kill-confirmed-mw", sellerEmail: "seller@skinmarket.gg", floatValue: 0.08, pattern: 1400, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "usps-kill-confirmed-mw", sellerEmail: "rustking@skinmarket.gg", floatValue: 0.12, pattern: 1401, priceOffset: "-8.00", status: "ACTIVE" },
  { productId: "deagle-blaze-fn", sellerEmail: "seller@skinmarket.gg", floatValue: 0.005, pattern: 1500, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "deagle-code-red-fn", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.0025, pattern: 1600, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "deagle-code-red-fn", sellerEmail: "seller@skinmarket.gg", floatValue: 0.038, pattern: 1601, priceOffset: "-12.00", status: "ACTIVE" },
  { productId: "karambit-fade-fn", sellerEmail: "seller@skinmarket.gg", floatValue: 0.003, pattern: 1700, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "karambit-fade-fn", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.018, pattern: 1701, priceOffset: "-50.00", status: "ACTIVE" },
  { productId: "butterfly-crimson-fn", sellerEmail: "rustking@skinmarket.gg", floatValue: 0.0055, pattern: 1800, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "sg553-integrale-fn", sellerEmail: "seller@skinmarket.gg", floatValue: 0.021, pattern: 1900, priceOffset: "0.00", status: "ACTIVE" },
  { productId: "sg553-integrale-fn", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.058, pattern: 1901, priceOffset: "-2.50", status: "ACTIVE" },
];

const STATE_LISTINGS: DemoListing[] = [
  { productId: "ak-neon-rider-ft", sellerEmail: "seller@skinmarket.gg", floatValue: 0.22, pattern: 9101, priceOffset: "0.00", status: "SOLD" },
  { productId: "awp-hyper-beast-ft", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.27, pattern: 9102, priceOffset: "1.50", status: "SOLD" },
  { productId: "deagle-heat-treated-mw", sellerEmail: "rustking@skinmarket.gg", floatValue: 0.11, pattern: 9103, priceOffset: "0.00", status: "SOLD" },
  { productId: "ump-primal-saber-mw", sellerEmail: "seller@skinmarket.gg", floatValue: 0.09, pattern: 9104, priceOffset: "-1.00", status: "SOLD" },
  { productId: "m4a4-temukau-fn", sellerEmail: "pro_trader@skinmarket.gg", floatValue: 0.02, pattern: 9201, priceOffset: "0.00", status: "RESERVED" },
  { productId: "usp-printstream-mw", sellerEmail: "seller@skinmarket.gg", floatValue: 0.1, pattern: 9202, priceOffset: "3.00", status: "RESERVED" },
  { productId: "mac10-neon-rider-ft", sellerEmail: "rustking@skinmarket.gg", floatValue: 0.31, pattern: 9301, priceOffset: "0.00", status: "CANCELED" },
];

export const DEMO_REVIEWS: DemoReview[] = [
  { productId: "ak-redline-ft", authorEmail: "buyer@skinmarket.gg", rating: 5, comment: "Beautiful skin, great float value for the price!" },
  { productId: "awp-asiimov-ft", authorEmail: "buyer@skinmarket.gg", rating: 4, comment: "Classic AWP skin. Delivery was smooth." },
  { productId: "m4a4-dragon-king-mw", authorEmail: "buyer@skinmarket.gg", rating: 5, comment: "StatTrak™ works perfectly. Very happy!" },
  { productId: "glock-fade-fn", authorEmail: "collector@skinmarket.gg", rating: 5, comment: "Full fade pattern, exactly as described." },
  { productId: "deagle-blaze-fn", authorEmail: "collector@skinmarket.gg", rating: 4, comment: "Iconic skin, factory new condition is mint." },
  { productId: "karambit-fade-fn", authorEmail: "casual@skinmarket.gg", rating: 5, comment: "Dream knife, worth every penny." },
  { productId: "awp-printstream-mw", authorEmail: "collector@skinmarket.gg", rating: 5, comment: "Clean printstream, seller was fast." },
  { productId: "m4a1s-printstream-fn", authorEmail: "buyer@skinmarket.gg", rating: 4, comment: "Factory New as advertised." },
  { productId: "sport-gloves-pandora-ft", authorEmail: "casual@skinmarket.gg", rating: 5, comment: "Premium gloves, listing matched the screenshots." },
];

const EXTERIOR_FLOAT: Record<string, [number, number]> = {
  "Factory New": [0.012, 0.058],
  "Minimal Wear": [0.082, 0.138],
  "Field-Tested": [0.185, 0.34],
  "Well-Worn": [0.392, 0.438],
  "Battle-Scarred": [0.49, 0.71],
};

function floatFor(exterior: string, variant: number): number {
  const [min, max] = EXTERIOR_FLOAT[exterior] ?? [0.15, 0.3];
  const value = min + ((max - min) * ((variant % 7) + 1)) / 8;
  return Number(value.toFixed(4));
}

function money(value: string): string {
  return Number(value).toFixed(2);
}

export function listingId(listing: Pick<DemoListing, "productId" | "pattern">): string {
  return `listing-${listing.productId}-${listing.pattern}`;
}

export function listingPrice(product: DemoProduct, listing: DemoListing): string {
  return money((Number(product.price) + Number(listing.priceOffset)).toFixed(2));
}

export function getDemoListings(): DemoListing[] {
  const generated = DEMO_PRODUCTS.map((product, index) => {
    const sellerEmail = APPROVED_SELLER_EMAILS[index % APPROVED_SELLER_EMAILS.length]!;
    const secondSeller = APPROVED_SELLER_EMAILS[(index + 1) % APPROVED_SELLER_EMAILS.length]!;
    return [
      {
        productId: product.id,
        sellerEmail,
        floatValue: floatFor(product.exterior, index),
        pattern: 3000 + index,
        priceOffset: "0.00",
        status: "ACTIVE" as const,
      },
      {
        productId: product.id,
        sellerEmail: secondSeller,
        floatValue: floatFor(product.exterior, index + 3),
        pattern: 4000 + index,
        priceOffset: index % 2 === 0 ? "2.00" : "-1.50",
        status: "ACTIVE" as const,
      },
    ];
  }).flat();

  return [...LEGACY_LISTINGS, ...generated, ...STATE_LISTINGS];
}

export function assertDemoCatalog(): void {
  const productIds = new Set<string>();
  for (const product of DEMO_PRODUCTS) {
    if (productIds.has(product.id)) {
      throw new Error(`Duplicate demo product id: ${product.id}`);
    }
    productIds.add(product.id);
    if (Number(product.price) <= 0) {
      throw new Error(`Demo product ${product.id} must have a positive price`);
    }
  }

  const emails = new Set<string>();
  for (const user of DEMO_USERS) {
    if (emails.has(user.email)) {
      throw new Error(`Duplicate demo account: ${user.email}`);
    }
    emails.add(user.email);
    if (user.role === "SELLER" && !user.seller) {
      throw new Error(`Seller ${user.email} is missing a store profile`);
    }
  }

  const approvedSellers = new Set(APPROVED_SELLER_EMAILS);
  const listingKeys = new Set<string>();
  const statuses = new Set<DemoListingStatus>();

  for (const listing of getDemoListings()) {
    const key = listingId(listing);
    if (listingKeys.has(key)) {
      throw new Error(`Duplicate demo listing id: ${key}`);
    }
    listingKeys.add(key);
    statuses.add(listing.status);

    const product = DEMO_PRODUCTS.find((item) => item.id === listing.productId);
    if (!product) {
      throw new Error(`Listing ${key} references unknown product ${listing.productId}`);
    }
    if (!approvedSellers.has(listing.sellerEmail)) {
      throw new Error(`Listing ${key} uses a seller that is not approved`);
    }
    if (listing.floatValue < 0 || listing.floatValue > 1) {
      throw new Error(`Listing ${key} has an invalid float`);
    }
    if (Number(listingPrice(product, listing)) <= 0) {
      throw new Error(`Listing ${key} must have a positive price`);
    }
  }

  for (const review of DEMO_REVIEWS) {
    if (!productIds.has(review.productId)) {
      throw new Error(`Review references unknown product ${review.productId}`);
    }
    if (!emails.has(review.authorEmail)) {
      throw new Error(`Review references unknown account ${review.authorEmail}`);
    }
    if (review.rating < 1 || review.rating > 5) {
      throw new Error(`Review for ${review.productId} has an invalid rating`);
    }
  }

  if (DEMO_PRODUCTS.length < 30) {
    throw new Error("Demo catalog must include at least 30 products");
  }
  if (listingKeys.size < 50) {
    throw new Error("Demo catalog must include at least 50 listings");
  }
  for (const status of DEMO_LISTING_STATUSES) {
    if (!statuses.has(status)) {
      throw new Error(`Demo catalog is missing ${status} listings`);
    }
  }
  if (!DEMO_USERS.some((user) => user.seller && !user.seller.isApproved)) {
    throw new Error("Demo catalog must include an unapproved seller");
  }
}
