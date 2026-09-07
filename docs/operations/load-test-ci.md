# Isolated load-test CI runbook

This is the executable path for issue #55. It runs k6 from GitHub Actions against a dedicated Render API/database and publishes the JSON evidence as a workflow artifact. It is not a Vercel job: Vercel hosts the SPA, while the load target must include the API and PostgreSQL.

## What is already automated

- `.github/workflows/load-test.yml` is manually dispatched, serialized, waits for `/ready`, rejects targets whose host is not named `loadtest`, `load-test`, or `staging`, runs one k6 profile, and uploads JSON for 30 days.
- `render.loadtest.yaml` describes a separate Render service named `neon-arsenal-loadtest-api` and a separate database. Its auto-deploy is disabled and it contains no frontend, real PayPal, email, or CS2SH credentials.
- The workflow uses the protected GitHub Environment named `load-test`; its URL and test fixtures never live in the repository.

## One-time setup requiring Bruno in the dashboards

1. Merge the PR containing this workflow. GitHub only exposes `workflow_dispatch` reliably from the default branch.
2. In Render, create a **new Blueprint** from `render.loadtest.yaml`. Confirm the database is `neon-arsenal-loadtest-db`, not `neon-arsenal-db`; keep auto-deploy off.
3. Deploy it once and copy its public URL, e.g. `https://neon-arsenal-loadtest-api.onrender.com`. The name includes `loadtest`, so the CI safety gate accepts it.
4. In GitHub, create an Environment named `load-test` and protect it with required reviewers (you is enough initially). Add the variable:

   | Variable | Value |
   | --- | --- |
   | `LOADTEST_BASE_URL` | Render URL, no trailing slash |

5. Add these environment secrets only when running authenticated/write profiles. Do not put any production account, production listing, or real payment credential here.

   | Secret | Used by | How to obtain |
   | --- | --- | --- |
   | `LOADTEST_CUSTOMER_EMAIL` | `orders`, `payment_replay` | disposable customer in the load-test database |
   | `LOADTEST_CUSTOMER_PASSWORD` | `orders`, `payment_replay` | that customer's password |
   | `LOADTEST_ORDER_LISTING_IDS` | `orders` | comma-separated active listing IDs; one per requested order |
   | `LOADTEST_PAYMENT_ORDER_IDS` | `payment_replay` | comma-separated orders already holding a `paypalOrderId` |

The current public API has no safe fixture-admin endpoint and Render has no shell. Therefore creating authenticated fixtures and refreshing a database after a destructive run stays an explicit operator action. Do not expose database credentials to solve that convenience problem.

## Per-run procedure

1. In Render, manually deploy the intended commit to the **load-test** service and wait for `/ready`.
2. Capture the starting Render API/PostgreSQL charts and, where the database console permits it, the SQL snapshots in `docs/performance/load-testing.md`.
3. Go to **Actions → Isolated load test → Run workflow**, select one profile, and approve the `load-test` environment.
4. Start with `smoke`, then `catalog` at a conservative rate. Run a stable point three times. Use `orders` only with the write checkbox enabled and disposable listings.
5. Download the k6 artifact, capture ending provider charts/SQL snapshots for exactly the same UTC window, and fill `docs/performance/load-test-report-template.md`.
6. After `orders`, discard/recreate the load-test database or restore known fixtures before the next run. Never retarget the workflow at the demo or production database.

## What CI cannot prove

The GitHub runner records HTTP evidence, but it cannot observe Render CPU/RSS/restarts or PostgreSQL locks/connections without provider access. Those screenshots/exports and database snapshots are mandatory before changing capacity docs or reopening Redis, SQS/Kafka, or AWS decisions.
