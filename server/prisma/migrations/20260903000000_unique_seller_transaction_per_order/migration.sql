-- Prevent duplicate seller payouts when the same payment webhook is delivered more than once.
CREATE UNIQUE INDEX "SellerTransaction_sellerId_orderId_key"
ON "SellerTransaction"("sellerId", "orderId");
