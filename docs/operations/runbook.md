# Operations runbook

PostgreSQL is the source of truth for listings, orders, and seller balances. PayPal is an unreliable external ledger. Production compute for the API is **Render** (`render.yaml`), not AWS/ECS.

## Deploy

API service: `neon-arsenal-api` (Docker, `server/Dockerfile`, context `server/`). Container hardening (non-root, HEALTHCHECK, Trivy, read-only limits): [`container-hardening.md`](./container-hardening.md).

1. Render builds the image, then starts the container.
2. `server/entrypoint.sh` runs `prisma migrate deploy`.
3. If `SEED_DEMO_DATA=true`, the entrypoint also runs `npm run db:seed`.
4. `node dist/index.js` starts. It binds **`0.0.0.0:$PORT`** (`PORT` is `3001` in the Blueprint). If `SEED_DEMO_DATA=true`, `index.ts` seeds again. Both passes upsert; they do not overwrite existing rows. If `CS2SH_IMPORT=true` and `CS2SH_API_KEY` is set, `index.ts` schedules the cs2.sh catalog import **after** `app.listen` so Render `GET /ready` is not blocked. Missing key logs and skips; a failed import does not prevent listen.
5. In-process jobs start after listen: reservation expiry (30s), PayPal GET reconciliation (60s), and seller ledger reconciliation (60s).

The Blueprint also defines static `neon-arsenal-web`. The public demo often uses Vercel for the Vite client and Render only for the API; set `FRONTEND_URL` on the API and `API_URL` on the frontend. Do not invent env vars.

