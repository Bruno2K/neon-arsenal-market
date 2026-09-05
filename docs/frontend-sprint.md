# Frontend — brand locks (P-front archive)

The F0 visual rebuild is complete. Brand, visual, and seller IA locks below still apply. **New product work is allowed when an open GitHub issue asks for it** and the API already exists.

## Locked decisions

| Decision | Value |
|---|---|
| Brand | **Neon Arsenal**. Remove SKINMARKET / SkinMarket / “CS2 Skin Marketplace”. |
| Visual | **Dark editorial**. No neon glow, scan-lines, grid-pattern, or global uppercase headings. |
| Seller IA | Keep both routes. `/seller/listings` = unique-item CRUD. `/seller/products` = **read-only** Product catalog (`listProducts`). Seller cannot create/update/delete Product (API is ADMIN-only). |

## Out of scope (unless a GitHub issue explicitly requires it)

- Inventing routes or fields that have no existing API
- Any change under `server/`, Prisma, auth/payment/reservation semantics
- Weakening CORS, rate limits, auth, or tests
- Inventing environment variables

The original F0 rebuild freeze (no search/reviews/history) does **not** block later GitHub issues that use existing endpoints.

## How this sprint is executed

Brand/visual/seller locks in this file still apply. The **executable queue is GitHub issues**, not `activities.json`.

1. Run `python3 scripts/orchestrator/next.py --track frontend --prompt`.
2. The parent agent spawns the printed subagent(s).
3. Human reviews the draft PR.

`python3 scripts/p-front/next.py` is a shim. Optional bulk issue creation (`python3 scripts/p-front/create-issues.py`) remains write-only metadata; agents must not treat JSON as intake.

## Inventory (current app)

| Surface | Routes | Behavior to preserve |
|---|---|---|
| Storefront | `/`, `/products`, `/listing/:id` | Home: 8 ACTIVE listings. Market: exterior / StatTrak / price / client-side sort / pagination. Detail: float, pattern, trade lock, price history, related, cart. |
| Purchase | `/cart`, `/checkout` | Local cart. Checkout only `CUSTOMER`. `createOrder` + PayPal. 5% display total stays unless a later issue says otherwise. |
| Auth | `/login`, `/register` | Login. Register 2-step email code. `CUSTOMER` or `SELLER` + `storeName`. |
| Seller | `/seller`, `/seller/products`, `/seller/listings`, `/seller/orders` | Stats, listing CRUD on listings, orders. Products page must stop being a second listing CRUD. |
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

See `scripts/p-front/activities.json` for the **completed rebuild** acceptance archive. Status is not edited in this file.

Compute the next GitHub issue with:

```bash
python3 scripts/orchestrator/next.py --track frontend
```

Done = GitHub issue closed, or equivalent work already on `origin/main`.
In progress = an open PR that references the issue.

## Parallelism with backend

Backend work uses the same orchestrator (`--track backend`). A backend subagent and a frontend subagent may run at the same time only while PRs stay disjoint (`src/` vs `server/`).
