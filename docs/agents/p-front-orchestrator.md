# P-front orchestrator (shim)

P-front is **not** a separate orchestrator anymore.

Intake is open GitHub issues. The unified control plane is:

```bash
python3 scripts/orchestrator/next.py --track frontend
```

`python3 scripts/p-front/next.py` is a shim for that command.

Historical activity JSON (`scripts/p-front/activities.json`) and `docs/frontend-sprint.md` remain as brand/visual locks plus the completed rebuild archive. They are not used to pick work.

See `docs/agents/orchestrator.md` and `.cursor/rules/06-orchestrator.mdc`.
