---
id: SPEC-0003
status: Proposed
version: 1
source_issue: "#57"
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [SPEC-0003] — Refresh token families

## Status

`Proposed`. F2.3 retrospective description of the family-rotation portion of issue #57, pending human review. No authentication guarantees change in this increment.

## Problem

Revoking only a rotated token leaves its successor usable after token theft or replay.

## Goal

Persist refresh sessions and revoke their family upon detected reuse, with one atomic rotation claim.

## Actors

Session owner, API authentication service, PostgreSQL, client serializing refresh requests.

## Scope

Session issuance, refresh rotation, reuse detection, expiration and logout family revocation.

## Non-goals

Changing password policy or login throttling from ADR 0015, access-token denylisting, silent retry of refresh, or introducing a new session store.

## Business Rules

- `BR-01`: Login and email verification issue a new family. Store token identifiers and expiry, never the raw refresh JWT.
- `BR-02`: A valid signed refresh JWT needs an existing, unused, unrevoked, unexpired row. Rotation consumes it and inserts a successor in the same transaction/family.
- `BR-03`: Reuse of a used/revoked row revokes the family and returns 401. A claimed row whose stored family differs from the JWT family also revokes the stored family.
- `BR-04`: Unknown or expired rows fail with 401; an unknown row alone does not identify a stored family to revoke.
- `BR-05`: Logout revokes the presented valid token's family. Invalid/expired logout tokens are ignored under the existing API contract; access tokens continue until TTL.

## Invariants

- `INV-AUTH-REFRESH-FAMILY` — docs/domain/invariants.md
- `INV-AUTH-OWNERSHIP` — docs/domain/invariants.md

## State Transitions

Unused/unrevoked/unexpired → used plus unused successor in the same family. Reuse → family rows revoked. Logout → family rows revoked. Expired or revoked tokens cannot rotate back to active. New login creates a separate family, not resurrection of an old one.

## API / Data Contract

POST /auth/refresh takes `{ "refreshToken": "signed JWT" }` validated by refreshDto, returning 200 with user, accessToken and refreshToken on success; invalid/reused/expired tokens return 401. POST /auth/logout accepts refreshToken and returns the existing success message. See auth.routes.ts, auth.controller.ts and auth.dto.ts under server/src/modules/auth/.

RefreshToken in server/prisma/schema.prisma stores unique jti, familyId, userId, expiresAt, usedAt and revokedAt. No new fields, secret formats or environment variables are introduced.

## Concurrency Model

Conditional update requires unused, unrevoked and expiresAt greater than now. Claim and successor insertion share a PostgreSQL transaction. Two submissions of the same predecessor are treated as reuse: at most one rotation succeeds and the resulting family is revoked. Clients must serialize refresh; rotation is intentionally not idempotent. Existing tests establish same-token races, not every possible cross-token logout/rotation interleaving.

## Failure Modes

Database failure before commit rolls back claim and successor together. Crash or lost response after commit leaves the predecessor used: repeating it revokes the family, requiring login. Reuse revocation commits before the service throws 401, so the error cannot roll back that revocation. Invalid signature fails before trusted token processing. Do not claim immediate invalidation of already issued access tokens.

## Security

Verify refresh JWT signatures and expiry before trusting identifiers. Resolve user identity from stored token ownership. Never store/log JWTs, passwords or signing secrets. Preserve auth limiter, durable login throttle and the existing password rules. Tokens from separate login families must remain isolated.

## Observability

The existing refresh_token_reuse warning records userId and familyId, not raw tokens. Inspect correlation/error handling without adding sensitive payloads. No claim of a dedicated refresh metric in this increment.

## Backward Compatibility

Retains ADR 0015's existing cutover and logout/access-TTL semantics. F2.3 changes no schema or session behavior and triggers no additional logout rollout.

## Acceptance Criteria

- [ ] `AC-01` — Successful rotation consumes one predecessor and creates one successor in the same family. **Evidence:** integration
- [ ] `AC-02` — Reusing the predecessor returns 401 and its successor can no longer refresh. **Evidence:** integration
- [ ] `AC-03` — Concurrent use of the same token leaves no live token in its family. **Evidence:** integration
- [ ] `AC-04` — Logout prevents later refresh in that family; expired stored rows fail even with a verifying JWT. **Evidence:** integration
- [ ] `AC-05` — An unknown row fails without inventing a family; family mismatch revokes the stored family. **Evidence:** static check
- [ ] `AC-06` — Claim and successor commit atomically; reuse revocation commits before 401; raw JWTs are not persisted. **Evidence:** static check

## Verification Strategy

AC-01–04: server/src/__tests__/auth.security.integration.test.ts, supported by server/src/modules/auth/__tests__/auth.service.test.ts. AC-05–06: inspect auth.service.ts, auth.repository.ts and RefreshToken schema. Do not substitute mocked tests for PostgreSQL concurrency evidence.

Run `npm --prefix server run test:unit -- src/modules/auth/__tests__/auth.service.test.ts`. With a dedicated migrated test database run `npm --prefix server run test:integration -- src/__tests__/auth.security.integration.test.ts`. F2.3 records whether commands ran separately; references alone do not mark criteria passed. Broader logout-versus-successor races require dedicated evidence before asserting a stronger guarantee.

## Decisions / References

- docs/adr/0015-refresh-token-families.md
- docs/domain/invariants.md
- server/src/modules/auth/auth.service.ts
- server/src/modules/auth/auth.repository.ts
- server/prisma/schema.prisma

## Traceability

GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY

- Issue: #57 (family subset; password/throttle behavior remains governed by ADR 0015)
- Spec: SPEC-0003 v1
- Plan/Tasks: Notion F2.3; formal Plan deferred to F3
- PR: F2.3 documentation PR, pending publication
- Verification/Convergence: docs/verification/f2-3-real-flow-specs.md
- Evaluation/Memory: lightweight evidence in that record; F5/F6 remain pending

## Change History

- v1 — Proposed retrospective contract based on main 0d43679 and issue #57 — 2026-09-06.
