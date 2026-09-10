# Repository verification

The canonical deterministic verification entrypoint for the repository-native agent harness is:

```bash
python scripts/verify.py
```

CI executes the same entrypoint with the platform Python alias:

```bash
python3 scripts/verify.py
```

## Contract

`scripts/verify.py` is dependency-free orchestration for deterministic repository checks. It does not select work, generate prompts, invoke an LLM, access an external tracker, or change product state.

The entrypoint currently:

1. records the exact Git revision and Python interpreter version;
2. verifies that the canonical verification surfaces exist;
3. rejects retired orchestrator/AI-factory entrypoints from active agent guidance;
4. validates documentation and artifact contracts through `scripts/docs/validate_contracts.py`;
5. runs the validator regression suite in `tests/tooling/test_docs_contracts.py`;
6. stops on the first failed stage and preserves that stage's exit code.

The lower-level commands remain individually runnable for focused debugging, but they are implementation details of the verification entrypoint rather than separate agent procedures.

## Reproducibility boundary

The dedicated `Repository verification` GitHub Actions workflow checks out full Git history because artifact baselines are validated as real repository commits. It uses Python 3.12 and calls the same repository entrypoint used locally.

A green run proves the repository artifact graph, harness surfaces, and validator tests under that revision. It does not prove application runtime behavior; product changes still require the Task-specific checks and the broader CI jobs justified by their risk.

## Drift policy

Active guidance must not direct agents back to removed `scripts/ai-factory/`, orchestrator wrappers, or retired `next` scripts. Historical completed Tasks and verification records may mention those paths when describing work that actually happened; historical statements are not executable guidance.

When the verification implementation changes, update this document and the dedicated CI workflow in the same PR so local and CI entrypoints remain aligned.
