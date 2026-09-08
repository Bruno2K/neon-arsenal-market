-- BRL was already the effective PayPal and seller-ledger currency. Preserve
-- every Decimal price and correct only the misleading historical label.
UPDATE "Listing"
SET "currency" = 'BRL'
WHERE "currency" <> 'BRL';

ALTER TABLE "Listing"
  ALTER COLUMN "currency" SET DEFAULT 'BRL';

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_currency_brl_chk"
  CHECK ("currency" = 'BRL');
