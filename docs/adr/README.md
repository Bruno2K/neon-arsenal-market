# Architecture Decision Records

Numbered ADRs under this directory. **Do not rewrite accepted ADRs** to restyle them. Add a new ADR when a decision is missing or an old one is superseded.

Issue #71 inventory. Decisions already recorded before this change are listed, not restated.

| ADR | Decision |
|---|---|
| [0001](./0001-in-process-reservation-expiry.md) | Concurrent reserve + in-process expiry; PostgreSQL predicates |
| [0002](./0002-paypal-webhook-reliability.md) | Payment / webhook consistency; GET reconciliation |
| [0003](./0003-order-creation-idempotency.md) | Order create idempotency in PostgreSQL |
| [0004](./0004-opentelemetry.md) | Optional OpenTelemetry |
| [0005](./0005-external-retry-and-graceful-shutdown.md) | External retry classification + SIGTERM drain |
| [0006](./0006-hot-path-indexes.md) | Indexes from `EXPLAIN ANALYZE` |
| [0007](./0007-cloud-target-render.md) | Cloud = Render; PostgreSQL is SoT wherever compute runs; ECS is not live |
| [0008](./0008-c2-skip-terraform.md) | No Terraform while 0007 stands |
| [0009](./0009-prisma-domain-enums.md) | Domain enums in PostgreSQL |
| [0010](./0010-audit-log.md) | Append-only audit |
| [0011](./0011-seller-ledger.md) | Seller ledger + in-process reconcile |
| [0012](./0012-transactional-outbox.md) | In-process outbox; not a broker |
| [0013](./0013-cursor-pagination.md) | Optional keyset pagination |
| [0014](./0014-cs2sh-catalog-import.md) | cs2.sh import |
| [0015](./0015-refresh-token-families.md) | Refresh-token families |
| [0016](./0016-modular-monolith-boundaries.md) | Modular monolith + import graph |
| [0017](./0017-api-url-versioning.md) | `/api/v1` + unversioned aliases |
| [0018](./0018-redis-not-adopted.md) | **Redis not adopted** (#71) |
| [0019](./0019-async-workers-sqs-not-adopted.md) | **SQS / worker not adopted** (#71) |

PostgreSQL as source of truth is already a decision in ADR 0007 §4 and is assumed by 0001–0003, 0005, 0011, 0012, and 0016. No duplicate SoT ADR.

Diagrams: `docs/architecture/c4.md`, `docs/architecture/sequences.md`. Capacity: `docs/architecture/capacity.md`.
