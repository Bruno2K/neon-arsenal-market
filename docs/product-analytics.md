# Product analytics

Frontend funnel telemetry for Neon Arsenal. This is **not** backend OpenTelemetry (`docs/observability.md`). There is no required vendor and **no new env var**.

## Sink

`track(event, props)` in `src/lib/analytics.ts`:

- **No collector registered (default):** no-op. The app works with the sink off.
- **Development:** events also go to `console.info("[analytics]", event, props)`.
- **Production:** stays no-op until a collector is registered. Consent is not implemented; do not add a cookie banner or a vendor SDK here.
- Optional hook: `setAnalyticsCollector(fn)` for tests or a future consented sink. Failures in `track` never throw.

Do not send email, JWT, password, names, or PayPal tokens.

## Funnel

```text
page_view
  → category_view (Home chip / Market exterior)
  → search (Market productId or applied filters)
  → search_result_click (Market card)
  → product_view (PDP)
  → cart_add / cart_remove
  → checkout_started
  → payment_started (PayPal redirect)
  → payment_return | payment_cancel
  → order_viewed
seller_listing_created (seller CRUD, not the buyer path)
```

## Events

| Event                    | When                                      | Props                                                      |
| ------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| `page_view`              | Route change after auth is resolved       | `path`, `role` (`CUSTOMER` / `SELLER` / `ADMIN` / `guest`) |
| `search`                 | Market has `productId` or filters         | `query`, `productId`, `source=market`, `resultCount`       |
| `search_result_click`    | Click a Market listing card               | `listingId`, `productId`, `price`, `source=market`         |
| `category_view`          | Home catalog chip or Market exterior chip | `productId` or `category`, `source`                        |
| `product_view`           | Listing detail loaded                     | `listingId`, `productId`, `price`, `source`                |
| `cart_add`               | Listing added to the local cart           | `listingId`, `productId`, `price`, `source`                |
| `cart_remove`            | Buyer removes a cart line                 | `listingId`, `productId`, `price`                          |
| `checkout_started`       | Customer checkout form shown              | `itemCount`                                                |
| `payment_started`        | PayPal link created / retry               | `orderId`                                                  |
| `payment_return`         | `/orders/:id/return`                      | `orderId`                                                  |
| `payment_cancel`         | `/orders/:id/cancel`                      | `orderId`                                                  |
| `order_viewed`           | Order status loaded                       | `orderId`                                                  |
| `seller_listing_created` | Seller creates a listing                  | `listingId`, `productId`, `price`, `source=seller`         |

`price` is a string (API decimal), never a JS `number` calculation. `source` is `home` \| `market` \| `related` \| `seller`.

The Market has no free-text search box. `search` is the current discovery query (`productId` from Home shortcuts, exterior / StatTrak / price filters).
