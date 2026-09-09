# Threat Model — Neon Arsenal Market

This document describes **trust boundaries, assets, actors, and abuse cases against controls that already exist in this repository**. It is not a promise of a security program. If a control is not in code or config, it is listed as absent.

**Scope:** the current modular monolith (`server/`), the Vite client as an untrusted HTTP caller, PostgreSQL via Prisma, PayPal (Orders + webhooks + in-process order GET reconciliation), Resend (email), and Render as the **current** production target (`render.yaml`). Hypothetical AWS/ECS/Secrets Manager is **not** treated as live.

**Related:** `docs/architecture/domain-invariants.md`, `docs/architecture/failure-modes.md`, `docs/architecture/current-state.md`, `docs/adr/0002-paypal-webhook-reliability.md`, `docs/operations/runbook.md`.

---

## 1. System context and trust boundaries

```text
  Untrusted clients (browser, curl, attackers)
           │  HTTPS (Render TLS) / HTTP (local)
           ▼
  Express API  (server/src)     ◄── JWT Bearer in Authorization
           │
           ├── Prisma ──────────► PostgreSQL   (authoritative business state)
           ├── PayPal REST      ► create order, capture, order GET (client credentials)
           ├── PayPal webhook   ◄ POST /payments/webhook (unsigned until verified)
           └── Resend           ► transactional email
```

| Boundary | What crosses it | Who is trusted after the boundary |
|---|---|---|
| Browser / any HTTP client → Express | JSON bodies, headers | Nobody. All input is untrusted until validated. |
| Express → PostgreSQL | Prisma queries inside the process | The database is trusted for durability and constraints. Application code must still use conditional writes. |
| Express → PayPal REST | Client-id/secret, order create/capture/GET | PayPal is an **unreliable external system**. Success is not local truth until persisted. |
| PayPal → Express webhook | Raw body + `paypal-*-` headers | **Untrusted until RSA-SHA256 verification succeeds.** |
| Express → Resend | Email send | Untrusted network; email is not an authorization channel. |
| Operator → Render dashboard / env | Secrets, deploys, logs | Operators can read env and logs. Demo Blueprint seeds accounts. |

The frontend (`src/`) is **not** a security boundary. It may hold a JWT in client storage; anyone who can call the API with that token is the user.

There is **no repository-controlled WAF**, **no** CSRF token (sessions are Bearer headers, not cookie auth), **no** mTLS, and **no** IP allowlist on the webhook path. Render supplies its managed Cloudflare edge, but application-level abuse remains this service's responsibility. Browser-abuse headers are set by `securityHeaders` in `app.ts` (not the `helmet` package).

---

## 2. Assets

| Asset | Why it matters | Where it lives |
|---|---|---|
| Unique listings / reservation state | Two buyers must not both acquire the same item | PostgreSQL `Listing.status`, conditional `updateMany` |
| Orders and payment confirmation | Money movement; seller payout eligibility | `Order`, `PaymentLink`, `PaymentWebhookEvent`, seller ledger |
| Seller balances / ledger rows | Must not credit twice | Unique seller transaction per order |
| Passwords | Account takeover | Hashed with bcrypt (`hashPassword`, 10 rounds). Never logged. |
| JWT access + refresh tokens | Session | Access: Bearer, default **15m** (`JWT_ACCESS_EXPIRES_IN`). Refresh: default **7d**; persisted `RefreshToken` allowlist with `familyId`. Rotation marks `usedAt`; reuse revokes the family. |
| PayPal credentials + `PAYPAL_WEBHOOK_ID` | Forged captures / API abuse | Process env. Render Blueprint `sync: false`. |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Forge sessions | Env; Blueprint `generateValue` on first deploy. |
| Buyer/seller PII (email, names) | Privacy | User rows; keep out of logs. |
| Demo seed credentials | Public if `SEED_DEMO_DATA=true` | Documented in runbook; **not** production-secret quality. |

---

## 3. Actors

