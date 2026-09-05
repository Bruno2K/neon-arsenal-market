# ADR 0005 — External retry policy and graceful shutdown

## Status

Accepted

## Context

Issue #8 / roadmap P1.3 needs explicit timeouts, bounded retries, retry classification, and a process lifecycle that can drain HTTP work without adding a queue, worker fleet, or circuit breaker. PayPal `OrdersCreate` already has a timeout and must not be retried. PayPal lookups already retried 5xx/429 with linear delay. The HTTP server did not stop jobs or disconnect PostgreSQL on SIGTERM.

A circuit breaker is not justified: the failure mode is provider blips and process replacement, not a measured retry storm.

## Decision

1. Keep PostgreSQL as the source of truth. External retries never create a second local order, reservation, payment confirmation, or seller transaction.
2. Classify provider failures once:
   - retryable: timeout/abort, network, HTTP 429, HTTP 5xx;
   - not retryable: other HTTP 4xx and untagged business `AppError`s.
3. Retry only idempotent (or acceptably duplicate) calls, with max 3 attempts and exponential backoff `baseDelayMs * 2^(attempt-1)` (200ms base):
   - PayPal `OrdersGet`, OAuth token, certificate download;
   - Resend verification email (same code; a timeout after accept can send a duplicate email).
4. Do not retry `OrdersCreate` or `OrdersCapture`. A hung create is recovered by the buyer retrying with the same `Idempotency-Key` (new PayPal order is a new local payment attempt). A hung capture is recovered by the webhook or the GET reconciliation sweep.
5. On SIGTERM/SIGINT: mark the process shutting down (`GET /ready` → 503 `shutting_down`), stop in-process job timers, `server.close()` with a 10s drain then `closeAllConnections()`, disconnect Prisma, then shut down telemetry. Liveness `GET /health` stays 200 until the process exits.

Rejected alternatives: retrying every HTTP client by default; Redis/SQS for retries; a circuit breaker without evidence of retry amplification.

## Consequences

- Render/Railway can drain an instance via `/ready` while `/health` remains a liveness probe.
- Multiple replicas may still run expiry and reconciliation sweeps; those remain safe because of conditional PostgreSQL updates.
- Verification email is the only retried call with a user-visible duplicate side effect, and only of the same short-lived code.
