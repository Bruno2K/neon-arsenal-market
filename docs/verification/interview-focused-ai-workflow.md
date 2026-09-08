# Interview-focused AI workflow — verification evidence

## Scope

Evidence for the workflow decision in ADR 0021. This is a reversible documentation/tooling change authorized directly by the project owner; it does not change product behavior and therefore does not manufacture a Spec/Plan/Task chain for its own process.

## Executed checks

- `python -m py_compile scripts/docs/validate_contracts.py tests/tooling/test_docs_contracts.py` — passed.
- `python scripts/docs/validate_contracts.py` — passed for templates, harness, artifact contracts, Task graph, and internal references.
- `python tests/tooling/test_docs_contracts.py` — 19 tests passed.
- `git diff --check` — passed; line-ending notices are informational and no whitespace error was reported.
- Active-scope search for `AI Factory`, `scripts/ai-factory`, the former long chain, and autonomous-agent language — only the validator's explicit historical-chain compatibility constant remained.

## Acceptance mapping

- `AC-01`: `AGENTS.md`, active Cursor rules, agent guidance, ADR 0021, and the portfolio case study establish human accountability and backend evidence as the outcome.
- `AC-02`: validation moved to `scripts/docs/validate_contracts.py`, tests moved to `tests/tooling/test_docs_contracts.py`, and CI exposes `Documentation contracts`.
- `AC-03`: Issue-resolution helpers plus Evaluation and Memory templates were removed; Git retains their history.
- `AC-04`: the test suite exercises the focused chain and explicit compatibility for committed historical artifacts.
- `AC-05`: `docs/portfolio/mercado-livre-backend-poc.md` defines concurrent purchase, reliable payment, and operability/performance stories with evidence targets and public references.

## Scope review

No file under `src/`, `server/`, Prisma migrations, deployment configuration, or dependency manifests changed. The only workflow executable retained is deterministic documentation validation; it does not select work or call an AI model.

## Remaining limitation

This change defines the interview narrative and its evidence targets. It does not itself prove that all three flagship backend stories are complete; each must be audited against executable product evidence in subsequent work.
