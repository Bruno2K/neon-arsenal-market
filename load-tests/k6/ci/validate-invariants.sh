#!/usr/bin/env bash
set -euo pipefail

pg_container=${1:?PostgreSQL container name is required}
profile=${2:?Load profile is required}
run_id=${3:?Run ID is required}
order_count=${4:?Order listing count is required}
payment_count=${5:?Payment order count is required}
output=${6:?Output path is required}

if [[ ! "$run_id" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "RUN_ID contains unsupported characters" >&2
  exit 1
fi

mkdir -p "$(dirname "$output")"
result=$(docker exec "$pg_container" psql -X -A -t -U neon -d neon_arsenal_loadtest -c "
  SELECT json_build_object(
    'profile', '${profile}',
    'run_id', '${run_id}',
    'order_fixture_listings', (SELECT count(*) FROM \"Listing\" WHERE id LIKE 'k6-order-${run_id}-%'),
    'order_active_listings', (
      SELECT count(*) FROM \"Listing\" WHERE id LIKE 'k6-order-${run_id}-%' AND status = 'ACTIVE'
    ),
    'order_fixture_orders', (
      SELECT count(DISTINCT oi.\"orderId\") FROM \"OrderItem\" oi
      WHERE oi.\"listingId\" LIKE 'k6-order-${run_id}-%'
    ),
    'order_valid_reservations', (
      SELECT count(*) FROM \"OrderItem\" oi
      JOIN \"Listing\" l ON l.id = oi.\"listingId\"
      JOIN \"Order\" o ON o.id = oi.\"orderId\"
      WHERE l.id LIKE 'k6-order-${run_id}-%'
        AND l.status = 'RESERVED'
        AND l.\"reservedByOrderId\" = o.id
        AND o.status = 'PENDING'
        AND o.\"paymentStatus\" = 'PENDING'
    ),
    'order_completed_idempotency_keys', (
      SELECT count(*) FROM \"OrderIdempotencyKey\"
      WHERE key LIKE 'k6-${run_id}-%' AND status = 'COMPLETED' AND \"orderId\" IS NOT NULL
    ),
    'order_duplicate_consumption', (
      SELECT count(*) FROM (
        SELECT oi.\"listingId\" FROM \"OrderItem\" oi
        WHERE oi.\"listingId\" LIKE 'k6-order-${run_id}-%'
        GROUP BY oi.\"listingId\" HAVING count(*) > 1
      ) duplicates
    ),
    'order_payment_links', (
      SELECT count(*) FROM \"PaymentLink\" pl
      WHERE pl.\"orderId\" IN (
        SELECT oi.\"orderId\" FROM \"OrderItem\" oi WHERE oi.\"listingId\" LIKE 'k6-order-${run_id}-%'
      )
    ),
    'order_seller_transactions', (
      SELECT count(*) FROM \"SellerTransaction\" st
      WHERE st.\"orderId\" IN (
        SELECT oi.\"orderId\" FROM \"OrderItem\" oi WHERE oi.\"listingId\" LIKE 'k6-order-${run_id}-%'
      )
    ),
    'payment_fixture_orders', (SELECT count(*) FROM \"Order\" WHERE id LIKE 'k6-payment-order-${run_id}-%'),
    'payment_completed_links', (
      SELECT count(*) FROM \"PaymentLink\"
      WHERE \"orderId\" LIKE 'k6-payment-order-${run_id}-%'
        AND status = 'COMPLETED'
        AND \"paypalOrderId\" IS NOT NULL
        AND \"approvalUrl\" IS NOT NULL
    ),
    'payment_link_mismatches', (
      SELECT count(*) FROM \"Order\" o JOIN \"PaymentLink\" pl ON pl.\"orderId\" = o.id
      WHERE o.id LIKE 'k6-payment-order-${run_id}-%'
        AND o.\"paypalOrderId\" IS DISTINCT FROM pl.\"paypalOrderId\"
    ),
    'payment_seller_transactions', (
      SELECT count(*) FROM \"SellerTransaction\" WHERE \"orderId\" LIKE 'k6-payment-order-${run_id}-%'
    ),
    'unexpected_webhook_events', (
      SELECT count(*) FROM \"PaymentWebhookEvent\" WHERE \"externalEventId\" LIKE 'k6-invalid-${run_id}-%'
    )
  );
")

printf '%s\n' "$result" | jq . | tee "$output"

case "$profile" in
  orders)
    jq -e \
      --argjson expected "$order_count" \
      '.order_fixture_listings == $expected and
       .order_fixture_orders == $expected and
       .order_valid_reservations == $expected and
       .order_completed_idempotency_keys == $expected and
       .order_duplicate_consumption == 0 and
       .order_payment_links == 0 and
       .order_seller_transactions == 0' <<< "$result" > /dev/null
    ;;
  payment_replay)
    jq -e \
      --argjson expected "$payment_count" \
      '.payment_fixture_orders == $expected and
       .payment_completed_links == $expected and
       .payment_link_mismatches == 0 and
       .payment_seller_transactions == 0 and
       .order_fixture_orders == 0' <<< "$result" > /dev/null
    ;;
  webhook_rejection)
    jq -e \
      --argjson expected "$order_count" \
      '.unexpected_webhook_events == 0 and .order_active_listings == $expected and .order_fixture_orders == 0' \
      <<< "$result" > /dev/null
    ;;
  smoke|catalog)
    jq -e \
      --argjson expected "$order_count" \
      '.order_active_listings == $expected and .order_fixture_orders == 0 and .unexpected_webhook_events == 0' \
      <<< "$result" > /dev/null
    ;;
  *)
    echo "Unknown profile: $profile" >&2
    exit 1
    ;;
esac

echo "Invariant validation passed for profile=$profile run_id=$run_id"
