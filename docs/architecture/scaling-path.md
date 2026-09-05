# Scaling path

Neon Arsenal stays a modular monolith on PostgreSQL until a **measured** trigger says otherwise. See `docs/performance.md` for the current numbers.

## Current shape

```text
Client  →  Express API (one or more replicas)
              →  PostgreSQL (source of truth)
              →  PayPal / Resend (timeouts, classified retries)
```

Replicas do not shard business state. Reservation, idempotency and payment confirmation are conditional writes and unique constraints. Extra API processes only add more in-process sweeps, which are already idempotent.

## What is fast enough today

At ~2.5k `ACTIVE` listings, market page index scans are ~0.02 ms; `listingsService.list` (joins + `COUNT(*)`) p95 is ~4 ms. Checkout and payment confirmation are PK/conditional updates. PayPal HTTP, not SQL, dominates payment-link latency.

## Triggers (act only when one of these is true)

| Signal | First mitigation | Still not justified |
|---|---|---|
| `GET /listings` p95 > ~50 ms and EXPLAIN shows `COUNT(*)` or deep `OFFSET` | Drop or cache `total`, or cursor pagination | Redis for the whole listing payload |
| Market must sort by price/float in SQL, not in the browser | `ORDER BY` in the API + matching `(status, price)` index | Elasticsearch |
| Expiry sweep time grows with `RESERVED` rows and the `OR expires IS NULL` plan ignores `reservationExpiresAt` | Two predicates (range vs null) | Dedicated worker queue |
| PayPal GET reconciliation lags captured orders | Tune batch/interval; keep GET retries | Kafka/SQS |
| Checkout lock waits dominate under many buyers on **different** listings | More API replicas + connection pool | Listing sharding |
| CPU/RAM of one API instance saturates on JSON/auth, DB is idle | Horizontal API replicas behind a load balancer | Microservices |

## Explicit non-goals until a trigger fires

- Redis, Kafka, RabbitMQ, SQS
- Read replicas (writes are the correctness path)
- Splitting payments or listings into their own deployable

When a trigger fires, record the measurement, the EXPLAIN, and the mitigation in `docs/performance.md` and a new ADR.
