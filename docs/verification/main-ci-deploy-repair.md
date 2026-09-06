# Main CI and deployment installation repair

## Authorization and scope

User request on 2026-09-06: investigate and repair main CI and Vercel/Render update failures.
Related existing CI work: issues #68 and #69, `docs/operations/ci-protection.md`.
Base: `b711f155eaea2c8bf2943e44bb8da99e6100ae08`.
This is a tooling compatibility repair; no business, API, database or deployment topology change.

## Plan and evidence

1. Inspect the current remote main and failed Actions jobs.
2. Restore Node 20-compatible development tooling and a complete npm peer dependency lockfile.
3. Replace the unavailable Trivy action reference with an official release.
4. Verify clean installation, frontend checks and both production builds.

Observed run: https://github.com/Bruno2K/neon-arsenal-market/actions/runs/34059888998
Backend (including PostgreSQL integration), factory and contract jobs passed on the base commit.
Frontend and npm-audit jobs failed during frontend installation; build was skipped.
Trivy annotation explicitly reports that `aquasecurity/trivy-action@0.32.0` cannot be resolved.
Official release used: https://github.com/aquasecurity/trivy-action/releases/tag/v0.36.0

Local reproduction exposed three defects:

- ESLint 10 is outside the peer ranges of the installed TypeScript ESLint and React Hooks plugins; lint crashed in `FlatESLint.js`.
- concurrently 10 requires Node >=22, while CI uses Node 20.
- The local npm user configuration has `legacy-peer-deps=true`. Standard peer resolution rejects the incomplete lockfile with EUSAGE; missing peers include `@testing-library/dom`, which also caused 43 frontend test suites to fail to load.

The project `.npmrc` explicitly selects standard peer resolution. Regenerate the lockfile without `--legacy-peer-deps` or `--force`; keep ESLint and its plugins compatible when upgrading.

## Verification

- `npm ci` with project `legacy-peer-deps=false`: PASS (697 installed packages).
- `npm run lint -- --ignore-pattern '.claude/worktrees/**'`: PASS, 0 errors and 12 existing warnings. Plain local lint also traverses an unrelated ignored Claude worktree; no lint rule was disabled or changed.
- `npm test`: PASS, 76 files and 449 tests.
- `npm run typecheck`: PASS.
- Frontend production build with public Render API origin: PASS after final peer-lockfile completion (1813 modules).
- `npm ci --prefix server`, `npm run db:generate --prefix server`, `npm run typecheck --prefix server`, `npm run build --prefix server`: PASS.
- `python scripts/ai-factory/validate.py`: PASS.
- `git diff --check`: PASS.
- Remote CI on the corrected branch, Trivy execution and Docker/Render runtime: not executed. PostgreSQL integration evidence above belongs to unchanged backend on the base commit, not a new local execution.

## Operational limits

Vercel dashboard requires login in the available browser. Render deployment logs have not been supplied. No production redeploy or main push has been performed.
The repaired frontend installation is relevant to Vercel and the optional Render static site. It does not prove the cause of a Render API deployment failure.
Existing npm audit findings remain report-only under the existing CI policy; this change does not disable checks or resolve those findings.

## Engineering memory

Successful local `npm ci` can be misleading when user npm configuration differs from CI. Check effective peer resolution and validate a complete lockfile. Local nested worktrees and stale generated Prisma clients can also contaminate verification after switching branches.
