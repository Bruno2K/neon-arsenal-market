# F3.2 Task Contract Verification

## Scope

F3.2 defines a repository-native Task contract, upgrades the canonical template and existing Tasks, and adds structural lint for identity, lifecycle, source versions, baseline, ownership, sections, evidence classes, verification commands, and closure state.

## Acceptance evidence

- Every file under `docs/tasks/` conforms to the same machine-checked contract.
- `TASK-FAV-001` demonstrates a real `Blocked` Task derived from PLAN-0001 without authorizing work against the proposed SPEC-0004.
- Executable Task states require a `Ready` source Plan at the pinned version.
- A `Done` Task cannot retain unchecked acceptance criteria.
- The validator rejects malformed source metadata, missing sections, placeholder verification commands, source drift, and invalid lifecycle state.

## Commands

```bash
python -m py_compile scripts/ai-factory/validate.py scripts/ai-factory/test_validate.py
python scripts/ai-factory/validate.py
python scripts/ai-factory/test_validate.py
git diff --check
```

## Result

- Python compilation: PASS
- AI Factory validator: PASS
- Validator tests: PASS, 14 tests
- Diff whitespace validation: PASS

## Traceability

`SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY`
