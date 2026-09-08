# Frontend — brand locks (P-front archive)

The F0 visual rebuild is complete. Brand, visual, and seller IA locks below still apply. New product work is allowed when an authoritative Task or explicit human request asks for it and the API already exists.

## Locked decisions

| Decision | Value |
|---|---|
| Brand | **Neon Arsenal**. Remove SKINMARKET / SkinMarket / “CS2 Skin Marketplace”. |
| Visual | **Dark editorial**. No neon glow, scan-lines, grid-pattern, or global uppercase headings. |
| Seller IA | Keep both routes. `/seller/listings` = unique-item CRUD. `/seller/products` = **read-only** Product catalog (`listProducts`). Seller cannot create/update/delete Product (API is ADMIN-only). |

## Out of scope (unless an authoritative artifact explicitly requires it)

- Inventing routes or fields that have no existing API
- Any change under `server/`, Prisma, auth/payment/reservation semantics
- Weakening CORS, rate limits, auth, or tests
- Inventing environment variables

The original F0 rebuild freeze (no search/reviews/history) does **not** block later authoritative Tasks that use existing endpoints.

## How this sprint is executed

Brand/visual/seller locks in this file still apply. Execution follows `docs/agents/harness.md`: name a Task or Plan, describe the work, or use direct `next` semantics. External Issues are optional context.

## Inventory (current app)

| Surface | Routes | Behavior to preserve |
|---|---|---|
| Storefront | `/`, `/products`, `/listing/:id` | Home: 8 ACTIVE listings. Market: exterior / StatTrak / price / client-side sort / pagination. Detail: float, pattern, trade lock, price history, related, cart. |
| Purchase | `/cart`, `/checkout` | Device-local cart (`localStorage` schema v1 in `src/lib/cartStorage.ts`). Not multi-device and not account-bound; logout keeps the guest cart. Checkout only `CUSTOMER`. `createOrder` + PayPal. 5% display total stays unless a later issue says otherwise. |
| Auth | `/login`, `/register` | Login. Register 2-step email code. `CUSTOMER` or `SELLER` + `storeName`. |
| Seller | `/seller`, `/seller/products`, `/seller/listings`, `/seller/orders`, `/seller/transactions` | Stats from `/commissions/balance` + `GET /sellers/me` commission rate, listing CRUD on listings, orders, ledger transactions. Products page must stop being a second listing CRUD. |
| Admin | `/admin`, `/admin/sellers`, `/admin/orders`, `/admin/users` | Stats, approve seller, orders, users, commission display. |
| Shell | `MainLayout`, `DashboardLayout`, `Header` | Nav, auth, cart. Dashboard needs mobile nav (today sidebar is `lg` only). |

Dead template (remove in F0.4 if unused): `src/pages/ProductDetail.tsx`, `src/services/mock-data.ts`.

## Graph

```text
F0.1 → F0.2 → F0.3 → F0.4
                      ↓
            ┌─────────┼─────────┐
            S2        A1        C1
            ↓
          S1 + S3
            ↓
          D1 ∥ D2
            ↓
        Q1 → Q2 → Q3
```

S2 owns `ListingCard` / `ProductCard`. S1 and S3 wait for S2 to merge. D1/D2 must not edit Header or layouts after F0.3.

## Activities

The graph and inventory in this document preserve the human-readable **completed rebuild** archive. Full removed catalog history remains available in Git. Current state comes from repository Tasks and verification evidence.

## Parallelism with backend

Backend and frontend Tasks may run at the same time only when dependencies, allowed files, and affected invariants are disjoint under the harness parallelism rules.
