-- AlterTable
ALTER TABLE "Product" ADD COLUMN "marketHashName" TEXT,
ADD COLUMN "referencePriceUsd" DECIMAL(65,30),
ADD COLUMN "cs2ShGenerationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_marketHashName_key" ON "Product"("marketHashName");
