-- ============================================================
-- Neon Arsenal Market — Initial PostgreSQL Migration
-- Generated for Prisma 5 / PostgreSQL 15+
-- ============================================================

-- ─── User ────────────────────────────────────────────────────
CREATE TABLE "User" (
    "id"        TEXT          NOT NULL,
    "name"      TEXT          NOT NULL,
    "email"     TEXT          NOT NULL,
    "password"  TEXT          NOT NULL,
    "role"      TEXT          NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- ─── PendingRegistration ─────────────────────────────────────
CREATE TABLE "PendingRegistration" (
    "id"           TEXT          NOT NULL,
    "email"        TEXT          NOT NULL,
    "name"         TEXT          NOT NULL,
    "passwordHash" TEXT          NOT NULL,
    "role"         TEXT          NOT NULL,
    "storeName"    TEXT,
    "code"         TEXT          NOT NULL,
    "expiresAt"    TIMESTAMP(3)  NOT NULL,
    "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingRegistration_email_key" ON "PendingRegistration"("email");

-- ─── Seller ──────────────────────────────────────────────────
CREATE TABLE "Seller" (
    "id"             TEXT           NOT NULL,
    "userId"         TEXT           NOT NULL,
    "storeName"      TEXT           NOT NULL,
    "commissionRate" DECIMAL(65,30) NOT NULL DEFAULT 0.1,
    "balance"        DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rating"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isApproved"     BOOLEAN        NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Seller_userId_key" ON "Seller"("userId");

-- ─── Product ─────────────────────────────────────────────────
CREATE TABLE "Product" (
    "id"         TEXT          NOT NULL,
    "game"       TEXT          NOT NULL,
    "weapon"     TEXT          NOT NULL,
    "skinName"   TEXT          NOT NULL,
    "rarity"     TEXT          NOT NULL,
    "exterior"   TEXT          NOT NULL,
    "collection" TEXT,
    "imageUrl"   TEXT,
    "isStattrak" BOOLEAN       NOT NULL DEFAULT false,
    "isSouvenir" BOOLEAN       NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Product_game_idx"                          ON "Product"("game");
CREATE INDEX "Product_weapon_idx"                        ON "Product"("weapon");
CREATE INDEX "Product_exterior_idx"                      ON "Product"("exterior");
CREATE INDEX "Product_rarity_idx"                        ON "Product"("rarity");
CREATE INDEX "Product_isStattrak_idx"                    ON "Product"("isStattrak");
CREATE INDEX "Product_game_weapon_exterior_isStattrak_idx" ON "Product"("game","weapon","exterior","isStattrak");

-- ─── Order ───────────────────────────────────────────────────
CREATE TABLE "Order" (
    "id"             TEXT           NOT NULL,
    "customerId"     TEXT           NOT NULL,
    "totalAmount"    DECIMAL(65,30) NOT NULL,
    "status"         TEXT           NOT NULL DEFAULT 'PENDING',
    "paymentStatus"  TEXT           NOT NULL DEFAULT 'PENDING',
    "paypalOrderId"  TEXT,
    "trackingCode"   TEXT,
    "trackingCarrier" TEXT,
    "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_paypalOrderId_key" ON "Order"("paypalOrderId");
CREATE INDEX "Order_customerId_idx"    ON "Order"("customerId");
CREATE INDEX "Order_status_idx"        ON "Order"("status");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- ─── Listing ─────────────────────────────────────────────────
CREATE TABLE "Listing" (
    "id"            TEXT           NOT NULL,
    "productId"     TEXT           NOT NULL,
    "sellerId"      TEXT           NOT NULL,
    "floatValue"    DECIMAL(65,30) NOT NULL,
    "pattern"       INTEGER,
    "price"         DECIMAL(65,30) NOT NULL,
    "currency"      TEXT           NOT NULL DEFAULT 'USD',
    "status"        TEXT           NOT NULL DEFAULT 'ACTIVE',
    "tradeLockUntil" TIMESTAMP(3),
    "steamAssetId"  TEXT,
    "createdAt"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt"        TIMESTAMP(3),
    "updatedAt"     TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Listing_productId_idx"        ON "Listing"("productId");
CREATE INDEX "Listing_price_idx"            ON "Listing"("price");
CREATE INDEX "Listing_floatValue_idx"       ON "Listing"("floatValue");
CREATE INDEX "Listing_status_idx"           ON "Listing"("status");
CREATE INDEX "Listing_sellerId_idx"         ON "Listing"("sellerId");
CREATE INDEX "Listing_productId_status_idx" ON "Listing"("productId","status");

-- ─── PriceHistory ─────────────────────────────────────────────
CREATE TABLE "PriceHistory" (
    "id"        TEXT           NOT NULL,
    "listingId" TEXT           NOT NULL,
    "oldPrice"  DECIMAL(65,30) NOT NULL,
    "newPrice"  DECIMAL(65,30) NOT NULL,
    "changedAt" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceHistory_listingId_idx" ON "PriceHistory"("listingId");
CREATE INDEX "PriceHistory_changedAt_idx" ON "PriceHistory"("changedAt");

-- ─── OrderItem ───────────────────────────────────────────────
CREATE TABLE "OrderItem" (
    "id"            TEXT           NOT NULL,
    "orderId"       TEXT           NOT NULL,
    "listingId"     TEXT           NOT NULL,
    "sellerId"      TEXT           NOT NULL,
    "priceSnapshot" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderItem_orderId_idx"   ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_listingId_idx" ON "OrderItem"("listingId");
CREATE INDEX "OrderItem_sellerId_idx"  ON "OrderItem"("sellerId");

-- ─── SellerTransaction ───────────────────────────────────────
CREATE TABLE "SellerTransaction" (
    "id"               TEXT           NOT NULL,
    "sellerId"         TEXT           NOT NULL,
    "orderId"          TEXT           NOT NULL,
    "grossAmount"      DECIMAL(65,30) NOT NULL,
    "commissionAmount" DECIMAL(65,30) NOT NULL,
    "netAmount"        DECIMAL(65,30) NOT NULL,
    "status"           TEXT           NOT NULL DEFAULT 'PENDING',
    "createdAt"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SellerTransaction_sellerId_idx" ON "SellerTransaction"("sellerId");
CREATE INDEX "SellerTransaction_orderId_idx"  ON "SellerTransaction"("orderId");

-- ─── Review ──────────────────────────────────────────────────
CREATE TABLE "Review" (
    "id"        TEXT          NOT NULL,
    "productId" TEXT          NOT NULL,
    "userId"    TEXT          NOT NULL,
    "rating"    INTEGER       NOT NULL,
    "comment"   TEXT,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Review_productId_userId_key" ON "Review"("productId","userId");
CREATE INDEX "Review_productId_idx" ON "Review"("productId");
CREATE INDEX "Review_userId_idx"    ON "Review"("userId");

-- ─── RevokedToken ────────────────────────────────────────────
CREATE TABLE "RevokedToken" (
    "id"        TEXT          NOT NULL,
    "jti"       TEXT          NOT NULL,
    "userId"    TEXT          NOT NULL,
    "expiresAt" TIMESTAMP(3)  NOT NULL,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RevokedToken_jti_key"       ON "RevokedToken"("jti");
CREATE INDEX "RevokedToken_userId_idx"    ON "RevokedToken"("userId");
CREATE INDEX "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");

-- ─── Foreign Keys ────────────────────────────────────────────
ALTER TABLE "Seller"
    ADD CONSTRAINT "Seller_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Listing"
    ADD CONSTRAINT "Listing_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Listing"
    ADD CONSTRAINT "Listing_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "Seller"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriceHistory"
    ADD CONSTRAINT "PriceHistory_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "Seller"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SellerTransaction"
    ADD CONSTRAINT "SellerTransaction_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "Seller"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SellerTransaction"
    ADD CONSTRAINT "SellerTransaction_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review"
    ADD CONSTRAINT "Review_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review"
    ADD CONSTRAINT "Review_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
