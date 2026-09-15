# PR13 final release checklist

Status values describe the PR13 head and must be updated truthfully before human handoff.

| Item | Status | Evidence / follow-up |
|---|---|---|
| README current | PASS | Portfolio entry point, evidence, limits, run path, and freeze state are consolidated in [`README.md`](../../README.md) |
| Live links current | PASS | One non-destructive verification of frontend, API `/health`, API `/ready`, and public `/docs` recorded in the PR13 handoff/PR body |
| Architecture current | PASS | [Current architecture](../architecture/current-state.md), C4, deployment, and README agree on Vercel → Render API → PostgreSQL and external boundaries |
| Case study complete | PASS | [Backend engineering case study](case-study.md) |
| Reviewer guide complete | PASS | [5–15 minute reviewer guide](reviewer-guide.md) |
| Evidence index complete | PASS | [Claim-to-proof map](evidence-index.md) |
| Known limitations explicit | PASS | [Project status](project-status.md#known-evidence-limits) and README |
| PR11 artifact linked | PASS | [Final Senior Backend Audit](../verification/final-senior-backend-audit-2026-09-14.md) |
| PR12 artifact linked | PASS | [Production & Operational Proof](../verification/production-operational-proof-2026-09-15.md) |
| CI green | PARTIAL | Local contract verification passed; remote PR CI must be green before completion handoff |
| Vercel/Render links checked | PASS | Single remote check recorded in PR13 handoff/PR body; point-in-time reachability only |
| No unresolved P0 | PASS | PR11 closed and re-verified all seven P0 findings; unresolved P0 = 0 |
| Frozen backlog documented | PASS | AUD-002, AUD-020, AUD-021, AUD-030, AUD-032, AUD-033 and rejected AUD-034 are in [project status](project-status.md#frozen-backlog) |
| Branch protection task recorded | MANUAL FOLLOW-UP | Enable `main` ruleset/protection after GitHub account authentication; protection is not claimed active |
| No runtime/domain change in PR13 | PASS | PR13 diff is limited to portfolio/current documentation |
| Project freeze policy present | PASS | [PORTFOLIO COMPLETE / MAINTENANCE policy](project-status.md) |

## Required local verification

```text
python scripts/verify.py
python scripts/docs/validate_contracts.py
python tests/tooling/test_docs_contracts.py
git diff --check
```

If repository link validation tooling exists, run it too. Do not claim remote CI green until the PR head's required checks finish successfully.
