# k6 load-test harness

Issue #55. Run only against an isolated, production-like environment with disposable data. The default `smoke` profile is read-only. Write profiles require explicit data and never create users, listings, or PayPal resources implicitly.

## Profiles

| Profile | Behavior | Mutation |
|---|---|---|
| `smoke` | One-VU catalog sanity check | None |
| `catalog` | Ramping arrival rate against cursor-paginated `GET /api/v1/listings` | None |
| `orders` | One order per supplied active listing, each with a unique idempotency key | Reserves listings and creates orders |
| `payment_replay` | Replays payment-link reads for orders that already expose a `paypalOrderId` | No intended mutation; setup aborts if any order is not pre-warmed |
| `webhook_rejection` | Exercises invalid-signature rejection | None; expects 401 before event persistence |

This harness deliberately does not forge a valid PayPal signature or call OrdersCapture. End-to-end capture needs PayPal Sandbox credentials and human-approved test accounts; it is not a safe background load target.

## Commands

```bash
k6 run load-tests/k6/neon-arsenal.js

LOAD_PROFILE=catalog \
BASE_URL=http://127.0.0.1:3001 \
LOAD_TARGET_RPS=20 \
LOAD_SUMMARY_PATH=artifacts/k6/catalog.json \
k6 run load-tests/k6/neon-arsenal.js

LOAD_PROFILE=orders \
ALLOW_WRITES=true \
BASE_URL=http://127.0.0.1:3001 \
CUSTOMER_EMAIL='loadtest@example.com' \
CUSTOMER_PASSWORD='replace-me' \
ORDER_LISTING_IDS='listing-a,listing-b,listing-c' \
LOAD_SUMMARY_PATH=artifacts/k6/orders.json \
k6 run load-tests/k6/neon-arsenal.js

LOAD_PROFILE=payment_replay \
BASE_URL=http://127.0.0.1:3001 \
CUSTOMER_EMAIL='loadtest@example.com' \
CUSTOMER_PASSWORD='replace-me' \
PAYMENT_ORDER_IDS='order-with-completed-link' \
k6 run load-tests/k6/neon-arsenal.js

LOAD_PROFILE=webhook_rejection \
BASE_URL=http://127.0.0.1:3001 \
k6 run load-tests/k6/neon-arsenal.js
```

Never commit credentials or generated summary JSON. Use a unique `RUN_ID` for traceability.

## Evidence outside k6

k6 reports offered/achieved RPS, latency percentiles, checks, HTTP failures and dropped iterations. It cannot prove CPU, memory, PostgreSQL connection pressure, lock waits, or database saturation alone. Collect those signals over the exact same UTC interval using the procedure in `docs/performance/load-testing.md`.
