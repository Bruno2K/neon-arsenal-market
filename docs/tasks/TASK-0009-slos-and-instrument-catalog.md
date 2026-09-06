# [TASK-0009] — SLOs, error budget, diagnosis, catalog test

## Source

- Specification: `SPEC-0008`
- Plan: `PLAN-0005`
- Issue: #63

## Objective

Define measurable SLOs and a 30-day error budget from existing instruments, document request/trace diagnosis and runbook alert thresholds, and add a unit test that the documented catalog still exists.

## Scope

`docs/operations/slos.md`, runbook diagnosis/alerts, observability/current-state/roadmap/README pointers, `server/src/shared/observability/__tests__/instrument-catalog.test.ts`.

Out of scope: new meters, pager vendor, `src/`, reservation/payment code.

## Preconditions

`TASK-0008` JSON catalog exists. `SPEC-0008` Accepted.

## Acceptance Criteria

- [ ] AC-01: Each SLO cites an existing instrument or an explicit unmeasurable + proxy
- [ ] AC-02: Availability SLI is 5xx / recorded HTTP, not 4xx
- [ ] AC-03: Error budget is 30-day recorded-request remainder
- [ ] AC-04: Diagnosis uses request.id / trace_id and forbids secret search
- [ ] AC-05: Unit test proves documented metric names and attribute keys
- [ ] AC-06: No payment/reservation semantic change

## Dependencies

`TASK-0008`

## Risks

`payments.failed` / `paypal.webhooks.failed` mix business expiry with ops failures.

## Verification Command

```bash
python3 scripts/ai-factory/validate.py
cd server && npm run test:unit
```

## Expected Evidence

Commands exit 0. Catalog test covers documented meters. Diff review shows no `src/` or payment runtime edits.
