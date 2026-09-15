# Production and operational proof (PR12)

## Scope and conclusion

PR12 asks whether a senior engineer on call can understand service health, diagnose important failure modes, recover safely, and distinguish evidence from assumptions. For the current modular monolith, the answer is **yes for repository-defined and controlled recovery paths, with explicit provider-level limits**. Health/readiness, transaction and idempotency behavior, payment/refund/outbox recovery, deploy boundaries, and investigation procedures are executable or documented. Exact Render deploy SHA, production OTLP reception, managed backup status, and sustained production SLO attainment remain not proven.

This PR changes documentation only. It does not change domain semantics, public APIs, database schema, instrumentation code, deployment providers, or architecture. AUD-002, AUD-020, AUD-021, AUD-030, AUD-032, and AUD-033 remain frozen limitations. PR13 is not started.

## Baseline and evidence classes

- Baseline: `a298d61c2bf185534c93fdafa21e868a3b66a1d5`, fetched `origin/main`, merge commit for PR #260.
- Branch: `ops/pr12-production-operational-proof`.
- Execution window: 2026-09-14 America/Sao_Paulo / 2026-09-15 UTC.
- Evidence labels used here: **code/static**, **automated test**, **integration/runtime**, **controlled game day**, **remote deployment**, and **manual review**.

Repository or provider configuration is not live proof. A test is not production proof. A successful point-in-time probe is not an uptime history. A target is not an achieved SLO.

## Operational gap matrix

| ID | Area | Current evidence | Gap | Classification | Evidence/fix in PR12 |
|---|---|---|---|---|---|
| OPS-001 | PR11 baseline | Fresh fetch and public GitHub merge/main metadata | None | PASS | Exact baseline and green main runs recorded |
| OPS-002 | Topology/identity | Vercel/Render config, ADR 0007, live endpoints | Blueprint resource and live hostname differ | PR12 | Active deployment doc distinguishes desired resource from observed hostname |
| OPS-003 | Vercel | GitHub Production deployment for exact main SHA; stable alias 200 | Dashboard settings not inspected | PASS | Bounded remote evidence recorded |
| OPS-004 | Render | Public `/health` and `/ready` 200 with Render headers | Exact deploy SHA/resource id unavailable without account access | BLOCKED | Live HTTP scope recorded; no exact-SHA claim |
| OPS-005 | Health/readiness | Code, tests, Docker/Blueprint, live probes | Dependency-loss result lacked current execution | PR12 | Game Day A executed |
| OPS-006 | Signals | Existing metrics/logs/spans cover critical flows | Inventory and production-observation state fragmented | PR12 | Canonical `signal-inventory.md` added |
| OPS-007 | Correlation | Request/trace context, safe IDs, redaction tests | Production OTLP destination/reception unavailable | BLOCKED | Static/test chain recorded; production export remains unproven |
| OPS-008 | SLI/SLO | Existing availability/latency/provider targets | Correctness/readiness/refund terminal targets incomplete | PR12 | Proposed targets added; no attainment claim |
| OPS-009 | Capacity | Repeated controlled CI load evidence | Needed an on-call envelope | PR12 | Measured boundary and triggers summarized below |
| OPS-010 | Game days | Existing focused failure tests | No single current execution record | PR12 | Five controlled exercises executed and recorded |
| OPS-011 | Failure modes | Architecture narrative | Operator matrix incomplete | PR12 | Canonical matrix added to `failure-modes.md` |
| OPS-012 | Order investigation | Separate payment/refund queries | No one-path “order X” workflow | PR12 | Evidence-first workflow added to runbook |
| OPS-013 | Deploy/recovery | Entrypoint, forward migrations, drain, provider rollback | Compatibility and decision gates incomplete | PR12 | Pre-deploy/rollback/migration gates added |
| OPS-014 | Backup/restore | Blueprint declares Free Postgres | Actual live plan/backup schedule/restore unverified | PR12 | Honest posture and proposed RPO/RTO added |
| OPS-015 | Operational security | Threat model, tests, scan gates, redaction | Provider access/telemetry/backup operations needed review | PR12 | Focused review added; account-only items not proven |
| OPS-016 | PR11 frozen backlog | Audit classifications | Not authorized | OUT-OF-SCOPE | Limitations retained; no implementation |
| OPS-017 | Architecture expansion | ADR 0007/0016 and measured capacity | No measured need | OUT-OF-SCOPE | No Redis/Kafka/Kubernetes/microservices/AWS rewrite |
| OPS-018 | New critical defect | Pre-edit audit | None found | PASS | No stop-condition P0 discovered |

