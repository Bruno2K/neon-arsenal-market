#!/usr/bin/env bash
set -euo pipefail

pg_container=${1:?PostgreSQL container name is required}
phase=${2:?Snapshot phase is required}
output=${3:?Output path is required}

mkdir -p "$(dirname "$output")"
{
  echo "phase=$phase"
  echo "captured_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  docker exec -i "$pg_container" psql -X -v ON_ERROR_STOP=1 -P pager=off \
    -U neon -d neon_arsenal_loadtest <<'SQL'
SELECT version();
SHOW max_connections;
SELECT state, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY state ORDER BY state;
SELECT wait_event_type, wait_event, count(*)
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY wait_event_type, wait_event
ORDER BY wait_event_type NULLS FIRST, wait_event NULLS FIRST;
SELECT datname, numbackends, xact_commit, xact_rollback, deadlocks
FROM pg_stat_database WHERE datname = current_database();
SELECT status, count(*) FROM "Listing" GROUP BY status ORDER BY status;
SELECT status, "paymentStatus", count(*) FROM "Order" GROUP BY status, "paymentStatus" ORDER BY status, "paymentStatus";
SELECT
  (SELECT count(*) FROM "Product") AS products,
  (SELECT count(*) FROM "Listing") AS listings,
  (SELECT count(*) FROM "Order") AS orders,
  (SELECT count(*) FROM "PaymentLink") AS payment_links,
  (SELECT count(*) FROM "PaymentWebhookEvent") AS webhook_events,
  (SELECT count(*) FROM "Refund") AS refunds;
SQL
} > "$output" 2>&1
