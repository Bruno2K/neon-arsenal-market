-- Convert critical domain status/role TEXT columns to PostgreSQL enums.
-- Labels match existing application values exactly. Unknown rows abort
-- the migration rather than inventing a mapping.

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SELLER', 'CUSTOMER');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'RESERVED', 'CANCELED');
CREATE TYPE "ClaimStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TYPE "PaymentProvider" AS ENUM ('PAYPAL');

DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM "User" WHERE "role" NOT IN ('ADMIN', 'SELLER', 'CUSTOMER');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'HUMAN: % User.role value(s) are not in (ADMIN, SELLER, CUSTOMER); refuse to invent enum mapping', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM "PendingRegistration" WHERE "role" NOT IN ('ADMIN', 'SELLER', 'CUSTOMER');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'HUMAN: % PendingRegistration.role value(s) are not in (ADMIN, SELLER, CUSTOMER); refuse to invent enum mapping', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM "Order" WHERE "status" NOT IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'HUMAN: % Order.status value(s) are not in (PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED); refuse to invent enum mapping', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM "Order" WHERE "paymentStatus" NOT IN ('PENDING', 'PAID', 'REFUNDED');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'HUMAN: % Order.paymentStatus value(s) are not in (PENDING, PAID, REFUNDED); refuse to invent enum mapping', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM "PaymentLink" WHERE "status" NOT IN ('IN_PROGRESS', 'COMPLETED');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'HUMAN: % PaymentLink.status value(s) are not in (IN_PROGRESS, COMPLETED); refuse to invent enum mapping', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM "OrderIdempotencyKey" WHERE "status" NOT IN ('IN_PROGRESS', 'COMPLETED');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'HUMAN: % OrderIdempotencyKey.status value(s) are not in (IN_PROGRESS, COMPLETED); refuse to invent enum mapping', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM "PaymentWebhookEvent" WHERE "provider" NOT IN ('PAYPAL');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'HUMAN: % PaymentWebhookEvent.provider value(s) are not in (PAYPAL); refuse to invent enum mapping', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM "PaymentWebhookEvent" WHERE "status" NOT IN ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'HUMAN: % PaymentWebhookEvent.status value(s) are not in (RECEIVED, PROCESSED, IGNORED, FAILED); refuse to invent enum mapping', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM "Listing" WHERE "status" NOT IN ('ACTIVE', 'SOLD', 'RESERVED', 'CANCELED');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'HUMAN: % Listing.status value(s) are not in (ACTIVE, SOLD, RESERVED, CANCELED); refuse to invent enum mapping', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM "SellerTransaction" WHERE "status" NOT IN ('PENDING', 'PAID', 'REFUNDED');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'HUMAN: % SellerTransaction.status value(s) are not in (PENDING, PAID, REFUNDED); refuse to invent enum mapping', bad_count;
  END IF;
END $$;

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::"UserRole");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER'::"UserRole";

ALTER TABLE "PendingRegistration" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::"UserRole");

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus" USING ("status"::"OrderStatus");
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"OrderStatus";

ALTER TABLE "Order" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus" USING ("paymentStatus"::"PaymentStatus");
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING'::"PaymentStatus";

ALTER TABLE "PaymentLink" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PaymentLink" ALTER COLUMN "status" TYPE "ClaimStatus" USING ("status"::"ClaimStatus");
ALTER TABLE "PaymentLink" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS'::"ClaimStatus";

ALTER TABLE "OrderIdempotencyKey" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "OrderIdempotencyKey" ALTER COLUMN "status" TYPE "ClaimStatus" USING ("status"::"ClaimStatus");
ALTER TABLE "OrderIdempotencyKey" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS'::"ClaimStatus";

ALTER TABLE "PaymentWebhookEvent" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "PaymentWebhookEvent" ALTER COLUMN "provider" TYPE "PaymentProvider" USING ("provider"::"PaymentProvider");
ALTER TABLE "PaymentWebhookEvent" ALTER COLUMN "provider" SET DEFAULT 'PAYPAL'::"PaymentProvider";

ALTER TABLE "PaymentWebhookEvent" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PaymentWebhookEvent" ALTER COLUMN "status" TYPE "WebhookEventStatus" USING ("status"::"WebhookEventStatus");
ALTER TABLE "PaymentWebhookEvent" ALTER COLUMN "status" SET DEFAULT 'RECEIVED'::"WebhookEventStatus";

ALTER TABLE "Listing" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Listing" ALTER COLUMN "status" TYPE "ListingStatus" USING ("status"::"ListingStatus");
ALTER TABLE "Listing" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"ListingStatus";

ALTER TABLE "SellerTransaction" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SellerTransaction" ALTER COLUMN "status" TYPE "PaymentStatus" USING ("status"::"PaymentStatus");
ALTER TABLE "SellerTransaction" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"PaymentStatus";