| Actor | Capabilities in this design |
|---|---|
| Anonymous client | Public catalog/search. Register/login (rate-limited more tightly in production). Cannot reserve or pay. |
| Authenticated CUSTOMER | Create orders for **their** identity. Pay for **their** pending orders. Read **their** orders. Cannot mark paid from the client. |
| Authenticated SELLER | Seller APIs for **their** listings/items. Orders only when they contain the seller’s items (invariants). Public register may create a seller pending admin approval. |
| Authenticated ADMIN | `/admin` via `authenticate` + `requireRole("ADMIN")`. ADMIN is not a self-serve register role (Zod allows `CUSTOMER` \| `SELLER` only; ADMIN via seed). |
| PayPal (after signature check) | Can assert capture completed for a PayPal order id. Cannot skip uniqueness of `PaymentWebhookEvent`. |
| Attacker with network access to the API | Anything an anonymous or stolen-token client can do. |
| Render operator | Env, logs, deploys, Blueprint seed flag. |

---

## 4. Existing controls (inventory)

These are **implemented**. Threats below assume an attacker trying to bypass them.

### 4.1 Authentication and authorization

- Register, login, email verify, refresh, logout: `server/src/modules/auth/`.
- Passwords hashed with bcrypt before persist (`server/src/shared/utils/hash.ts`).
- Access token: `Authorization: Bearer` checked by `authenticate` (`server/src/shared/middlewares/authenticate.ts`). Missing/invalid → 401. Role and identity come from the **JWT payload** (`sub`, `email`, `role`), not a per-request database lookup.
- Role gate: `requireRole` (`server/src/shared/middlewares/requireRole.ts`). Admin router: `authenticate` then `requireRole("ADMIN")` on `/admin`.
- Register body: Zod `role` is `CUSTOMER` \| `SELLER` only (`auth.dto.ts`). Comment in `auth.service.ts`: ADMIN is seed-only.
- Refresh: verifies refresh JWT (`jti` + `familyId`), accepts only an unused unrevoked unexpired `RefreshToken` row, rotates with a conditional `usedAt` claim, loads the **current** user from the database (`auth.service.ts`). Reuse of a used/revoked `jti` revokes the family. Logout revokes the **family**. Access tokens are **not** checked against `RefreshToken`; they expire on TTL.
- Login: failed attempts for a normalized email persist `LoginThrottle`. After two free failures, HTTP 429 + `Retry-After` with progressive delay (1s, 2s, 4s, … cap 15 minutes). Unknown emails are throttled too. Dummy bcrypt compare on unknown users. Password policy on register/`PATCH` me: 8–72 characters, letter + number (`passwordPolicy.ts`).
- Zod `validateBody` on auth and other write routes.
- **Ownership (domain, not only middleware):** a customer may only act on their orders; a seller only on orders that include their items (`docs/architecture/domain-invariants.md`).
- `/auth/me` requires `authenticate`.

**Not present:** 2FA, step-up auth, session cookies + CSRF, device binding, password-breach checks, access-token revocation list, live role reload on each API call.

### 4.2 HTTP abuse controls