## Production topology and remote evidence

```text
Browser
  -> Vercel React/Vite frontend
  -> Render public host neon-arsenal-market-api.onrender.com
  -> Render PostgreSQL declared as neon-arsenal-db

External: PayPal Sandbox, Resend, optional cs2.sh
```

Identity is now explicit:

- `neon-arsenal-api` is the Blueprint and default OTel service name (**code/static**).
- `neon-arsenal-market-api.onrender.com` is the observed public API hostname (**remote deployment**).
- `neon-arsenal-market.vercel.app` is the repository homepage/stable frontend alias (**remote deployment**).

Remote observations:

| Time (UTC) | Surface | Observation | What it proves | What it does not prove |
|---|---|---|---|---|
| 2026-09-15 00:54 | GitHub | Main commit API reports `a298d61`; PR #260 merged at that SHA | PR11 is in current public main | Local/provider deploy state |
| 2026-09-15 00:54-00:57 | GitHub Actions | CI run `34915100874` success; repository verification `34915101122` success | Baseline automated gates passed | Production behavior |
| 2026-09-15 00:54 | GitHub deployment/Vercel | Deployment `6449424456`, Production, success, exact SHA `a298d61`; generated URL recorded by GitHub | Vercel reported a successful production deployment of baseline | Render state or sustained frontend availability |
| 2026-09-15 01:18 | Render API | `/health` 200 `{"status":"ok"}`, `x-render-origin-server: Render`, request id returned | Process answered through the documented Render host | Exact deploy SHA, DB health, uptime history |
| 2026-09-15 01:18 | Render API | `/ready` 200 `{"status":"ready"}` | At that instant the process was not draining and PostgreSQL answered `SELECT 1` | Future readiness or DB durability |
| 2026-09-15 01:19 | Vercel alias | `https://neon-arsenal-market.vercel.app/` 200, `Server: Vercel` | Stable frontend alias served HTML | Browser checkout or backend correctness |

