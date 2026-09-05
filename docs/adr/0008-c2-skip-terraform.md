# ADR 0008 — C2 skip: no AWS/Terraform

## Status

Accepted

## Context

P-back **C2** is conditional on **C1**. ADR 0007 kept **Render** as the production target and classified ECS/Fargate as a future option, not a committed migration.

C2 acceptance: if C1 kept Render, do not add Terraform; land a skip commit whose subject contains `[P-back] C2`.

## Decision

1. **Do not add Terraform, an `infra/` tree, VPC, ECS, RDS, or Secrets Manager layout.** ADR 0007 did not select AWS.
2. Production remains Render (`render.yaml`). PostgreSQL remains the source of truth.
3. A later human supersession of ADR 0007 is required before any AWS IaC exists in this repository.

## Consequences

- The P-back catalog can close: this commit is the C2 skip.
- Agents must not “fill in” AWS to look complete. Interview cloud talk starts from C4 + ADR 0007.
- R2 capture-after-expiry refund/void remains an unrelated open human decision.
