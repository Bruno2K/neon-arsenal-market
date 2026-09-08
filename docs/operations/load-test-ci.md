# Ephemeral load-test CI runbook

This is the executable path for issue #55 without a cloud account or credit card. GitHub Actions starts PostgreSQL 16, migrates and seeds the API, then runs k6 against `127.0.0.1` in the same disposable runner. Vercel and Render are deliberately not targets.

## What is already automated

- `.github/workflows/load-test.yml` is manually dispatched, serialized, creates a fresh PostgreSQL database for every run, waits for `/ready`, runs k6 and retains JSON plus API logs for 30 days.
- Only the safe `smoke`, `catalog` and `webhook_rejection` profiles are exposed. `orders` and `payment_replay` remain intentionally manual because they mutate data or require a pre-warmed PayPal Sandbox order.
- No GitHub Environment, external URL, secret, Blueprint, Vercel configuration, Render configuration, or card is required.

## Per-run procedure

1. Merge the PR containing the workflow. GitHub exposes `workflow_dispatch` from the default branch.
2. Go to **Actions → Ephemeral k6 load test → Run workflow**.
3. Run `smoke` once, then `catalog` three times at the same conservative RPS (start with `5`). Run `webhook_rejection` separately.
4. Download each artifact and complete `docs/performance/load-test-report-template.md`, including the workflow URL, commit SHA and configured RPS.

## What these results mean

They prove repeatable application + PostgreSQL behavior from a clean environment and can catch regressions in latency, errors, readiness and the webhook trust boundary. They are **not** a Render capacity claim: GitHub runner CPU/network, no provider metrics, and local loopback traffic are different from a public deployment.

Do not use these results to justify Redis, SQS/Kafka or AWS. Revisit those only after a concrete production constraint exists. If a real deployed capacity test becomes necessary later, provision a dedicated paid/free provider environment only after deciding its budget and observability requirements.
