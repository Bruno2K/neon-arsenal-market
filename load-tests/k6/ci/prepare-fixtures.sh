#!/usr/bin/env bash
set -euo pipefail

pg_container=${1:?PostgreSQL container name is required}
run_id=${2:?Run ID is required}
order_count=${3:?Order listing count is required}
payment_count=${4:?Payment order count is required}
github_env=${5:?GITHUB_ENV path is required}
output_dir=${6:?Output directory is required}

if [[ ! "$run_id" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "RUN_ID contains unsupported characters" >&2
  exit 1
fi
if [[ ! "$order_count" =~ ^[1-9][0-9]*$ ]] || (( order_count > 100 )); then
  echo "Order listing count must be between 1 and 100" >&2
  exit 1
fi
if [[ ! "$payment_count" =~ ^[1-9][0-9]*$ ]] || (( payment_count > 20 )); then
  echo "Payment order count must be between 1 and 20" >&2
  exit 1
fi

mkdir -p "$output_dir"

docker exec -i "$pg_container" psql -X -v ON_ERROR_STOP=1 \
  -U neon -d neon_arsenal_loadtest \
  -v run_id="$run_id" -v order_count="$order_count" -v payment_count="$payment_count" \
  > "$output_dir/fixture-preparation.log" <<'SQL'
BEGIN;

CREATE TEMP TABLE k6_context AS
SELECT
  (SELECT id FROM "User" WHERE email = 'buyer@skinmarket.gg' AND role = 'CUSTOMER' LIMIT 1) AS customer_id,
  (SELECT id FROM "Seller" WHERE "isApproved" = true ORDER BY id LIMIT 1) AS seller_id,
  (SELECT id FROM "Product" ORDER BY id LIMIT 1) AS product_id;

DO $validation$
BEGIN
  IF EXISTS (
    SELECT 1 FROM k6_context
    WHERE customer_id IS NULL OR seller_id IS NULL OR product_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Demo seed did not provide the required customer, seller and product';
  END IF;
END
$validation$;

INSERT INTO "Listing" (
  id, "productId", "sellerId", "floatValue", pattern, price, currency,
  status, "createdAt", "updatedAt"
)
SELECT
  'k6-order-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  product_id,
  seller_id,
  0.10,
  600000 + series,
  10.00,
  'BRL',
  'ACTIVE',
  now(),
  now()
FROM k6_context
CROSS JOIN generate_series(1, :order_count) AS series;

INSERT INTO "Order" (
  id, "customerId", "totalAmount", status, "paymentStatus", "paypalOrderId",
  "createdAt", "updatedAt"
)
SELECT
  'k6-payment-order-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  customer_id,
  10.00,
  'PENDING',
  'PENDING',
  'K6-CI-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  now(),
  now()
FROM k6_context
CROSS JOIN generate_series(1, :payment_count) AS series;

INSERT INTO "Listing" (
  id, "productId", "sellerId", "floatValue", pattern, price, currency,
  status, "reservedAt", "reservationExpiresAt", "reservedByOrderId",
  "createdAt", "updatedAt"
)
SELECT
  'k6-payment-listing-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  product_id,
  seller_id,
  0.11,
  700000 + series,
  10.00,
  'BRL',
  'RESERVED',
  now(),
  now() + interval '10 minutes',
  'k6-payment-order-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  now(),
  now()
FROM k6_context
CROSS JOIN generate_series(1, :payment_count) AS series;

INSERT INTO "OrderItem" (id, "orderId", "listingId", "sellerId", "priceSnapshot")
SELECT
  'k6-payment-item-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  'k6-payment-order-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  'k6-payment-listing-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  seller_id,
  10.00
FROM k6_context
CROSS JOIN generate_series(1, :payment_count) AS series;

INSERT INTO "OrderIdempotencyKey" (
  id, "customerId", key, "requestHash", status, "orderId", "createdAt", "updatedAt"
)
SELECT
  'k6-payment-key-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  customer_id,
  'k6-payment-fixture-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  repeat('0', 64),
  'COMPLETED',
  'k6-payment-order-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  now(),
  now()
FROM k6_context
CROSS JOIN generate_series(1, :payment_count) AS series;

INSERT INTO "PaymentLink" (
  "orderId", "paypalOrderId", "approvalUrl", status, "createdAt", "updatedAt"
)
SELECT
  'k6-payment-order-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  'K6-CI-' || :'run_id' || '-' || lpad(series::text, 4, '0'),
  'https://example.invalid/k6-ci/' || :'run_id' || '/' || series,
  'COMPLETED',
  now(),
  now()
FROM generate_series(1, :payment_count) AS series;

COMMIT;

SELECT 'fixture_orders', count(*)
FROM "Listing" WHERE id LIKE 'k6-order-' || :'run_id' || '-%';
SELECT 'fixture_payment_links', count(*)
FROM "PaymentLink" WHERE "orderId" LIKE 'k6-payment-order-' || :'run_id' || '-%';
SQL

order_ids=$(docker exec "$pg_container" psql -X -A -t -U neon -d neon_arsenal_loadtest \
  -c "SELECT string_agg(id, ',' ORDER BY id) FROM \"Listing\" WHERE id LIKE 'k6-order-${run_id}-%'")
payment_ids=$(docker exec "$pg_container" psql -X -A -t -U neon -d neon_arsenal_loadtest \
  -c "SELECT string_agg(id, ',' ORDER BY id) FROM \"Order\" WHERE id LIKE 'k6-payment-order-${run_id}-%'")

if [[ -z "$order_ids" ]] || [[ -z "$payment_ids" ]]; then
  echo "Fixture IDs were not generated" >&2
  exit 1
fi

{
  echo "CUSTOMER_EMAIL=buyer@skinmarket.gg"
  echo "CUSTOMER_PASSWORD=buyer123"
  echo "ORDER_LISTING_IDS=$order_ids"
  echo "PAYMENT_ORDER_IDS=$payment_ids"
} >> "$github_env"

printf '%s\n' "$order_ids" | tr ',' '\n' > "$output_dir/order-listing-ids.txt"
printf '%s\n' "$payment_ids" | tr ',' '\n' > "$output_dir/payment-order-ids.txt"
