-- Migration: Transform to CS Marketplace model
-- This migration transforms Product into a catalog base and creates Listing and PriceHistory models

-- Drop InventoryLog table (no longer needed - each listing is unique)
DROP TABLE IF EXISTS "InventoryLog";

-- Drop old indexes on Product
DROP INDEX IF EXISTS "Product_sellerId_idx";
DROP INDEX IF EXISTS "Product_isActive_idx";

-- Create new Product table structure (catalog base)
CREATE TABLE "Product_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL DEFAULT 'CS2',
    "weapon" TEXT NOT NULL,
    "skinName" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "exterior" TEXT NOT NULL,
    "collection" TEXT,
    "imageUrl" TEXT,
    "isStattrak" INTEGER NOT NULL DEFAULT 0,
    "isSouvenir" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Drop old Product table (if exists)
DROP TABLE IF EXISTS "Product";

-- Rename new table
ALTER TABLE "Product_new" RENAME TO "Product";

-- CreateTable: Listing
CREATE TABLE IF NOT EXISTS "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "floatValue" REAL NOT NULL,
    "pattern" INTEGER,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tradeLockUntil" DATETIME,
    "steamAssetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Listing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: PriceHistory
CREATE TABLE IF NOT EXISTS "PriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "oldPrice" REAL NOT NULL,
    "newPrice" REAL NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: Order
CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paypalOrderId" TEXT,
    "trackingCode" TEXT,
    "trackingCarrier" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: OrderItem
CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "priceSnapshot" REAL NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: SellerTransaction
CREATE TABLE IF NOT EXISTS "SellerTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "grossAmount" REAL NOT NULL,
    "commissionAmount" REAL NOT NULL,
    "netAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SellerTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: Review
CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: User
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex: PendingRegistration
CREATE UNIQUE INDEX IF NOT EXISTS "PendingRegistration_email_key" ON "PendingRegistration"("email");

-- CreateIndex: Seller
CREATE UNIQUE INDEX IF NOT EXISTS "Seller_userId_key" ON "Seller"("userId");

-- CreateIndex: Product
CREATE INDEX IF NOT EXISTS "Product_game_idx" ON "Product"("game");
CREATE INDEX IF NOT EXISTS "Product_weapon_idx" ON "Product"("weapon");
CREATE INDEX IF NOT EXISTS "Product_exterior_idx" ON "Product"("exterior");
CREATE INDEX IF NOT EXISTS "Product_rarity_idx" ON "Product"("rarity");
CREATE INDEX IF NOT EXISTS "Product_isStattrak_idx" ON "Product"("isStattrak");
CREATE INDEX IF NOT EXISTS "Product_game_weapon_exterior_isStattrak_idx" ON "Product"("game", "weapon", "exterior", "isStattrak");

-- CreateIndex: Listing
CREATE INDEX IF NOT EXISTS "Listing_productId_idx" ON "Listing"("productId");
CREATE INDEX IF NOT EXISTS "Listing_price_idx" ON "Listing"("price");
CREATE INDEX IF NOT EXISTS "Listing_floatValue_idx" ON "Listing"("floatValue");
CREATE INDEX IF NOT EXISTS "Listing_status_idx" ON "Listing"("status");
CREATE INDEX IF NOT EXISTS "Listing_sellerId_idx" ON "Listing"("sellerId");
CREATE INDEX IF NOT EXISTS "Listing_productId_status_idx" ON "Listing"("productId", "status");

-- CreateIndex: PriceHistory
CREATE INDEX IF NOT EXISTS "PriceHistory_listingId_idx" ON "PriceHistory"("listingId");
CREATE INDEX IF NOT EXISTS "PriceHistory_changedAt_idx" ON "PriceHistory"("changedAt");

-- CreateIndex: Order
CREATE UNIQUE INDEX IF NOT EXISTS "Order_paypalOrderId_key" ON "Order"("paypalOrderId");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex: OrderItem
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_listingId_idx" ON "OrderItem"("listingId");
CREATE INDEX IF NOT EXISTS "OrderItem_sellerId_idx" ON "OrderItem"("sellerId");

-- CreateIndex: SellerTransaction
CREATE INDEX IF NOT EXISTS "SellerTransaction_sellerId_idx" ON "SellerTransaction"("sellerId");
CREATE INDEX IF NOT EXISTS "SellerTransaction_orderId_idx" ON "SellerTransaction"("orderId");

-- CreateIndex: Review
CREATE INDEX IF NOT EXISTS "Review_productId_idx" ON "Review"("productId");
CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_productId_userId_key" ON "Review"("productId", "userId");