Secrets (`PAYPAL_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `JWT_*`, `CS2SH_API_KEY`) stay in Render env / `sync: false`. Never commit them.

Rollback: Render Dashboard → previous deploy. Schema rollback is a new Prisma migration, not `migrate down`.

CI jobs, CODEOWNERS, Dependabot, and residual main-protection / staging items: [`ci-protection.md`](./ci-protection.md).

## Sandbox checkout (PayPal login)

Production `PAYPAL_MODE` is `sandbox` (`render.yaml`). Checkout uses **PayPal Sandbox**, not live PayPal. Two credential layers must both be sandbox:

1. **REST app (merchant)** — `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET` on `neon-arsenal-api` must belong to a **Sandbox** app from [developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox). A live Client ID fails sandbox OAuth with HTTP 401 `invalid_client` / `Client Authentication failed`. Checkout then never opens a valid PayPal session. After rotating secrets in the Render Dashboard, restart the API.
2. **Buyer login** — on `sandbox.paypal.com`, sign in with a **Sandbox Personal** (Buyer) account from Developer Dashboard → Sandbox → Accounts. A real PayPal email/password, Google, or Apple login does **not** work in sandbox.

Do not set `PAYPAL_MODE=production` to “make login work.” That is a live-money cutover, not a login fix. Never paste Client Secret into git, issues, or logs.

If checkout creates a local order but PayPal does not open, check API logs for `PAYPAL_CLIENT_AUTH_FAILED` (HTTP 503, no PayPal JSON in the body). The storefront maps that message to Portuguese copy when the buyer retries payment.

## PayPal webhook and capture

Buyer approval on PayPal is **not** local `PAID`. Standard Checkout stays `APPROVED` until the API calls `OrdersCapture`. The return page (`POST /payments/capture`) and the GET reconciliation sweep (APPROVED + live hold) perform that capture. `confirmPayment` still runs only when PayPal reports `COMPLETED`.

Register a **Sandbox** webhook on the same REST app as `PAYPAL_CLIENT_ID`:

1. Developer Dashboard → Apps → the sandbox app → Webhooks.
2. URL: `https://<api-host>/payments/webhook` (production API is `https://neon-arsenal-market-api.onrender.com/payments/webhook`). `POST /api/v1/payments/webhook` is the same v1 handler (SPEC-0007). This runbook does not require changing the registered PayPal URL. Do not point PayPal at the Vite/Vercel origin.
3. Subscribe at least to `PAYMENT.CAPTURE.COMPLETED`. `CHECKOUT.ORDER.APPROVED` is stored as `IGNORED` and does not sell listings.
4. Copy the webhook **ID** into Render env `PAYPAL_WEBHOOK_ID` on `neon-arsenal-market-api`, then restart. Production (`NODE_ENV=production`) rejects unsigned events when this is missing.

Webhook delivery is still required for lost return-page captures. The in-process GET sweep (60s, min age 2 minutes) recovers `COMPLETED` orders and will capture live `APPROVED` holds. A sleeping free Render instance cannot sweep until the next request wakes it.

Never paste webhook secrets or PayPal JSON into git.

## Health vs ready

The API exposes two GET routes. Render has **one** probe (`healthCheckPath`).

| Probe | Path | Success | Failure | Who uses it |
|---|---|---|---|---|
| Liveness | `GET /health` | 200 `{ status: "ok" }` even during SIGTERM drain | Process not listening | Docker `HEALTHCHECK` in `server/Dockerfile` |
| Readiness | `GET /ready` | 200 `{ status: "ready" }` when PostgreSQL answers `SELECT 1` | 503 `unavailable` (DB down) or 503 `shutting_down` (SIGTERM/SIGINT) | Render `healthCheckPath: /ready` |

Do not point Render at `/health`. That would keep a draining or DB-less instance in rotation. Do not point Docker HEALTHCHECK at `/ready`; a drain would look like a dead container and Docker would restart it mid-shutdown.

A new Render deploy does not take traffic until `GET /ready` is 2xx/3xx (Postgres up, not shutting down).

## Diagnose with request ID and trace ID

Do not search logs for emails, JWTs, PayPal access tokens, or `paypal-transmission-sig`. Use the correlation IDs the API already writes.

1. Take `X-Request-Id` from the client response header, the storefront error page, or the inbound header if the client sent one. The middleware echoes it on every response.
2. In Render logs for `neon-arsenal-api`, search that value as Pino `requestId`. The same string is `request.id` on span `http.server.request`.
3. If OpenTelemetry was on, the same log line should also have `trace_id` and `span_id` (Pino mixin when a span is active). Follow `trace_id` to child spans: `orders.create`, `payments.create_link` / `payments.capture` / `payments.confirm`, `paypal.webhook.verify` / `paypal.webhook.handle`, `paypal.*`, `db.prisma`.
4. Read `app.outcome` on the workflow span. `reservation_conflict`, `idempotency_conflict`, `idempotency_replay`, `webhook_duplicate`, `webhook_ignored`, and `reservation_expired` are expected business results (span status UNSET). `timeout`, `provider_error`, and `error` are operational (span status ERROR).
5. If the failure is payment-shaped, continue with **Inspect payments and reservations** below. `paypal.webhooks.failed` / `payments.failed` alone do not mean an outage — they also increment on capture-after-expiry.
6. If OTEL is off, stop at step 2 and use SQL + log messages (`paypal webhook received`, `paypal capture webhook processed`, `paypal reconciliation skipped: reservation expired`). There is no second correlation scheme.

Dashboard map: [`dashboards.md`](./dashboards.md). SLOs: [`slos.md`](./slos.md).

## Alert thresholds (no pager)

These are investigation triggers for a human. This repository does not add a pager, Grafana Cloud, or Prometheus.

| Signal | Threshold | First look |
|---|---|---|
| `http.server.errors / http.server.request.count` | &gt; 1% over ~15 minutes of recorded samples | SLO-AVAIL-01. Filter `http.route`. Diagnose with request ID. |
| Catalog `http.server.request.duration` p95 | &gt; 50 ms on GET `/listings` / `/products` (and `/api/v1` twins) | SLO-LAT-CATALOG. `docs/architecture/scaling-path.md`. |
| `POST /orders` duration p95 | &gt; 1 s | SLO-LAT-CHECKOUT-RESERVE. `orders.create` + `db.prisma`. |
| `paypal.client.request.duration` p95 | &gt; 8 s | Approaching 10 s timeout. PayPal sandbox/live health. |
| `paypal.client.timeouts` | Any point in 15 minutes | 504 path. Do not retry `OrdersCreate` / `OrdersCapture`. |
| `paypal.client.errors` ratio | &gt; 5% of `paypal.client.request.count` | SLO-ERR-PAYPAL. Check `PAYPAL_CLIENT_AUTH_FAILED` in logs. |
| `seller.ledger.drift_detected` | Any increment | Ledger span + `SellerTransaction` SUM. Correction should follow (`seller.ledger.corrected`). |
| `outbox.failed` | Any increment | `outbox.dispatch` retries exhausted. Rows stay in PostgreSQL. |
| `db.client.errors` | Any increment | Prisma exceptions. No SQL text in spans — use Render logs. |
| `paypal.webhooks.failed` | Rising while `app.outcome` is not `reservation_expired` | Verify `PAYPAL_WEBHOOK_ID`, signature, `order_not_resolved` (503). |
| Pending PayPal orders older than 5 minutes | SQL count &gt; 0 and not dropping | Instance asleep, GET sweep stuck, or capture-after-expiry. |

Render free-tier spin-down produces **no** metric samples. A silent dashboard is not “100% available.”

## Shutdown drain

On SIGTERM/SIGINT (`docs/adr/0005-external-retry-and-graceful-shutdown.md`):

1. Mark shutting down → `GET /ready` is 503 `shutting_down`.
2. Stop reservation-expiry, PayPal-reconciliation, seller-ledger-reconciliation, and outbox-dispatcher timers (in-flight sweeps may finish).
3. `server.close()`: no new HTTP connections; in-flight requests get **10s** (`SHUTDOWN_DRAIN_MS`), then remaining connections are closed.
4. Disconnect Prisma.
5. Shut down OpenTelemetry exporters.

`GET /health` stays 200 until exit.

Render `maxShutdownDelaySeconds` is **30** in `render.yaml` (platform default). The app drain is 10s, so the platform wait is enough. If Render SIGKILLs before 10s, in-flight HTTP is dropped; payment recovery is still webhook + GET reconciliation.

Zero-downtime: Render starts the new instance, waits for `/ready`, shifts traffic, then SIGTERM on the old instance. Failed `/ready` on the old instance after SIGTERM is expected.

## Seed on boot (`SEED_DEMO_DATA`)

Existing env var. Do not add another.

| Value | Effect |
|---|---|
| `true` (current Blueprint) | Demo catalog upserts on every boot (entrypoint + `index.ts`). Portfolio/demo only. |
| unset / not `true` | No seed. Use this for a real marketplace. |

Re-running seed is idempotent. It still touches the database on every deploy when `true`. To stop seeding, set `SEED_DEMO_DATA` to a value other than `true` in Render (or change the Blueprint). Do not invent `SEED_ON_MIGRATE`.

## cs2.sh catalog import (`CS2SH_IMPORT` / `CS2SH_API_KEY`)

Optional. Populates `Product` from `GET https://api.cs2.sh/v1/schema` (tradable skins) and USD reference asks from `GET /v1/prices/latest`. State lives in PostgreSQL; the Render disk is ephemeral and irrelevant.

Render **web services have no SSH/shell**. Do not plan on `npm run import:cs2sh` in production. Use Dashboard env + HTTP:

1. Render Dashboard → `neon-arsenal-api` → Environment → set `CS2SH_API_KEY` (sync: false). Redeploy if the instance started without the key.
2. Trigger import without a shell:
   - Log in as **ADMIN** and open **Catálogo** (`/admin/catalog`), or click **Importar catálogo** on `/admin`, or `POST /admin/catalog/cs2sh-import` (202, runs in the background).
   - Or set `CS2SH_IMPORT=true` and redeploy. Boot schedules the same work **after listen** so `/ready` stays fast.
3. Poll `GET /admin/catalog/cs2sh-import` (or the admin card) until `running` is false.

| Env | Effect |
|---|---|
| `CS2SH_API_KEY` | Bearer token. Required for import. Never commit. |
| `CS2SH_IMPORT=true` | After listen, start one in-process import. Without a key, logs and skips. Does not block `/ready`. |
| unset / not `true` | No boot import. Use ADMIN POST (Render) or `cd server && npm run import:cs2sh` (local). |

`POST` without a key is **503**. A second `POST` while this process is still importing is **409**. Restart loses in-process status; catalog rows in Postgres remain.

`referencePriceUsd` is **not** a PayPal/ledger amount (ADR 0014/0022).
Re-running the import upserts products only; it never creates or reprices listings.

## Inspect payments and reservations

Listings: `ACTIVE → RESERVED → SOLD` (or back to `ACTIVE` on expiry). Payment confirmation cannot sell an expired or re-reserved listing.

```sql
-- Holds that should expire
SELECT id, status, "reservedByOrderId", "reservationExpiresAt"
FROM "Listing"
WHERE status = 'RESERVED'
ORDER BY "reservationExpiresAt";

-- Unpaid orders still pending vs cancelled after expiry sweep
SELECT id, status, "paymentStatus", "paypalOrderId", "updatedAt"
FROM "Order"
WHERE "paymentStatus" = 'PENDING'
ORDER BY "updatedAt" DESC
LIMIT 50;

-- Webhook outcomes
SELECT "externalEventId", "eventType", status, "failureReason", "orderId", "receivedAt"
FROM "PaymentWebhookEvent"
ORDER BY "receivedAt" DESC
LIMIT 50;
```

Logs (no secrets): `paypal webhook received`, `paypal capture webhook processed`, `paypal webhook duplicate ignored`, `paypal webhook not applied: reservation expired`, `paypal reconciliation skipped: reservation expired`, `seller ledger projection drifted; corrected to PAID SUM`, `graceful shutdown started`.

Capture after the reservation TTL is a split-brain with PayPal. Procedure: **Capture after reservation expiry** below.

---

## Capture after reservation expiry

PayPal can capture funds after the local reservation TTL has elapsed. The marketplace **must not** mark the listing `SOLD` or pay the seller. That invariant is already implemented (`confirmPayment` 409 + webhook HTTP 200). Returning the money is **not** implemented in this repository.

### Code inspection (do not invent an API)

Inspected:

- `server/src/shared/utils/paypal.ts` — `createPayPalOrder`, `capturePayPalOrder`, `getPayPalOrder`. No refund/void function.
- `server/src/types/paypal.d.ts` — only OrdersCreate and OrdersCapture types.
- `server/src/modules/payments/payments.service.ts` — expired capture → webhook event `FAILED` / `reservation_expired`; reconciliation skips the same 409.
- No `PAYPAL_*` refund environment variable exists.

Do not add a PayPal refund client, capture-void helper, or new env var until a human selects a provider contract.

### How to detect

1. Logs: `paypal webhook not applied: reservation expired` or `paypal reconciliation skipped: reservation expired`.
2. Database:

```sql
SELECT e."externalEventId", e.status, e."failureReason", e."orderId",
       o."paypalOrderId", o.status AS order_status, o."paymentStatus",
       i."listingId"
FROM "PaymentWebhookEvent" e
JOIN "Order" o ON o.id = e."orderId"
JOIN "OrderItem" i ON i."orderId" = o.id
WHERE e."failureReason" = 'reservation_expired'
ORDER BY e."receivedAt" DESC;
```

3. Confirm the listing is **not** `SOLD` and there is **no** `SellerTransaction` for that `orderId`.
4. In the PayPal account (sandbox or live, matching `PAYPAL_MODE`), open the captured payment for `Order.paypalOrderId`. If PayPal shows captured funds, local and remote ledgers disagree.

### What to do (manual, out of band)

Until the HUMAN decision below is answered:

1. Do **not** set `Listing.status = SOLD`.
2. Do **not** set `Order.paymentStatus = PAID` or create a `SellerTransaction`.
3. Do **not** call undocumented PayPal URLs from this app.
4. If funds were captured, reverse them in the **PayPal account UI** for that capture / order id (the same dashboard used to inspect sandbox or live payments). This runbook does not specify a REST path or request body; that would be inventing a contract this repo does not implement.
5. After a dashboard reversal, local rows stay `PENDING` / `CANCELLED` and `FAILED`. There is no local `REFUNDED` write path. Leave them; the listing is already eligible for another buyer once `ACTIVE`.
6. If the listing is still `RESERVED` with `reservationExpiresAt` in the past, the in-process expiry sweep (30s) will release it. Do not force `SOLD`.

### What not to do

- Replay the webhook hoping it will sell the listing. It will 409 again and stay `FAILED`.
- Rely on GET reconciliation to fix money. It will skip the 409 forever.
- Implement `OrdersCapture` retries or a new refund helper as part of incident response.

### HUMAN decision (required before any refund code)

1. **Decision:** Should capture-after-expiry stay dashboard-only, or should the API reverse funds automatically?
2. **Options:**
   - A. Dashboard only (current). Operators follow this runbook. No new PayPal contract in the repo.
   - B. Automated reverse, but only after documenting the **existing** PayPal API the account actually supports (refund vs void vs other), with timeout/idempotency, in a new activity — not guessed here.
3. **Consequences:** A leaves rare captured-but-unsold money as a manual process. B without an inspected contract risks calling the wrong PayPal operation (voiding an already-captured order, double-refund, or marking `SOLD` incorrectly).
4. **Recommendation:** Keep **A** until someone inspects the live/sandbox PayPal account and names the exact API. R2 must not guess.

See also `docs/architecture/failure-modes.md` and `docs/adr/0002-paypal-webhook-reliability.md`.
