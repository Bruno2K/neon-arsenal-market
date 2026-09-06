# ADR 0015 — Refresh token families and login throttle

## Status

Accepted

## Context

Issue #57. Refresh tokens were JWTs with a `jti` denylist (`RevokedToken`). Rotation blacklisted the previous `jti` and issued a new pair, but reuse of a rotated token only returned 401. The current token in that session stayed valid, so a stolen refresh token that raced or replayed after rotation could keep a foothold.

Login brute-force protection was an in-process IP limiter (`authLimiter`). It does not share counters across Render instances and does not slow repeated guesses against one email.

Password registration accepted 6-character secrets.

PostgreSQL is the source of truth. Redis is not added.

## Decision

1. **Allowlist of issued refresh tokens.** Persist `RefreshToken` (`jti`, `familyId`, `userId`, `expiresAt`, `usedAt`, `revokedAt`). A refresh JWT is accepted only when the row exists, is unexpired, unused, and unrevoked. The raw JWT is never stored.
2. **Families.** Each login / email-verify session creates a new `familyId`. Rotation inserts a successor in the same family and sets `usedAt` on the predecessor with a conditional `UPDATE … WHERE usedAt IS NULL AND revokedAt IS NULL`.
3. **Reuse.** If that update matches zero rows and the `jti` was already used or the family is already revoked, revoke every row in the family and return 401. Concurrent refresh of the same unused token is treated as reuse (clients must serialize refresh).
4. **Logout** revokes the presented token’s family, not only one `jti`.
5. **Deploy cutover.** Existing `RevokedToken` rows and in-flight refresh JWTs are discarded; users sign in again.
6. **Login throttle.** `LoginThrottle` is keyed by normalized email (including unknown addresses). After two free failures, `nextAllowedAt` grows 1s, 2s, 4s, … cap 15 minutes. The handler returns 429 + `Retry-After` and does not `sleep`. Success deletes the row. A 15-minute quiet window resets the counter. IP `authLimiter` remains.
7. **Password policy.** Registration and `PATCH` password changes require 8–72 characters, at least one letter and one number. 72 is bcrypt’s effective maximum. Demo seed passwords already satisfy this. Login still accepts any non-empty password so the policy is not an oracle.
8. **No new env vars.** Delay and password limits are code constants.

## Rollback

Drop `RefreshToken` and `LoginThrottle`, restore `RevokedToken`, and revert auth services. In-flight families would be invalidated either way.

## Consequences

- Stolen rotated refresh tokens cannot mint a parallel session; the legitimate family dies and the user must log in.
- Double-submit of the same refresh token logs the session out.
- Access tokens are still not denylisted; they expire on TTL (default 15m).
- Login delay is durable across instances; it is not a worker sleep.
