# API security hardening checklist

Issue `#58` / `SPEC-0005`. Each control is implemented in `server/` and proven by an automated test. Do not claim a control that is only documented here.

| Control | Where | Automated evidence |
|---|---|---|
| Security headers (nosniff, DENY frame, referrer, CSP frame-ancestors, permissions, HSTS in production) | `securityHeaders` in `app.ts` | `server/src/shared/middlewares/__tests__/securityHeaders.test.ts`; `server/src/__tests__/api.security.test.ts` |
| JSON body limit 100 KiB → HTTP 413 | `express.json({ limit })` + `errorHandler` | `server/src/__tests__/api.security.test.ts` |
| Explicit CORS allowlist; no hardcoded Vite origins in production | `shared/config/cors.ts` | `server/src/shared/config/__tests__/cors.test.ts`; `server/src/__tests__/api.security.test.ts` |
| Zod body/params/query validation; resource ids ≤ 128; register cannot choose ADMIN | DTOs + `validate*` | `server/src/shared/types/__tests__/roles.test.ts`; `server/src/shared/validation/__tests__/httpLimits.test.ts` |
| IDOR: customer cannot read another customer's order | `ordersService.getById` | `server/src/__tests__/api.security.integration.test.ts` |
| Privilege: `/admin` requires ADMIN | `authenticate` + `requireRole` | `server/src/__tests__/api.security.integration.test.ts`; `server/src/modules/admin/__tests__/admin.audit.routes.test.ts` |
| Seller cannot mutate another seller's listing | `listingsService.update` / `cancel` | `server/src/modules/listings/__tests__/listings.invariants.test.ts` |
| Review update/delete is owner-only | `reviewsService` | `server/src/modules/reviews/reviews.service.ts` (403 `Not your review`) |
| Anonymous listing reserve rejected | `POST /listings/:id/reserve` + `authenticate` | `server/src/modules/listings/__tests__/listings.security.test.ts` |
| Client cannot PATCH listing `status` | `updateListingDto` omits `status` | `server/src/modules/listings/__tests__/listings.security.test.ts` |
| PayPal webhook RSA-SHA256 + freshness + cert host allowlist | `verifyPayPalWebhookSignature` | `server/src/shared/utils/__tests__/paypalWebhook.test.ts` |
| Production refuses default JWT secrets | `assertProductionJwtSecrets` in `startApiProcess` | `server/src/shared/utils/__tests__/jwt.test.ts` |
| Error JSON hides stacks, Origin, raw bodies | `errorHandler` | `server/src/shared/errors/__tests__/errorHandler.test.ts` |
| Non-spoofable rate-limit identity on Render; IPv6 /56 grouping | `resolveClientIp`, `apiLimiter`, `authLimiter` | `clientIp.test.ts`; `rateLimit.test.ts` |
| Secrets stay in existing env vars | Render Blueprint + `.env.example` | no new env vars in this increment |

## Out of scope (do not interview as shipped)

- Helmet npm package (headers are explicit middleware)
- Shared Redis rate-limit store
- Access-token denylist, 2FA, WAF, CSRF cookies
- PayPal refund/void API
- AWS Secrets Manager
