# Service level objectives

Portfolio / demo **proposed operational targets** for Neon Arsenal Market. They are **not** a paid customer SLA and are not claims that production has achieved these targets. Every SLI names an instrument that exists today in `server/src/shared/observability/`, or is marked unmeasurable with an existing proxy.

Contract: `SPEC-0008`. Panels: [`dashboards.md`](./dashboards.md). Performance evidence: [`../performance.md`](../performance.md). Scaling triggers: [`../architecture/scaling-path.md`](../architecture/scaling-path.md).

Window: **30 days of recorded samples**. If `OTEL_ENABLED` is false, these SLIs have no time series; use Render logs and SQL only.

Evidence boundary at PR12: code/tests prove the instruments and controlled failure behavior; one point-in-time remote check proves only that the public endpoints answered. No sustained production OTLP series was available, so every numeric value below remains a target awaiting observation.

## What “availability” means here

| Included | Excluded |
|---|---|
| HTTP requests that emit `http.server.request.count` | `/health`, `/ready` (not instrumented) |
| 5xx via `http.server.errors` | 4xx business results (401, 404, 409 conflict/expiry, validation) |
| Time the process is awake and exporting | Render free-tier spin-down (no samples) |
| | Storefront / Vercel / PayPal website availability |

`app.outcome` values such as `reservation_conflict`, `idempotency_conflict`, and `reservation_expired` are correct business answers. They must not burn the availability error budget.

## SLO catalog

### SLO-AVAIL-01 — Recorded HTTP availability

