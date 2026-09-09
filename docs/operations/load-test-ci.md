# Controlled CI load-test runbook

This is the executable path for issue #55 without a cloud account, external credentials, or a credit card. It produces **controlled CI capacity evidence**. Vercel and Render are deliberately not targets, and results must not be described as Render or production capacity.

## Controlled topology

- The API is the production image built from `server/Dockerfile`, limited to 1 CPU and 512 MiB, with one replica and `NODE_ENV=production`.
- PostgreSQL uses `postgres:16-alpine`, limited to 1 CPU and 1 GiB, with `max_connections=100` and `shared_buffers=256MB`.
- API, PostgreSQL, and k6 use the same per-job internal Docker network. The API is not published to the runner host; the containers have no provider egress.
- Every repetition starts a fresh PostgreSQL container, applies migrations, seeds the demo catalog, and creates equivalent disposable fixtures. API readiness is checked from inside the API container so the workflow does not depend on host port publishing.
- k6 runs as a pinned container on the same internal Docker network. Its CPU still shares the GitHub-hosted runner with the API/PostgreSQL containers, so noisy-neighbor variability remains a material uncertainty in cross-workflow comparisons.

No GitHub Environment, external URL, PayPal credential, Blueprint, Vercel configuration, Render configuration, or card is required.

## Profile safety

- `smoke` and `catalog` are read-only. `ALLOW_WRITES` is absent. Smoke is deliberately paced at 1 request/second so it proves connectivity/response shape without tripping the production API rate limit; it is not a capacity profile.
- `orders` alone receives `ALLOW_WRITES=true` and a generated list of unique `ACTIVE` listing IDs. Post-run SQL requires one order/reservation/idempotency result per listing and rejects duplicate consumption or payment/ledger side effects.
- `payment_replay` receives local pending orders whose `PaymentLink` rows are already `COMPLETED` and whose PayPal IDs are synthetic local fixture identities. This exercises the existing replay early return. No PayPal credential is present and the internal Docker network has no provider egress, so an accidental provider call fails the run.
- `webhook_rejection` sends only invalid signatures. Post-run SQL requires zero matching webhook-event rows.

## Per-run procedure

1. Merge the PR containing the workflow. GitHub exposes `workflow_dispatch` from the default branch.
2. Go to **Actions → Controlled CI k6 evidence → Run workflow**.
3. Select one of all five profiles. Use one repetition while proving connectivity and selecting a stable catalog offered rate.
4. For catalog, raise `target_rps` in separate one-run probes until a threshold, errors, dropped iterations, API/container limit, PostgreSQL signal, or runner/client limit identifies the knee. Offered RPS is configuration; achieved RPS is `http_reqs.rate` in the k6 summary.
5. Once a stable point is selected, dispatch with exactly three repetitions. The matrix runs serially at the same commit and input configuration, with a fresh equivalent dataset per repetition. Before treating them as equivalent, confirm the recorded API/PostgreSQL image IDs, versions, limits and dataset cardinalities match; mutable upstream base-image tags can otherwise invalidate the set.
6. Download all three artifacts and complete `docs/performance/load-test-report-template.md`. Report each run, median statistics, worst error rate, dropped iterations, variability, first bottleneck and residual uncertainty.

Run all five profiles at least once before evaluating SPEC-0009 AC-07. Do not mark AC-07 complete in the enablement PR; only subsequent successful workflow artifacts can supply that evidence.

## Evidence bundle

Each repetition retains for 30 days:

- raw k6 JSON summary and `k6 inspect` output;
- exact commit, image IDs, Node/PostgreSQL/k6 versions, limits and workload metadata;
- API/PostgreSQL logs and a filtered API-error view;
- two-second API CPU, container memory, process RSS, restart/state and PostgreSQL activity samples;
- PostgreSQL pre/post connections, waits, deadlocks and transaction counters;
- dataset cardinalities and generated fixture IDs;
- post-run invariant validation output.

The workflow uploads evidence before enforcing the final k6-threshold and invariant gate, so failed experiments remain diagnosable.

## What these results mean

Successful three-run bundles can support an environment-qualified controlled CI capacity statement. They are **not** a Render or production capacity claim: GitHub runner CPU/network, host contention, and local loopback traffic differ from a public deployment. A material spread between equivalent repetitions means runner variability or another unknown is unresolved; report it and do not claim a stable point.

Do not use these results to justify Redis, SQS/Kafka or AWS. Revisit those only after a concrete production constraint exists. If a real deployed capacity test becomes necessary later, provision a dedicated paid/free provider environment only after deciding its budget and observability requirements.
