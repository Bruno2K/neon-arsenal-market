# P-back orchestrator (shim)

P-back is **not** a separate orchestrator anymore.

Intake is open GitHub issues. The unified control plane is:

```bash
python3 scripts/orchestrator/next.py --track backend
```

`python3 scripts/p-back/next.py` is a shim for that command.

Historical activity JSON (`scripts/p-back/activities.json`) and `docs/backend-sprint.md` remain as archive of the completed backend sprint. They are not used to pick work.

See `docs/agents/orchestrator.md` and `.cursor/rules/06-orchestrator.mdc`.