| Field | Value |
|---|---|
| SLI | `1 - sum(http.server.errors) / sum(http.server.request.count)` |
| Target | **99.0%** over 30 days of recorded requests |
| Dashboard | [API](./dashboards.md#dashboard-1--api) |
| Why this number | No production baseline exists. 99.0% is an initial operating target for a single Render instance, not 99.9% (that would require traffic history this repo does not have). |
| Error budget | 1.0% of recorded HTTP requests may be 5xx in the window |

Probe failures on `GET /ready` are a Render rotation signal, not this SLI.

### SLO-LAT-CATALOG — Catalog read latency

| Field | Value |
|---|---|
| SLI | p95 of `http.server.request.duration` (seconds) where `http.request.method=GET` and `http.route` is a catalog route below |
| Target | **p95 &lt; 50 ms** |
| Dashboard | [API](./dashboards.md#dashboard-1--api) |
| Why this number | Existing scaling trigger in `docs/architecture/scaling-path.md`. Local evidence: `listingsService.list` p95 ~4 ms at 2.5k listings (`docs/performance.md`). |
| Routes | `/listings`, `/listings/:id`, `/products`, `/products/:id`, and the same four under `/api/v1` |

If p95 crosses 50 ms, follow the scaling-path mitigation (cursor pagination / drop `COUNT(*)`). Do not add Redis.

### SLO-LAT-CHECKOUT-RESERVE — Order create latency

| Field | Value |
|---|---|
| SLI | p95 of `http.server.request.duration` where `http.request.method=POST` and `http.route` is `/orders` or `/api/v1/orders` |
| Target | **Watch: p95 &lt; 1 s** |
| Dashboard | [API](./dashboards.md#dashboard-1--api), [Orders](./dashboards.md#dashboard-2--orders-and-reservations) |
| Why this number | The path is PK / conditional `UPDATE` (`docs/performance.md`). There is no production p95. 1 s is a coarse watch so a lock-contention or event-loop stall is visible. It is not a customer SLA. |
| Trace | `orders.create` → `orders.create.transaction` → `listings.reserve` |

### SLO-LAT-PAYPAL-HTTP — PayPal client latency

| Field | Value |
|---|---|
| SLI | p95 of `paypal.client.request.duration` (seconds) |
| Target | **p95 &lt; 8 s** (80% of `DEFAULT_PAYPAL_API_TIMEOUT_MS` = 10 s) |
| Dashboard | [Payments](./dashboards.md#dashboard-3--payments) |
| Why this number | Derived from the existing timeout in `server/src/shared/config/paypal.ts`, not from invented traffic. Crossing 8 s means we are near 504 `timeout`. |
| Companion | `paypal.client.timeouts` should stay at 0 in a healthy window; any timeout is an investigation |

`POST /payments/create` and `POST /payments/capture` HTTP p95 are dominated by this client, not by PostgreSQL.

### SLO-ERR-PAYPAL — PayPal client error ratio

| Field | Value |
|---|---|
| SLI | `(paypal.client.errors + paypal.client.timeouts) / paypal.client.request.count` |
| Target | **&lt; 5%** over 30 days of recorded PayPal calls |
| Dashboard | [Payments](./dashboards.md#dashboard-3--payments) |
| Why this number | Provider unreliability is expected (`docs/architecture/failure-modes.md`). 5% is an operating watch until OTLP production samples exist. Sandbox auth failures (`PAYPAL_CLIENT_AUTH_FAILED`) will burn this budget. |

Do **not** use `payments.failed` or `paypal.webhooks.failed` as this SLI. Both increment on expected `reservation_expired`.

### SLO-RECONCILE — Reconciliation freshness (proxy)

| Field | Value |
|---|---|
| Requested SLI | Lag from PayPal `COMPLETED` to local `PAID` |
| Measurable today? | **No.** There is no lag histogram or pending-age gauge. |
| Proxy | Config floor + span `payments.reconcile` duration + `paypal.client.request.duration` `{paypal.operation=orders_get}` |
| Operating expectation | Orders younger than **2 minutes** are ignored (`PAYPAL_RECONCILE_MIN_AGE_MS`). The next sweep is at most **60 s** later (`PAYPAL_RECONCILE_INTERVAL_MS`), batch 20. A sleeping free Render instance adds unbounded delay until wake. |
| Dashboard | [Reconciliation](./dashboards.md#dashboard-5--reconciliation-and-ledger) |
| SQL proxy | Count `Order` rows with `paymentStatus = PENDING`, non-null `paypalOrderId`, `updatedAt` older than 5 minutes (runbook). That query is the operator lag signal. |

### SLO-CHECKOUT-CORRECTNESS — Consistent completed checkout

| Field | Value |
|---|---|
| SLI | completed trusted payment workflows with consistent local terminal state / all trusted payment workflows inspected |
| Proposed target | **100%**; any paid/canceled listing mismatch, duplicate economic effect, or missing required refund obligation is a correctness incident |
| Measurement source | PostgreSQL invariant queries and reconciliation results; `payments.confirmed`, webhook outcomes, refund/outbox/ledger evidence are diagnostics, not a complete denominator |
| Measurable today? | **Partially.** Integration and concurrency tests prove controlled cases. There is no production consistency scanner producing this ratio. |
| Exclusions | buyer abandonment before trusted capture; rejected/expired reservations that correctly create the required refund obligation |

Correctness is not traded as an availability error budget. One confirmed inconsistency stops feature work and triggers incident investigation.

### SLO-REFUND-RECONCILE — Eligible refund terminal outcome

| Field | Value |
|---|---|
| SLI | eligible refund obligations reaching `COMPLETED` or explicit operator-required terminal handling / eligible refund obligations attempted |
| Proposed target | **99% within 24 hours**, with **100%** of unresolved obligations older than 24 hours emitting operator-required evidence |
| Measurement source | refund reconciliation counters plus PostgreSQL `Refund` age/status query in the runbook |
| Measurable today? | **Partially.** Counters have no age labels; SQL supplies the durable population. Production OTLP observation is not proven. |
| Exclusions | obligations younger than their configured retry eligibility and provider incidents still inside the 24-hour operator threshold |

### SLO-READY — Readiness success

| Field | Value |
|---|---|
| SLI | successful `/ready` probe results / total `/ready` probe attempts while the service is expected to accept traffic |
| Proposed target | **99.0% over 30 days**, excluding intentional deploy drain |
| Measurement source | Render health-check history, if retained by the provider; direct checks are point-in-time samples only |
| Measurable today? | **No repository time series.** Probe routes intentionally do not emit application HTTP metrics. Controlled tests prove 200/503 semantics. |
| Exclusions | intentional SIGTERM/SIGINT drain; periods where a free instance is deliberately spun down are reported separately, not silently counted as success |

### Unmeasurable: buyer payment confirmation time

Time from buyer approval to local `PAID` is not a histogram. Proxies when traces are exported:

- span `payments.capture` or `paypal.webhook.handle` duration (request-scoped, not end-to-end);
- span `payments.confirm` duration (local claim/sell/ledger only).

Do not invent a “p95 payment confirmation = N seconds” SLO until a dedicated instrument exists.

## Error budget

**Budget:** for SLO-AVAIL-01, **1.0%** of recorded HTTP requests in the last 30 days may be 5xx.

```text
error_budget_remaining =
  1 - (sum(http.server.errors) / (0.01 * sum(http.server.request.count)))
```

When `http.server.request.count` is 0 (OTEL off, or no traffic), the budget is **undefined**. Do not treat that as 100% healthy.

### How to spend it

| Remaining budget | Action |
|---|---|
| &gt; 50% | Normal feature work |
| 10–50% | Prefer reliability fixes on the burning route (`http.route`) |
| &lt; 10% or exhausted | Freeze non-correctness work. Diagnose with [`runbook.md`](./runbook.md#diagnose-with-request-id-and-trace-id). |

Latency SLOs do not share this numeric budget. A catalog p95 breach is the scaling-path trigger, not an availability burn. PayPal timeout burns SLO-ERR-PAYPAL and should be investigated even if HTTP 5xx stay inside SLO-AVAIL-01 (some PayPal failures map to 502/504 and will burn both).

## Mapping cheat sheet

| SLO | Primary instrument | Dashboard |
|---|---|---|
| SLO-AVAIL-01 | `http.server.errors`, `http.server.request.count` | API |
| SLO-LAT-CATALOG | `http.server.request.duration` | API |
| SLO-LAT-CHECKOUT-RESERVE | `http.server.request.duration` | API + Orders |
| SLO-LAT-PAYPAL-HTTP | `paypal.client.request.duration` | Payments |
| SLO-ERR-PAYPAL | `paypal.client.errors`, `paypal.client.timeouts`, `paypal.client.request.count` | Payments |
| SLO-RECONCILE | *(unmeasurable)* proxy: `payments.reconcile` + SQL | Reconciliation |
| SLO-CHECKOUT-CORRECTNESS | PostgreSQL invariant review + reconciliation evidence | Runbook |
| SLO-REFUND-RECONCILE | `refund.reconciliation.*` + SQL age/status query | Reconciliation |
| SLO-READY | Render probe history (not app telemetry) | Render + runbook |
