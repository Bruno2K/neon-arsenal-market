# CI pipeline and main-branch protection

Repo-local subset of #61 (OpenAPI contract tests) and #69 (CI hardening).
Production remains Render (`render.yaml`, ADR 0007). This document does not add AWS, Terraform, Redis, or a staging environment.

## What CI runs (`.github/workflows/ci.yml`)

| Job | Checks |
|---|---|
| `factory` | `python3 scripts/ai-factory/validate.py` and its tests |
| `frontend` | lint, `tsc --noEmit`, unit tests |
| `backend` | Prisma generate + migrate, typecheck, unit, integration (Postgres 16) |
| `contract` | `cd server && npm run test:contract` — OpenAPI vs real HTTP handlers |
| `security` | `npm audit --audit-level=high` at the repo root and in `server/` (logged; not a hard fail yet) |
| `build` | Frontend Vite build and `server` `tsc` build, after the jobs above |

Node 20. Backend integration uses `postgres:16-alpine` with the same `DATABASE_URL` pattern as before.

The server package has no `lint` script (root ESLint ignores `server/`). Frontend lint remains the lint gate. Do not invent a second ESLint toolchain for the API in this change.

## Repo-local protection files

| File | Role |
|---|---|
| `.github/CODEOWNERS` | Default + `server/`, `.github/`, `docs/` owners (`@Bruno2K`) |
| `.github/dependabot.yml` | Weekly npm (root + `server/`) and GitHub Actions updates |

Dependabot opens PRs. It does not auto-merge. Reviewers still run the same CI.

## Residuals (cannot be done in this repository / with read-only `gh`)

These #69 items stay human/admin work. Agents must not invent them:

1. **GitHub branch protection and required checks** — enabling rules, required status checks, required reviews, or conversation resolution needs org/admin write. Suggested required checks once an admin can apply them: `AI Factory (artifact validation)`, `Frontend (lint · typecheck · test)`, `Backend (typecheck · unit · integration)`, `Contract (OpenAPI)`, `Security (npm audit)`, `Build check`.
2. **Staging environment, smoke tests, and controlled production promotion** — no staging Render service, preview promotion, or deploy workflow exists. Production deploys follow Render auto-deploy / dashboard rollback (`docs/operations/runbook.md`). Do not add a second cloud.
3. **Container image scanning and a container registry** — `server/Dockerfile` is built by Render. There is no GHCR/ECR push in CI. Image/CVE scanning is an operator choice on Render or a later CI job, not invented here.
4. **AWS / Terraform / ECS promotion** — blocked while ADR 0007 selects Render.
5. **Hard-failing npm audit** — current root and `server/` lockfiles already report high/critical findings (including `bcrypt` → `tar`, `react-router`, Vite/Vitest). Making `npm audit --audit-level=high` a failing gate would go red on `origin/main` and force unrelated upgrades (`npm audit fix --force` wants `bcrypt@6`). The job still runs and publishes the report. A dedicated dependency-upgrade PR can flip the steps to hard-fail.

## Contract tests

See `docs/testing.md`. Single spec: `server/src/shared/docs/openapi.ts`. No generated client types (Market already uses `src/types/api.ts`).
