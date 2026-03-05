import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const hash = (password: string) => bcrypt.hash(password, SALT_ROUNDS);

// ─── Product catalog ────────────────────────────────────────────────────────
const PRODUCTS = [
  // AK-47
  { id: "ak-redline-ft",       weapon: "AK-47",       skinName: "Redline",             rarity: "Classified", exterior: "Field-Tested",    collection: "The Huntsman Collection",   isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_ak47_gs_ak47_redline_light.7f09c5ae6eadeba18830c6600ed60ee04a2aa74b.png" },
  { id: "ak-redline-st-ft",    weapon: "AK-47",       skinName: "Redline",             rarity: "Classified", exterior: "Field-Tested",    collection: "The Huntsman Collection",   isStattrak: true,  isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_ak47_gs_ak47_redline_light.7f09c5ae6eadeba18830c6600ed60ee04a2aa74b.png" },
  { id: "ak-asiimov-mw",       weapon: "AK-47",       skinName: "Asiimov",             rarity: "Covert",     exterior: "Minimal Wear",    collection: "Operation Wildfire Case",   isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_ak47_so_ak47_asimov_light.bf74ec5587bb3c2d6618dde0de3b0e09c44e3b71.png" },
  { id: "ak-vulcan-fn",        weapon: "AK-47",       skinName: "Vulcan",              rarity: "Covert",     exterior: "Factory New",     collection: "Operation Bravo Case",      isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_ak47_aq_ak47_blue_etched_light.bd5c4ab5a8c5c1e82bb2c1427b2f93bd3e1eee68.png" },
  // AWP
  { id: "awp-asiimov-ft",      weapon: "AWP",         skinName: "Asiimov",             rarity: "Covert",     exterior: "Field-Tested",    collection: "The Cache Collection",      isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_awp_so_awp_asimov_light.5c3813b3f41f2a70e3ccbad76a8de1bb5c6022da.png" },
  { id: "awp-dragon-lore-fn",  weapon: "AWP",         skinName: "Dragon Lore",         rarity: "Covert",     exterior: "Factory New",     collection: "The Cobblestone Collection",isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_awp_so_awp_dragon_lore_light.f0b51c4d9fa65e14d4bfc555c60cfb62c48d29b7.png" },
  { id: "awp-lightning-fn",    weapon: "AWP",         skinName: "Lightning Strike",    rarity: "Covert",     exterior: "Factory New",     collection: "Arms Deal Collection",      isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_awp_aa_fade_light.a4af8eab47e8fc1e90e68f20f744ffb39c2e3e21.png" },
  // M4A4
  { id: "m4a4-howl-fn",        weapon: "M4A4",        skinName: "Howl",                rarity: "Contraband", exterior: "Factory New",     collection: "The Huntsman Collection",   isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_m4a1_sp_m4a4_howl_light.06ac5a46b61282fe9a5f26cf8e1c9e0c7d96a8e7.png" },
  { id: "m4a4-asiimov-fn",     weapon: "M4A4",        skinName: "Asiimov",             rarity: "Covert",     exterior: "Factory New",     collection: "Operation Phoenix Case",    isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_m4a1_so_m4a4_asimov_light.78cae2a06c5e28e5c1c59d7cffa6b0c3a11c3b17.png" },
  { id: "m4a4-dragon-king-mw", weapon: "M4A4",        skinName: "Dragon King",         rarity: "Classified", exterior: "Minimal Wear",    collection: "The Clutch Collection",     isStattrak: true,  isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_m4a1_aq_m4a4_monkey_king_light.a3e1a0f01e6dc2fa1e39a1a3a5b5d9d4ff0c614c.png" },
  // M4A1-S
  { id: "m4a1s-hot-rod-fn",    weapon: "M4A1-S",      skinName: "Hot Rod",             rarity: "Covert",     exterior: "Factory New",     collection: "CS:GO Weapon Case 3",       isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_m4a1_silencer_aa_fade_light.d0beb24ff2748c1a5a5a6bfac15a76d05d55a8ad.png" },
  { id: "m4a1s-hyper-beast-mw",weapon: "M4A1-S",      skinName: "Hyper Beast",         rarity: "Covert",     exterior: "Minimal Wear",    collection: "Falchion Case",             isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_m4a1_silencer_hy_hyperb_m4_light.0ee3fa5699e5a5f4c7c0c5b7c6dcade40da35553.png" },
  // Glock-18
  { id: "glock-fade-fn",       weapon: "Glock-18",    skinName: "Fade",                rarity: "Covert",     exterior: "Factory New",     collection: "CS:GO Weapon Case",         isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_glock_aa_fade_light.7a18ddfa1e44e5c4a6c1b8dd0e3ad7843b1a6d20.png" },
  { id: "glock-water-elem-fn", weapon: "Glock-18",    skinName: "Water Elemental",     rarity: "Restricted", exterior: "Factory New",     collection: "Breakout Case",             isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_glock_sp_glock_water_elemental_light.9e3419f00ee5e41abac1741b4dc9acb2e20b5f9c.png" },
  // USP-S
  { id: "usps-kill-confirmed-mw", weapon: "USP-S",   skinName: "Kill Confirmed",       rarity: "Covert",     exterior: "Minimal Wear",    collection: "Chroma 2 Case",             isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_usp_silencer_sp_tape_light.62ad3c19da27b70aae949a50c78cfeea74ebac78.png" },
  // Desert Eagle
  { id: "deagle-blaze-fn",     weapon: "Desert Eagle","skinName": "Blaze",             rarity: "Restricted", exterior: "Factory New",     collection: "Arms Deal Collection",      isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_deagle_aa_flames_light.17b2ededfed73d5de02e9c0017ae24ceb20d4c1b.png" },
  { id: "deagle-code-red-fn",  weapon: "Desert Eagle","skinName": "Code Red",          rarity: "Covert",     exterior: "Factory New",     collection: "Danger Zone Case",          isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_deagle_so_deagle_code_red_light.fec69f9f3c9c0a63e5eb1a09e697c3cd5e5e5d3f.png" },
  // Knives
  { id: "karambit-fade-fn",    weapon: "Karambit",    skinName: "Fade",                rarity: "Covert",     exterior: "Factory New",     collection: "CS:GO Weapon Case",         isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_knife_karambit_aa_fade_light.7d6e3b51e6c6c4e6f9e2f30e3d8c7d4f38e3c7a0.png" },
  { id: "butterfly-crimson-fn",weapon: "Butterfly Knife","skinName":"Crimson Web",     rarity: "Covert",     exterior: "Factory New",     collection: "Spectrum Case",             isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_knife_butterfly_aq_spiderweb_light.8a4b5c3f8c2f8e0e9a7d3b2c1a0f6e5d4c3b2a19.png" },
  // Rifles
  { id: "sg553-integrale-fn",  weapon: "SG 553",      skinName: "Integrale",           rarity: "Classified", exterior: "Factory New",     collection: "Broken Fang Case",          isStattrak: false, isSouvenir: false, imageUrl: "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/default_generated/weapon_sg556_gs_sg553_integrale_light.0c4b5c0b7b0c7e8e3a0b3c7e5d4c3b2a1f0e9d8c.png" },
];

// ─── Listing price reference (USD) ──────────────────────────────────────────
const PRICE_MAP: Record<string, number> = {
  "ak-redline-ft":        18.50,
  "ak-redline-st-ft":     65.00,
  "ak-asiimov-mw":       320.00,
  "ak-vulcan-fn":        145.00,
  "awp-asiimov-ft":      110.00,
  "awp-dragon-lore-fn": 3200.00,
  "awp-lightning-fn":    480.00,
  "m4a4-howl-fn":       3800.00,
  "m4a4-asiimov-fn":     220.00,
  "m4a4-dragon-king-mw":  42.00,
  "m4a1s-hot-rod-fn":    310.00,
  "m4a1s-hyper-beast-mw": 65.00,
  "glock-fade-fn":       380.00,
  "glock-water-elem-fn":  12.50,
  "usps-kill-confirmed-mw":85.00,
  "deagle-blaze-fn":     195.00,
  "deagle-code-red-fn":  125.00,
  "karambit-fade-fn":    950.00,
  "butterfly-crimson-fn":780.00,
  "sg553-integrale-fn":   28.00,
};

// Each product gets 2–3 listings with slight float/price variation
const LISTING_TEMPLATES: Array<{ productId: string; floatValue: number; pattern: number; priceOffset: number }> = [
  { productId: "ak-redline-ft",        floatValue: 0.2502, pattern: 123,  priceOffset: 0 },
  { productId: "ak-redline-ft",        floatValue: 0.1810, pattern: 456,  priceOffset: 3.50 },
  { productId: "ak-redline-ft",        floatValue: 0.3301, pattern: 789,  priceOffset: -1.00 },
  { productId: "ak-redline-st-ft",     floatValue: 0.2100, pattern: 321,  priceOffset: 0 },
  { productId: "ak-redline-st-ft",     floatValue: 0.1530, pattern: 654,  priceOffset: 5.00 },
  { productId: "ak-asiimov-mw",        floatValue: 0.0855, pattern: 200,  priceOffset: 0 },
  { productId: "ak-asiimov-mw",        floatValue: 0.1200, pattern: 201,  priceOffset: -15.00 },
  { productId: "ak-vulcan-fn",         floatValue: 0.0062, pattern: 400,  priceOffset: 0 },
  { productId: "ak-vulcan-fn",         floatValue: 0.0310, pattern: 401,  priceOffset: -10.00 },
  { productId: "awp-asiimov-ft",       floatValue: 0.3200, pattern: 500,  priceOffset: 0 },
  { productId: "awp-asiimov-ft",       floatValue: 0.2800, pattern: 501,  priceOffset: 8.00 },
  { productId: "awp-dragon-lore-fn",   floatValue: 0.0089, pattern: 600,  priceOffset: 0 },
  { productId: "awp-lightning-fn",     floatValue: 0.0032, pattern: 700,  priceOffset: 0 },
  { productId: "m4a4-howl-fn",         floatValue: 0.0210, pattern: 800,  priceOffset: 0 },
  { productId: "m4a4-asiimov-fn",      floatValue: 0.0075, pattern: 900,  priceOffset: 0 },
  { productId: "m4a4-asiimov-fn",      floatValue: 0.0350, pattern: 901,  priceOffset: -20.00 },
  { productId: "m4a4-dragon-king-mw",  floatValue: 0.1200, pattern: 321,  priceOffset: 0 },
  { productId: "m4a4-dragon-king-mw",  floatValue: 0.0750, pattern: 322,  priceOffset: 4.00 },
  { productId: "m4a1s-hot-rod-fn",     floatValue: 0.0090, pattern: 1001, priceOffset: 0 },
  { productId: "m4a1s-hyper-beast-mw", floatValue: 0.0980, pattern: 1100, priceOffset: 0 },
  { productId: "m4a1s-hyper-beast-mw", floatValue: 0.1400, pattern: 1101, priceOffset: -5.00 },
  { productId: "glock-fade-fn",        floatValue: 0.0150, pattern: 1200, priceOffset: 0 },
  { productId: "glock-fade-fn",        floatValue: 0.0070, pattern: 1201, priceOffset: 25.00 },
  { productId: "glock-water-elem-fn",  floatValue: 0.0012, pattern: 1300, priceOffset: 0 },
  { productId: "usps-kill-confirmed-mw",floatValue: 0.0800, pattern: 1400, priceOffset: 0 },
  { productId: "usps-kill-confirmed-mw",floatValue: 0.1200, pattern: 1401, priceOffset: -8.00 },
  { productId: "deagle-blaze-fn",      floatValue: 0.0050, pattern: 1500, priceOffset: 0 },
  { productId: "deagle-code-red-fn",   floatValue: 0.0025, pattern: 1600, priceOffset: 0 },
  { productId: "deagle-code-red-fn",   floatValue: 0.0380, pattern: 1601, priceOffset: -12.00 },
  { productId: "karambit-fade-fn",     floatValue: 0.0030, pattern: 1700, priceOffset: 0 },
  { productId: "karambit-fade-fn",     floatValue: 0.0180, pattern: 1701, priceOffset: -50.00 },
  { productId: "butterfly-crimson-fn", floatValue: 0.0055, pattern: 1800, priceOffset: 0 },
  { productId: "sg553-integrale-fn",   floatValue: 0.0210, pattern: 1900, priceOffset: 0 },
  { productId: "sg553-integrale-fn",   floatValue: 0.0580, pattern: 1901, priceOffset: -2.50 },
];

async function main() {
  console.log("🌱 Starting seed...\n");

  // ── 1. Users ──────────────────────────────────────────────────────────────
  const [adminPw, sellerPw, seller2Pw, buyerPw] = await Promise.all([
    hash("admin123"),
    hash("seller123"),
    hash("seller456"),
    hash("buyer123"),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: "admin@skinmarket.gg" },
    update: {},
    create: { name: "Admin", email: "admin@skinmarket.gg", password: adminPw, role: "ADMIN" },
  });
  console.log(`✅ Admin: ${admin.email}`);

  const sellerUser = await prisma.user.upsert({
    where: { email: "seller@skinmarket.gg" },
    update: {},
    create: { name: "NeonTrader", email: "seller@skinmarket.gg", password: sellerPw, role: "SELLER" },
  });
  const sellerProfile = await prisma.seller.upsert({
    where: { userId: sellerUser.id },
    update: {},
    create: { userId: sellerUser.id, storeName: "NeonTrader Store", commissionRate: 0.1, balance: 1250.75, isApproved: true },
  });
  console.log(`✅ Seller 1: ${sellerUser.email} (${sellerProfile.storeName})`);

  const sellerUser2 = await prisma.user.upsert({
    where: { email: "pro_trader@skinmarket.gg" },
    update: {},
    create: { name: "ProTrader", email: "pro_trader@skinmarket.gg", password: seller2Pw, role: "SELLER" },
  });
  const sellerProfile2 = await prisma.seller.upsert({
    where: { userId: sellerUser2.id },
    update: {},
    create: { userId: sellerUser2.id, storeName: "ProTrader CS2", commissionRate: 0.08, balance: 580.00, isApproved: true },
  });
  console.log(`✅ Seller 2: ${sellerUser2.email} (${sellerProfile2.storeName})`);

  const buyer = await prisma.user.upsert({
    where: { email: "buyer@skinmarket.gg" },
    update: {},
    create: { name: "Player One", email: "buyer@skinmarket.gg", password: buyerPw, role: "CUSTOMER" },
  });
  console.log(`✅ Buyer: ${buyer.email}\n`);

  // ── 2. Product catalog ────────────────────────────────────────────────────
  console.log("📦 Seeding product catalog...");
  const productMap: Record<string, string> = {}; // id → db id (same in this case)
  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        game: "CS2",
        weapon: p.weapon,
        skinName: p.skinName,
        rarity: p.rarity,
        exterior: p.exterior,
        collection: p.collection ?? null,
        imageUrl: p.imageUrl ?? null,
        isStattrak: p.isStattrak,
        isSouvenir: p.isSouvenir,
      },
    });
    productMap[product.id] = product.id;
  }
  console.log(`✅ ${PRODUCTS.length} products upserted\n`);

  // ── 3. Listings ───────────────────────────────────────────────────────────
  console.log("🏷️  Seeding listings...");
  let listingCount = 0;
  for (let i = 0; i < LISTING_TEMPLATES.length; i++) {
    const t = LISTING_TEMPLATES[i];
    const basePrice = PRICE_MAP[t.productId] ?? 10;
    const finalPrice = Math.max(0.01, basePrice + t.priceOffset);
    // Alternate between the two sellers
    const seller = i % 3 === 0 ? sellerProfile2 : sellerProfile;
    const listingId = `listing-${t.productId}-${t.pattern}`;

    await prisma.listing.upsert({
      where: { id: listingId },
      update: {},
      create: {
        id: listingId,
        productId: t.productId,
        sellerId: seller.id,
        floatValue: t.floatValue,
        pattern: t.pattern,
        price: parseFloat(finalPrice.toFixed(2)),
        currency: "USD",
        status: "ACTIVE",
        steamAssetId: `7656119800000${String(i).padStart(4, "0")}`,
      },
    });
    listingCount++;
  }
  console.log(`✅ ${listingCount} listings upserted\n`);

  // ── 4. Reviews ────────────────────────────────────────────────────────────
  console.log("⭐ Seeding reviews...");
  const reviewTargets = [
    { productId: "ak-redline-ft",       rating: 5, comment: "Beautiful skin, great float value for the price!" },
    { productId: "awp-asiimov-ft",      rating: 4, comment: "Classic AWP skin. Delivery was smooth." },
    { productId: "m4a4-dragon-king-mw", rating: 5, comment: "StatTrak™ works perfectly. Very happy!" },
    { productId: "glock-fade-fn",       rating: 5, comment: "Full fade pattern, exactly as described." },
    { productId: "deagle-blaze-fn",     rating: 4, comment: "Iconic skin, factory new condition is mint." },
    { productId: "karambit-fade-fn",    rating: 5, comment: "Dream knife, worth every penny." },
  ];

  for (const r of reviewTargets) {
    try {
      await prisma.review.upsert({
        where: { productId_userId: { productId: r.productId, userId: buyer.id } },
        update: {},
        create: { productId: r.productId, userId: buyer.id, rating: r.rating, comment: r.comment },
      });
    } catch {
      // May already exist if seed is re-run; safe to skip
    }
  }
  console.log(`✅ ${reviewTargets.length} reviews upserted\n`);

  console.log("─────────────────────────────────────────");
  console.log("🎉 Seed complete!\n");
  console.log("Demo accounts:");
  console.log("  admin@skinmarket.gg   / admin123  (role: ADMIN)");
  console.log("  seller@skinmarket.gg  / seller123 (role: SELLER, approved)");
  console.log("  pro_trader@skinmarket.gg / seller456 (role: SELLER, approved)");
  console.log("  buyer@skinmarket.gg   / buyer123  (role: CUSTOMER)");
  console.log(`\nCatalog: ${PRODUCTS.length} skins · ${listingCount} listings · ${reviewTargets.length} reviews`);
  console.log("─────────────────────────────────────────");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