References: [PR #260](https://github.com/Bruno2K/neon-arsenal-market/pull/260), [main CI](https://github.com/Bruno2K/neon-arsenal-market/actions/runs/34915100874), [repository verification](https://github.com/Bruno2K/neon-arsenal-market/actions/runs/34915101122), [Vercel production deployment](https://neon-arsenal-market-o1vq3nn9g-bruno2ks-projects.vercel.app), [stable frontend](https://neon-arsenal-market.vercel.app), [API health](https://neon-arsenal-market-api.onrender.com/health), [API readiness](https://neon-arsenal-market-api.onrender.com/ready).

Authenticated Render/Vercel dashboards were not available in the execution environment. Public GitHub deployment metadata was sufficient for Vercel SHA proof. Render exposes health headers but not deploy SHA or Dashboard resource identity, so those remain blocked rather than guessed.

## Health and readiness

`/health` is liveness: 200 while the process can answer, including during drain. It does not query PostgreSQL. `/ready` is traffic readiness: 503 while draining, otherwise `SELECT 1`; database error returns 503 `unavailable`. Render probes `/ready`; the container health check uses `/health`.

Evidence:

- **code/static:** `health.routes.ts`, `server/Dockerfile`, `render.yaml` agree.
- **automated test / controlled game day:** Game Day A passed all five route tests, including DB rejection -> 503 and drain -> 503.
- **remote deployment:** both routes returned 200 at one instant with the scopes above.

## Operational signals and correlation

The canonical inventory is [`docs/operations/signal-inventory.md`](../operations/signal-inventory.md). It maps every required HTTP, reservation, expiry, payment, provider, webhook, refund, reconciliation, ledger, outbox, and database signal to its emission site, attributes, operator question, and production-observation status.

The request correlation path is response `X-Request-Id` -> Pino `requestId` -> span `request.id` -> `trace_id`/`span_id` -> safe order/refund/provider identifiers -> durable PostgreSQL rows. Background jobs begin with their span/log and pivot on durable IDs. Metric labels contain no entity IDs. Production log output is proven only by code and controlled runs; production OTLP export/reception is **not proven**.

## Proposed SLI/SLO targets

All use a 30-day observation window unless stated otherwise and remain proposed targets:

| SLI | Proposed target | Current evidence boundary |
|---|---|---|
| Recorded HTTP availability | 99.0% of eligible recorded requests non-5xx | Instruments/tests exist; no production series |
| Catalog latency | p95 < 50 ms | Controlled CI exceeded the offered-load goal at 150 RPS; not production |
| Checkout reserve latency | p95 < 1 s watch threshold | Instrument exists; no production p95 |
| PayPal client latency/error | p95 < 8 s; errors+timeouts < 5%; any timeout investigated | Failure policy/tests exist; no production series |
| Checkout correctness | 100% of inspected trusted workflows free of local inconsistency | Controlled concurrency/integration tests; no production ratio scanner |
| Reconciliation health | 99% of eligible refunds terminal/explicitly handled within 24h; 100% aged ambiguity signals operator-required | Counters + SQL population; no production series |
| Readiness | 99.0% while expected to serve, excluding intentional drain | Controlled semantics + point-in-time 200; no probe history |

Availability error budget is 1% of eligible recorded requests. A correctness inconsistency has no budget: one confirmed case is an incident. Zero samples means undefined, not 100%. Full definitions: [`slos.md`](../operations/slos.md).

## Capacity envelope

Reused evidence; no PR12 load rerun:

- **integration/runtime, controlled GitHub Actions:** one frozen API image; API 1 CPU/512 MiB; PostgreSQL 1 CPU/1 GiB; catalog browse at configured 150 RPS for 60 seconds; three serial repetitions; zero HTTP failures and dropped iterations; p95 5.81-6.08 ms; p99 10.81-12.27 ms; API CPU 67.06-72.74%.
- Repeated 200 RPS was unstable: latency thresholds failed and iterations dropped while API CPU approached its limit; PostgreSQL stayed in the low teens.
- First measured boundary: API CPU in that controlled environment. This is not a Render or production capacity claim.
- Scale only after observing sustained CPU/latency or job lag: first test more API CPU/instances within PostgreSQL connection limits; profile DB only if query/lock/I/O evidence moves the bottleneck; consider external workers/shared rate limiting only after sustained coordination evidence. No Redis/Kafka/microservices are justified now.

Source: [`load-test-report-2026-09-10-catalog.md`](../performance/load-test-report-2026-09-10-catalog.md).

## Controlled game days

All exercises ran against unit doubles or the repository's isolated `postgres:16-alpine` tmpfs test database at `localhost:5433`. No production dependency was broken or mutated.

| Game day | Environment and command | Result | Proven boundary |
|---|---|---|---|
| A — PostgreSQL unavailable | Unit HTTP harness; `npm test --prefix server -- --run src/shared/routes/__tests__/health.test.ts` | PASS, 1 file / 5 tests | `/health` stays liveness; DB rejection and drain make `/ready` 503 |
| B — PayPal timeout/provider failure | Test doubles; `npm test --prefix server -- --run ...paypal.failure-recovery.test.ts ...paypal.http.test.ts` | PASS, 2 files / 13 tests | Bounded read retries, 504 timeout mapping, later recovery; mutating calls are not blindly retried |
| C — duplicate webhook | Real PostgreSQL; focused webhook integration suite | PASS, 1 file / 13 tests | Sequential/concurrent duplicates converge without duplicate economic effect; duplicate log path executes |
| D — refund recovery | Real PostgreSQL + provider double; focused refund reconciliation suite | PASS, 1 file / 13 tests | pending/retry/terminal/operator outcomes, remote-success/local-crash recovery, stable request identity, one ledger reversal |
| E — durable work interruption | Real PostgreSQL; focused outbox integration suite | PASS, 1 file / 8 tests | stale PROCESSING reclaim, retry/terminal failure, duplicate publication guard, durable restart behavior |

The first attempt to run the game days was blocked by Windows filesystem sandbox permissions before tests executed. The retry used approved npm access. Database preparation also first read a placeholder `.env` `DATABASE_URL`; the corrected focused runs set both `TEST_DATABASE_URL` and `DATABASE_URL` to the isolated database. This retry history is tooling evidence, not an application failure.

## Failure, investigation, and recovery

The canonical operator matrix is [`failure-modes.md`](../architecture/failure-modes.md#operator-failure-mode-matrix). It covers DB loss, PayPal timeout and lost response, duplicate/invalid webhook, reservation expiry during payment, refund states, remote-success/local-failure, interrupted reconciliation/outbox, email failure, and restart.

The runbook now provides one evidence-first order workflow: local order/items -> reservation -> exact PayPal order/capture -> webhook evidence -> refund identity -> seller ledger -> reconciliation/outbox -> healthy/retryable/refund-pending/operator-required/externally-blocked classification. Normal recovery never starts with manual SQL. Exceptional correction requires human approval, reviewed transaction procedure, and retained before/after evidence.

Deploy safety is migration-first, then application startup/readiness and traffic. Application rollback is allowed only if the applied schema remains compatible with the old image. Schema rollback is a reviewed forward migration; Render build rollback does not roll back PostgreSQL. No automated rollback is claimed and no live rollback was performed.

## Backup/restore posture

`render.yaml` declares Free Postgres. Render's provider documentation states Free Postgres has no managed backups, logical exports, or PITR. The live Dashboard plan was not accessible, so the actual live plan and backup state remain **NOT PROVEN**.

The runbook separates application rollback, forward migration repair, database restore, and logical reconciliation. For a declared Free instance, a proportional future control is an encrypted scheduled `pg_dump` to restricted external storage plus periodic restore into an empty isolated database. It is not implemented. Proposed, unachieved objectives are RPO 24 hours and RTO 4 hours. PR12 did not perform a destructive production restore or claim that either objective was met.

Provider references reviewed 2026-09-15: [Render recovery and backups](https://render.com/docs/postgresql-backups), [Render Free limitations](https://render.com/docs/free), and [Render rollbacks](https://render.com/docs/rollbacks).

## Operational security review

**Manual review** found no new serious vulnerability. The threat model now explicitly covers deployment secrets, auth/admin boundaries, webhook trust, financial operator actions, rate-limit identity, private data, telemetry leakage, CI artifacts, backup access, and dependency scanning. Code/tests continue to prove production JWT fail-closed behavior, webhook verification, role/ownership controls, bounded provider I/O, and telemetry redaction.

Account-only controls remain not proven: Render/Vercel workspace membership and credential rotation, telemetry destination/retention/access, CI artifact retention settings, actual DB plan, and backup credential/storage controls. The declared Free backup gap is the largest operational limitation; it does not justify an AWS rewrite.

## Production-readiness checklist

| Area | Item | Status | Evidence/boundary |
|---|---|---|---|
| Correctness | Reservation/payment/refund/ledger/outbox invariants | PASS | PostgreSQL suites including PR12 game days |
| Security | Authz, webhook trust, production secrets, redaction | PASS | Code/tests/threat model; provider account permissions separate |
| Security | Provider workspace membership/rotation review | NOT PROVEN | Authenticated dashboards unavailable |
| Data | PostgreSQL is transactional source of truth; forward migrations | PASS | Prisma schema/migrations/entrypoint/runbook |
| Data | Recoverable production backup and timed restore | NOT PROVEN | Declared Free plan has no managed recovery; no external dump automation |
| Deployment | Vercel exact-baseline production deployment | PASS | GitHub deployment `6449424456` |
| Deployment | Render exact deployed SHA/dashboard service id | NOT PROVEN | Public host/probes only |
| Deployment | Rollback and migration compatibility procedure | PASS | Runbook; procedure not live-exercised |
| Observability | Structured logs, request/trace context, critical metrics/spans | PASS | Code/static + automated telemetry tests |
| Observability | Production OTLP reception/dashboard history | NOT PROVEN | No authenticated collector/provider evidence |
| Health | Liveness/readiness semantics | PASS | Code, tests, Game Day A, point-in-time remote probes |
| Payments | Provider trust, duplicate webhook, capture/refund recovery | PASS | Game Days B-D and existing integration tests |
| Reconciliation | Bounded payment/refund/ledger/outbox recovery | PASS | Code/tests and operator queries |
| Reconciliation | AUD-021 deeper capture sweep coverage | PARTIAL | Explicit frozen limitation |
| Recovery | Restart/stale-claim safety | PASS | Game Days D/E and lifecycle tests |
| Performance | Controlled 150 RPS capacity evidence | PASS | CI artifacts/report; not production capacity |
| Performance | Production capacity/traffic history | NOT PROVEN | No sustained production measurement |
| Documentation | Topology, signals, SLOs, failure/recovery, investigation | PASS | Active docs updated by PR12 |
| Known limitations | AUD-002/020/021/030/032/033 | PARTIAL | Frozen; documented, not opportunistically implemented |

## Explicit limitations

- Exact Render deploy SHA and Dashboard service/database identities are not publicly observable and were not verified with authenticated access.
- Production OTLP enablement, delivery, retention, dashboards, and alert routing are not proven. There is no pager.
- The Blueprint declares Free Postgres; managed recovery is unavailable at that plan and no external backup automation/restore test exists.
- Free web-service sleep creates unmeasured gaps and delays in-process reconciliation until wake.
- Readiness and durable backlog/age are provider/SQL signals, not application time-series metrics.
- AUD-020 OrdersCreate remote-success/local-persistence-crash recovery and AUD-021 deeper capture selection remain frozen limitations.
- The controlled capacity boundary is not a production throughput guarantee.
- No live DB outage, provider failure, rollback, schema rollback, or restore was induced.

## Verification record

Local verification on the PR12 documentation diff:

- clean installs: root `npm ci` PASS (existing 5 moderate/1 high audit summary); backend `npm ci --prefix server` PASS (2 moderate). No automatic dependency mutation was attempted.
- root: `npm run lint` PASS with 0 errors/12 pre-existing Fast Refresh warnings; `npm run typecheck` PASS; `npm test -- --run` PASS (76 files, 449 tests); production `npm run build` PASS with `API_URL=https://api.example.com`.
- backend: `npm run db:generate --prefix server` PASS; `npm run lint --prefix server` PASS; `npm run typecheck --prefix server` PASS; `npm run test:unit --prefix server` PASS (74 files, 445 tests); `npm run test:contract --prefix server` PASS (1 file, 19 tests); `npm run test:integration --prefix server` PASS against isolated PostgreSQL (28 files, 176 tests); `npm run build --prefix server` PASS.
- repository: `python scripts/verify.py` PASS; `python scripts/docs/validate_contracts.py` PASS; `python tests/tooling/test_docs_contracts.py` PASS (19 tests); `git diff --check` PASS.
- focused game days: A 5/5, B 13/13, C 13/13, D 13/13, E 8/8 PASS; exact commands/scopes are recorded above.

The local Node runtime was v20.10.0; clean install warned that the resolved `eslint-visitor-keys@5.0.1` declares Node `^20.19.0 || ^22.13.0 || >=24`. Checks still passed, but the engine warning is retained as environment evidence. Root/server npm audit counts are install summaries, not a substitute for the repository's policy-aware CI security gates.

Remote PR CI is appended only after the branch is pushed and the PR checks finish; baseline-main CI is not reused as final-head evidence.

## Final evaluation

| Dimension | Score | Evidence |
|---|---:|---|
| Specification and acceptance fidelity | 2/2 | Covers the requested baseline, gap matrix, topology, probes, signals, SLOs, game days, recovery, backup, security, and final evidence without starting PR13 |
| Correctness, invariants, and failure behavior | 2/2 | Full unit/contract/integration suites and five focused game days passed; no runtime or domain behavior changed |
| Security and governance | 2/2 | Focused threat-model review found no new serious vulnerability; secrets, webhook trust, operator repair, telemetry, artifacts, and backup access boundaries are explicit |
| Architecture and scope discipline | 2/2 | Documentation-only change preserves the modular monolith, ADR 0007 deployment direction, and frozen audit backlog; no speculative platform expansion |
| Verification and operational evidence | 2/2 | Clean installs, lint, typecheck, builds, 1,089 automated test executions across recorded suites, repository validators, remote probes, and exact Vercel baseline deployment evidence; unavailable provider proof is marked `NOT PROVEN` |

**Total: 10/10.** No dimension is zero. This score evaluates the bounded PR12 deliverable; it does not convert the documented production-telemetry, Render-revision, or disaster-recovery gaps into passing claims.

## Final PR12 conclusion

The service is operationally understandable and its most important local failure/recovery paths are diagnosable and executable in controlled environments. An on-call engineer has a truthful topology, precise probe semantics, signal map, order investigation path, failure/recovery matrix, deploy/migration boundaries, and known limits. The evidence does **not** establish production SLO attainment, production telemetry export, exact Render revision, or database disaster recovery.

**PR12 complete; PR13 not started.**
