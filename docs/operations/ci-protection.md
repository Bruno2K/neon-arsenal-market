# CI pipeline and main-branch protection

Repo-local subset of #61 (OpenAPI contract tests) and #69 (CI hardening).
Production remains Render (`render.yaml`, ADR 0007). This document does not add AWS, Terraform, Redis, or a staging environment.

## What CI runs (`.github/workflows/ci.yml`)

| Job | Checks |
|---|---|
| `documentation-contracts` | `python3 scripts/docs/validate_contracts.py` and its focused tests |
| `frontend` | lint, `tsc --noEmit`, unit tests |
| `backend` | Prisma generate + migrate, lint, typecheck, unit, integration (Postgres 16) |
| `contract` | `cd server && npm run test:contract` — OpenAPI vs real HTTP handlers |
| `security` | Blocking runtime High/Critical and all Critical npm audit gates at the root and in `server/` |
| `trivy` | Blocking High/Critical filesystem scan of `server/` (Dockerfile + lockfile). No GHCR/ECR. Local image command: `docs/operations/container-hardening.md` |
| `build` | Frontend Vite build and `server` `tsc` build, after the jobs above |

Node 20. Backend integration uses `postgres:16-alpine` with the same `DATABASE_URL` pattern as before.

Frontend lint is scoped to the frontend configuration and source files. Backend lint uses the server-owned ESLint configuration through `npm run lint --prefix server`; both are CI gates.

## Repo-local protection files

| File | Role |
|---|---|
| `.github/CODEOWNERS` | Default + `server/`, `.github/`, `docs/` owners (`@Bruno2K`) |
| `.github/dependabot.yml` | Weekly npm (root + `server/`) and GitHub Actions updates |

Dependabot opens PRs. It does not auto-merge. Reviewers still run the same CI.

## Residuals (cannot be done in this repository / with read-only `gh`)

These #69 items stay human/admin work. Agents must not invent them:

1. **GitHub branch protection and required checks** — enabling rules, required status checks, required reviews, or conversation resolution needs org/admin write. Suggested required checks once an admin can apply them: `Documentation contracts`, `Frontend (lint · typecheck · test)`, `Backend (lint · typecheck · unit · integration)`, `Contract (OpenAPI)`, `Security (npm audit)`, `Build check`.
2. **Controlled production promotion** — the repository now has a manual, ephemeral GitHub Actions load-test workflow (`docs/operations/load-test-ci.md`), but it is deliberately not a production deploy workflow. Production deploys follow Render auto-deploy / dashboard rollback (`docs/operations/runbook.md`).
3. **Container registry / deploy-time image CVE gate** — `server/Dockerfile` is built by Render. There is no GHCR/ECR push. CI now runs a **filesystem** Trivy job on `server/` (report-only). A failing image gate still needs a registry or a Render-side scanner; do not invent one.
4. **AWS / Terraform / ECS promotion** — blocked while ADR 0007 selects Render.
5. **Development-only High findings** — runtime High/Critical and all Critical findings now fail CI. The narrower Vite development-server exception, its exposure, owner and removal condition are recorded in `docs/security/dependency-vulnerability-policy.md`; it does not apply to production dependencies.

## Contract tests

See `docs/testing.md`. Single spec: `server/src/shared/docs/openapi.ts`. No generated client types (Market already uses `src/types/api.ts`).
