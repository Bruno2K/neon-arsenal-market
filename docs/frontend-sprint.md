# P-front — Frontend rebuild (no new features)

Parallel sprint to backend P1. Rebuild the existing React/Vite client with modern UX. Do not add product functionality.

## Locked decisions

| Decision | Value |
|---|---|
| Brand | **Neon Arsenal**. Remove SKINMARKET / SkinMarket / “CS2 Skin Marketplace”. |
| Visual | **Dark editorial**. No neon glow, scan-lines, grid-pattern, or global uppercase headings. |
| Seller IA | Keep both routes. `/seller/listings` = unique-item CRUD. `/seller/products` = **read-only** Product catalog (`listProducts`). Seller cannot create/update/delete Product (API is ADMIN-only). |

## Out of scope

- New routes, search, reviews, buyer order history, real skin images, i18n, PWA
- Any change under `server/`, Prisma, auth/payment/reservation semantics
- Weakening CORS, rate limits, auth, or tests
- Inventing APIs or environment variables

## How this sprint is executed

Do **not** open or paste fifteen GitHub issues by hand.

1. Source of truth is this file plus `scripts/p-front/activities.json`.
2. A Cloud Agent runs `python3 scripts/p-front/next.py` and implements **only** the printed activity.
3. PR title must be `[P-front] <ID> — <title>`.
4. Human reviews and merges.
5. Human (or the same conversation after merge) says `next`. The agent repeats from step 2.

Optional GitHub issues, one command on a machine with `gh` write access:

```bash
python3 scripts/p-front/create-issues.py
```

This Cloud Agent cannot create issues (`gh` is read-only here). Issues are optional metadata. Agents must follow the files above even if no issue exists.

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

See `scripts/p-front/activities.json` for acceptance criteria, owner files, and verify commands. Status is **not** edited in this file (avoids merge conflicts). Compute it with:

```bash
python3 scripts/p-front/next.py
```

Done = a commit on `origin/main` whose subject contains `[P-front] <ID>`.
In progress = an open PR whose title contains `[P-front] <ID>`.

## Parallelism with backend

Backend uses its own control plane: `docs/backend-sprint.md` and `python3 scripts/p-back/next.py`. A P-back agent/PR may run at the same time. Do not mix `src/` and `server/` in one PR. Do not edit `docs/backend-sprint.md` or `scripts/p-back/` from P-front.