- `apiLimiter` (`server/src/shared/middlewares/rateLimit.ts`): express-rate-limit, **15 minute** window. Default **100** requests / client when `NODE_ENV=production`, else **10_000**, unless `RATE_LIMIT_API_MAX` is set. Mounted globally in `app.ts` (all routes, including health and webhook — there is no `/api` prefix).
- `authLimiter`: default **10** / window in production, else **100**, unless `RATE_LIMIT_AUTH_MAX` is set. Extra limiter on `/auth` (stacked with the global limiter).
- Client identity (`shared/http/clientIp.ts`, ADR 0023): Express `trust proxy` is false. When Render sets `RENDER=true`, one valid `CF-Connecting-IP` value is trusted because the managed Cloudflare edge overwrites it; otherwise forwarding headers are ignored and the socket peer is used. Missing/invalid values fall back to the socket. IPv6 keys are normalized to /56.
- Store is **in-process memory**. Multiple Render instances do **not** share counters. Documented in `docs/operations/runbook.md`. This is not Redis; this project did not add a shared store.
- Security headers (`securityHeaders`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Permitted-Cross-Domain-Policies: none`, `Permissions-Policy` (camera/microphone/geolocation/payment off), `Content-Security-Policy: frame-ancestors 'none'`, `X-DNS-Prefetch-Control: off`. Production also sends `Strict-Transport-Security: max-age=15552000; includeSubDomains`. `Cross-Origin-Resource-Policy` is omitted so CORS frontends can read JSON.
- CORS (`getAllowedCorsOrigins` in `server/src/shared/config/cors.ts`): `FRONTEND_URL` (comma-separated). Outside production, `http://localhost:5173` and `http://127.0.0.1:5173` are also allowed. Production uses only configured origins. Requests **without** `Origin` (curl, health checks, many bots) are allowed (`isCorsOriginAllowed`). A rejected Origin is HTTP 403 `Origin not allowed.` and does not echo the Origin.
- JSON parser: `express.json({ limit: "100kb" })` with a `verify` hook that copies `rawBody` for webhook signatures (`app.ts`). Overflow is HTTP 413 `Request payload too large.` Invalid JSON is HTTP 400 `Invalid JSON body.`
- `AppError` returns `err.message` to the client; Prisma unique/not-found map to 409/404; unhandled errors return `"Internal server error."` without a stack (`errorHandler.ts`).
- OpenTelemetry attribute redaction (`server/src/shared/observability/redact.ts`) drops keys/values that look like passwords, tokens, JWTs, or PayPal transmission signatures.

### 4.3 Payment and webhook authenticity

- `POST /payments/create` requires `authenticate`. `POST /payments/webhook` does **not** (`payments.routes.ts`).
- Client **cannot** mark an order paid.
- Checkout creates a PayPal order **after** a durable `PaymentLink` claim (unique `orderId`); PayPal `OrdersCreate` is not retried by the HTTP client.
- Webhook authenticity is **PayPal transmission signature** (`server/src/shared/utils/paypalWebhook.ts`, ADR 0002):
  - Raw body captured before JSON parse (`app.ts`).
  - RSA-SHA256 over `transmissionId|timestamp|webhookId|crc32(rawBody)`.
  - `paypal-auth-algo` must be `SHA256withRSA`.
  - Certificate URL must be **HTTPS** and host in `{api,api-m}.paypal.com` or sandbox equivalents.
  - Transmission time skew: **5 minutes** (`PAYPAL_WEBHOOK_MAX_SKEW_MS`).
  - `PAYPAL_WEBHOOK_ID` **required in production** (missing → verify returns false). **Skipped outside production if unset** (local/test convenience — a real gap if a public URL runs with non-production `NODE_ENV`).
- Duplicate events: unique `(provider, externalEventId)` on `PaymentWebhookEvent`.
- Only `PAYMENT.CAPTURE.COMPLETED` confirms sale. `CHECKOUT.ORDER.APPROVED` is stored as **IGNORED** (buyer approval ≠ capture).
- Payment confirmation uses a conditional claim (unpaid order + still-held reservation) inside one PostgreSQL transaction with listing `SOLD`, seller ledger, and outbox rows (ADR 0002, ADR 0012).
- Capture after reservation expiry: local conflict; HTTP **200** to PayPal so the provider stops retrying; listing is **not** SOLD. Manual PayPal refund/void is an **open human decision** — there is **no** refund API in this codebase.
- Lost captures may be recovered by an **in-process PayPal order GET** sweep (ADR 0002). That path still cannot sell an expired reservation.

### 4.4 Secrets handling (as implemented)

- Secrets are **environment variables**, not files in git.
- Render Blueprint: `JWT_SECRET` / `JWT_REFRESH_SECRET` `generateValue`; PayPal/DB/Resend/`FRONTEND_URL` `sync: false`.
- `jwt.ts` falls back to `"default-secret-change-me"` / `"default-refresh-secret"` if those env vars are missing **outside production**. `startApiProcess` calls `assertProductionJwtSecrets`: `NODE_ENV=production` refuses missing or fallback secrets and does not listen.
- No AWS Secrets Manager in the running system.
- Structured logs and OTel redaction are expected **not** to include credentials.

### 4.5 Integrity controls that reduce fraud / inconsistency

- Listing reserve: `ACTIVE` → `RESERVED` via conditional update (lost update → conflict).
- Order create: durable `OrderIdempotencyKey` before PayPal.
- Money: Prisma Decimal, not IEEE floats.
- Unique seller ledger row per `(sellerId, orderId)`. `Seller.balance` is a projection; the ledger wins if they disagree (ADR 0011). Periodic in-process reconciliation SETs a drifted projection to PAID SUM under `FOR UPDATE`.

These are **correctness** controls; they also limit economic abuse (double spend of a unique listing, double credit).

### 4.6 Audit trail

- Append-only `AuditLog` in PostgreSQL for seller approval, listing price/cancel, order status transitions, local payment confirmation, and seller-ledger projection correction (`docs/adr/0010-audit-log.md`).
- Read API: `GET /admin/audit-logs` is `authenticate` + `requireRole("ADMIN")`. CUSTOMER/SELLER → 403; missing token → 401.
- `before`/`after` are non-sensitive field diffs. Known secret keys and JWT-shaped values are redacted at write. Full PayPal payloads are not stored.
- Retention: 365 days (documented policy + `createdAt` index). No Redis TTL worker.

---

## 5. Threats and existing mitigations

Format: attacker goal → relevant STRIDE-ish type → what the code does → residual risk.

### T1. Stolen or leaked JWT

**Spoofing.** Access tokens are bearer secrets. Anyone who presents a valid access token is that user until TTL. Mitigation: default 15m access JWT; refresh family revocation on logout/rotate/reuse. Residual: XSS in the frontend, stolen localStorage, or log leakage of `Authorization` impersonates until access expiry. Logout does **not** invalidate in-flight access tokens. No token binding to IP or device. `authenticate` does not consult `RefreshToken`.

### T2. Password stuffing / credential stuffing on `/auth`

**Spoofing / abuse.** Production `authLimiter` default 10 / 15 min / IP, plus the global limiter, plus durable per-email `LoginThrottle` (progressive delay, 429). Passwords hashed (offline dump still requires cracking). Residual: in-memory IP limiter per instance; distributed attackers still face per-email delay in PostgreSQL. No CAPTCHA.

### T3. Privilege escalation (CUSTOMER → ADMIN)

**Elevation.** Register cannot choose `ADMIN` (Zod). Admin routes use `requireRole("ADMIN")` on the JWT `role` claim. Residual: a stolen ADMIN token; an access token issued before a demotion still carries the old role until expiry (refresh reloads the user). Compromised `JWT_SECRET` forges any role.

### T4. IDOR on orders / listings

**Information disclosure / tampering.** Domain rule: customers see only their orders; sellers only orders containing their items. Listing mutations go through seller ownership checks in the listings module. `POST /listings/:id/reserve` requires authentication. Residual: an authenticated customer can still call reserve without creating an order (hold without `reservedByOrderId`). Any new route that loads by id without ownership checks is a regression.

### T5. Client claims “PayPal said paid”

**Spoofing / tampering.** Confirmation is webhook- or reconciliation-GET-path only after provider success, not a client boolean. Residual: none for this specific lie.

### T6. Forged PayPal webhook

**Spoofing.** Signature + cert host allowlist + webhook id (production) + timestamp skew + `SHA256withRSA`. Unsigned or wrong-host cert URL is rejected. Residual: **verification skip when `PAYPAL_WEBHOOK_ID` is missing outside production**; a public staging URL with `NODE_ENV≠production` would accept unsigned events. Compromised PayPal cert/private key is outside this app’s control. No extra IP allowlist.

### T7. Replay / duplicate webhook

**Tampering / repudiation.** Unique `(provider, externalEventId)` on `PaymentWebhookEvent`; duplicate short-circuits. Concurrent duplicates serialize on the unique constraint. Signed body replay after 5 minutes fails freshness even if RSA still verifies. Residual: PayPal changing event ids would look like a new event (provider contract).

### T8. `CHECKOUT.ORDER.APPROVED` treated as money received

**Spoofing (semantic).** Handler stores IGNORED and does not sell. Residual: none for this event type if the switch stays as implemented.

### T9. Two buyers / two payment links for one listing

**Tampering / elevation of privilege over inventory.** Conditional reserve; `PaymentLink` unique per order; payment claim inside a transaction with `reservedByOrderId`. Residual: PayPal orphan order if crash after `OrdersCreate` and before persist — operational, not a second local sale.

### T10. Capture completed after reservation expired

**Tampering vs money.** Local conflict, listing not SOLD, HTTP 200 to PayPal. Residual: **funds may remain captured at PayPal** until a human refunds/voids in the dashboard (no API in repo).

### T11. Secrets in logs or error payloads

**Information disclosure.** `errorHandler` hides unhandled stacks from clients. OTel `redact.ts` drops token-like attributes. Residual: a future `console.log` of headers/bodies; Render log access by operators; demo seed emails if `SEED_DEMO_DATA=true`; **non-production register returns the verification `code` in the JSON body**.

### T12. SSRF via webhook certificate URL

**Spoofing / abuse.** Cert URL parse: HTTPS only, host must be PayPal API hosts. Residual: if PayPal’s documented host list changes, the allowlist must change; no fetch of arbitrary URLs.

### T13. CORS / browser cross-origin calls

**Abuse from a malicious site.** Allowed origins are `FRONTEND_URL`; local Vite origins are appended only when `NODE_ENV≠production`. Residual: if production `FRONTEND_URL` is unset, the configured default is still `http://localhost:5173`. Bearer tokens are typically sent by JS, not cookies, so classic cookie CSRF is not the session model. CORS does not stop non-browser clients.

### T14. Rate-limit bypass / DoS of the Node process

**Denial of service.** Per-client in-memory limiter on every route in production. Caller-controlled `X-Forwarded-For` cannot rotate the key in the supported Render topology; invalid edge metadata falls back to a shared socket bucket. Residual: **not cluster-safe**; webhook path is on the same process (signature work + CRC). Health vs ready: `/health` stays up during drain while `/ready` fails (O1) — availability design, not a DDoS shield. No repository-controlled WAF.

### T15. Database as attacker (compromised Postgres)

**Tampering.** If an attacker has SQL access, application checks are bypassed. Constraints (unique payment event, unique listing sold, unique seller txn) still help. Residual: defense in depth is IAM/network on Render Postgres, not in application code. No encryption-at-rest policy is defined in this repo beyond the provider’s default.

### T16. Email as account recovery oracle

**Spoofing / disclosure.** Verify-email uses a 6-digit code via Resend. Residual: email compromise is account compromise for those flows. In non-production the code is also returned in the register response. No extra channel.

### T17. Default JWT secret on a public process

**Spoofing.** `jwt.ts` uses a compiled fallback if `JWT_SECRET` is unset outside production. Residual: a non-production public URL without env is still impersonable. Production start fails closed. Render Blueprint generates secrets.

---

## 6. Explicitly absent (do not claim)

Do **not** interview as if these exist:

| Control | Status |
|---|---|
| Helmet npm package | Not used; equivalent headers are set in `securityHeaders` |
| CSRF tokens | N/A to Bearer-header API; not implemented |
| WAF / Render firewall rules in repo | Not defined here |
| Shared rate-limit store (Redis, etc.) | Intentionally not added |
| PayPal refund / void API | Not implemented (R2 human decision) |
| mTLS to PayPal or Postgres | Not implemented |
| Webhook IP allowlist | Not implemented (signature is the control) |
| AWS Secrets Manager / ECS task role | Not the current deploy |
| 2FA / WebAuthn | Not implemented |
| Access-token denylist | Not implemented (refresh family allowlist only; access JWT expires on TTL) |
| Field-level encryption of PII | Not implemented |

---

## 7. Production configuration that changes the threat model

| Setting | Effect |
|---|---|
| `NODE_ENV=production` | Stricter default rate limits; PayPal webhook id **required** (verify fails if missing); register response omits the email `code`; HSTS is sent; JWT secrets must be non-default or the process does not listen; CORS does not append local Vite origins. |
| `PAYPAL_WEBHOOK_ID` unset + non-production | Webhook **signature verification skipped** — never use that combination on a public URL. |
| `SEED_DEMO_DATA=true` | Known demo users (Blueprint currently `true`). Treat as public demo, not a private production. |
| `RATE_LIMIT_API_MAX` / `RATE_LIMIT_AUTH_MAX` | Raises/lowers stuffing and scan cost. |
| `RENDER=true` | Platform-provided signal enabling trust in Render's overwritten `CF-Connecting-IP`; outside Render the socket peer is used. |
| `FRONTEND_URL` | CORS allowlist. Local Vite origins are added only when `NODE_ENV≠production`. |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Must be non-default in production; compiled fallbacks are development-only. |

---

## 8. What this document is for

Use it to explain, in an interview, **where trust stops**, **why the webhook is unauthenticated at Express**, **why the client cannot confirm payment**, and **which controls are real versus aspirational**. Update this file when a listed control is added or removed in code — do not add a control in this document first.

Automated abuse coverage for T3–T7, T10, and listing/order IDOR is in `server/src/__tests__/api.security.integration.test.ts` (#72), plus the existing PayPal webhook and listing ownership unit tests.
