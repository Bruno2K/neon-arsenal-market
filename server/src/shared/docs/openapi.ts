/**
 * Neon Arsenal Market — OpenAPI 3.0 specification
 *
 * Served at GET /docs as Swagger UI (CDN-based, no extra packages needed).
 * Raw JSON available at GET /docs/json.
 *
 * Current public contract is `/api/v1` (SPEC-0007 / ADR 0017). Unversioned
 * domain paths are compatibility aliases of the same v1 handlers. Health and
 * docs stay at the host root. Policy: docs/architecture/api-versioning.md.
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Neon Arsenal Market API",
    version: "1.0.0",
    description:
      "REST API for Neon Arsenal Market — a CS2 skin marketplace with PayPal payments, " +
      "seller commissions, and admin management. Current public base is `/api/v1`. " +
      "Unversioned domain paths (`/auth`, `/listings`, `/payments`, …) are v1 compatibility " +
      "aliases and must not diverge. Additive changes may land on v1; breaking changes " +
      "require a new major prefix. Operational `/health`, `/ready`, and `/docs` are unversioned. " +
      "See docs/architecture/api-versioning.md.",
    contact: { name: "Bruno", email: "brunoharry2009@gmail.com" },
  },
  servers: [
    { url: "http://localhost:3001/api/v1", description: "Local development — current public contract (v1)" },
    { url: "https://api.neonarsenal.com/api/v1", description: "Production — current public contract (v1)" },
    { url: "http://localhost:3001", description: "Local unversioned v1 compatibility aliases" },
    { url: "https://api.neonarsenal.com", description: "Production unversioned v1 compatibility aliases" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token obtained from /api/v1/auth/login or /api/v1/auth/refresh (unversioned /auth/* aliases work)",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Not found" },
          statusCode: { type: "integer", example: 404 },
        },
      },
      OffsetPage: {
        type: "object",
        required: ["items", "total", "page", "limit"],
        properties: {
          items: { type: "array", items: { type: "object" } },
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
          nextCursor: {
            type: "string",
            nullable: true,
            description:
              "Opaque createdAt+id cursor for the next keyset page. Null when this offset page is the last. Additive; existing Market clients ignore it.",
          },
        },
      },
      CursorPage: {
        type: "object",
        required: ["items", "limit", "nextCursor"],
        properties: {
          items: { type: "array", items: { type: "object" } },
          limit: { type: "integer" },
          nextCursor: {
            type: "string",
            nullable: true,
            description: "Opaque createdAt+id cursor. Null on the last page.",
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "clx1234567890" },
          name: { type: "string", example: "Bruno" },
          email: { type: "string", format: "email", example: "bruno@example.com" },
          role: { type: "string", enum: ["ADMIN", "SELLER", "CUSTOMER"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/User" },
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
        },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          game: { type: "string", example: "CS2" },
          weapon: { type: "string" },
          skinName: { type: "string" },
          rarity: { type: "string" },
          exterior: { type: "string" },
          collection: { type: "string", nullable: true },
          imageUrl: { type: "string", nullable: true },
          isStattrak: { type: "boolean" },
          isSouvenir: { type: "boolean" },
          marketHashName: {
            type: "string",
            nullable: true,
            description: "Steam / cs2.sh market_hash_name. Null on hand-seeded demo products.",
          },
          referencePriceUsd: {
            type: "string",
            nullable: true,
            description:
              "cs2.sh USD ask for catalog reference only. Not PayPal/ledger currency (ADR 0014).",
          },
        },
      },
      Listing: {
        type: "object",
        properties: {
          id: { type: "string" },
          productId: { type: "string" },
          sellerId: { type: "string" },
          floatValue: { type: "number", example: 0.14501234 },
          pattern: { type: "integer", nullable: true },
          price: { type: "number", example: 149.99 },
          currency: { type: "string", example: "USD" },
          status: { type: "string", enum: ["ACTIVE", "SOLD", "RESERVED", "CANCELED"] },
          tradeLockUntil: { type: "string", format: "date-time", nullable: true },
          reservedAt: { type: "string", format: "date-time", nullable: true },
          reservationExpiresAt: { type: "string", format: "date-time", nullable: true },
          reservedByOrderId: { type: "string", nullable: true },
          steamAssetId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          soldAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          customerId: { type: "string" },
          totalAmount: { type: "number", example: 299.98 },
          status: {
            type: "string",
            enum: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
          },
          paymentStatus: { type: "string", enum: ["PENDING", "PAID", "REFUNDED"] },
          paypalOrderId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Seller: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          storeName: { type: "string" },
          commissionRate: { type: "number", example: 0.1 },
          balance: { type: "number", example: 0 },
          rating: { type: "number", example: 0 },
          isApproved: { type: "boolean" },
        },
      },
      AuditLog: {
        type: "object",
        properties: {
          id: { type: "string" },
          actorId: { type: "string", nullable: true },
          actorRole: { type: "string", enum: ["ADMIN", "SELLER", "CUSTOMER"], nullable: true },
          action: { type: "string", example: "LISTING_PRICE_CHANGE" },
          resourceType: { type: "string", example: "Listing" },
          resourceId: { type: "string" },
          before: { type: "object", nullable: true, additionalProperties: true },
          after: { type: "object", nullable: true, additionalProperties: true },
          ip: { type: "string", nullable: true },
          userAgent: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Cs2ShImportSummary: {
        type: "object",
        properties: {
          skipped: { type: "boolean" },
          skipReason: { type: "string", enum: ["missing_api_key"] },
          generationId: { type: "string", nullable: true },
          productsUpserted: { type: "integer" },
          schemaSkipped: { type: "integer" },
          listingsUpserted: { type: "integer" },
        },
      },
      Cs2ShImportStatus: {
        type: "object",
        properties: {
          running: { type: "boolean" },
          lastResult: {
            allOf: [{ $ref: "#/components/schemas/Cs2ShImportSummary" }],
            nullable: true,
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        security: [],
        servers: [
          { url: "http://localhost:3001", description: "Local operational (unversioned)" },
          { url: "https://api.neonarsenal.com", description: "Production operational (unversioned)" },
        ],
        responses: {
          200: { description: "Service is running", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" } } } } } },
        },
      },
    },
    "/ready": {
      get: {
        tags: ["Health"],
        summary: "Readiness check",
        servers: [
          { url: "http://localhost:3001", description: "Local operational (unversioned)" },
          { url: "https://api.neonarsenal.com", description: "Production operational (unversioned)" },
        ],
        description:
          "Returns 200 when PostgreSQL is reachable. Returns 503 `unavailable` when the database check fails, or 503 `shutting_down` after SIGTERM/SIGINT so Render (`healthCheckPath: /ready`) can stop sending traffic. Liveness remains `GET /health`. Not versioned under `/api/v1`.",
        security: [],
        responses: {
          200: { description: "Process can serve traffic", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ready" } } } } } },
          503: { description: "Database unreachable or process shutting down" },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register (step 1 — sends verification code)",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string", example: "Bruno" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8, maxLength: 72, description: "At least 8 characters, one letter and one number" },
                  role: { type: "string", enum: ["CUSTOMER", "SELLER"], default: "CUSTOMER" },
                  storeName: { type: "string", description: "Required when role=SELLER" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Verification code sent" },
          409: { description: "Email already registered" },
        },
      },
    },
    "/auth/verify-email": {
      post: {
        tags: ["Auth"],
        summary: "Verify email with 6-digit code (step 2 — creates account)",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "code"],
                properties: {
                  email: { type: "string", format: "email" },
                  code: { type: "string", minLength: 6, maxLength: 6, example: "123456" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Account created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          400: { description: "Invalid or expired code" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          401: { description: "Invalid credentials" },
          429: { description: "Too many login attempts — Retry-After seconds until the next try is allowed" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate refresh token — returns a new access + refresh pair in the same family",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: { refreshToken: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "New tokens issued",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          401: { description: "Token expired, unknown, or family revoked after reuse" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout — revokes the refresh token family",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { refreshToken: { type: "string" } },
              },
            },
          },
        },
        responses: { 200: { description: "Logged out" } },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        responses: {
          200: {
            description: "Current user",
            content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
          },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/listings": {
      get: {
        tags: ["Listings"],
        summary: "Browse listings with filters",
        description:
          "Public listing browse. Offset pagination (`page`/`limit`) remains the default so existing Market clients keep working. " +
          "When `cursor` is present (empty string = first keyset page), `page` is ignored and the response is `{ items, limit, nextCursor }` " +
          "ordered by `createdAt DESC, id DESC`. The cursor is opaque base64url of those two keys; clients must not parse it. " +
          "Limit is 1–100 (default 20). Concurrent inserts do not skip or duplicate rows already walked by a cursor.",
        security: [],
        parameters: [
          {
            name: "cursor",
            in: "query",
            required: false,
            schema: { type: "string", maxLength: 512 },
            description:
              "Opaque keyset cursor. Omit for offset mode. Empty value starts keyset mode from the newest row. " +
              "A previous `nextCursor` continues the walk. Invalid values return 400.",
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
            description: "Offset page. Ignored when `cursor` is present. Default 1 in offset mode.",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          { name: "productId", in: "query", schema: { type: "string" } },
          { name: "sellerId", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "RESERVED", "SOLD", "CANCELED"] } },
          { name: "minPrice", in: "query", schema: { type: "number" } },
          { name: "maxPrice", in: "query", schema: { type: "number" } },
          { name: "minFloat", in: "query", schema: { type: "number" } },
          { name: "maxFloat", in: "query", schema: { type: "number" } },
          { name: "exterior", in: "query", schema: { type: "string" } },
          { name: "isStattrak", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          200: {
            description: "Paginated listings (offset or cursor mode)",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OffsetPage" },
                    { $ref: "#/components/schemas/CursorPage" },
                  ],
                },
              },
            },
          },
          400: { description: "Invalid cursor or query" },
        },
      },
    },
    "/products": {
      get: {
        tags: ["Products"],
        summary: "Browse product catalog",
        description:
          "Public catalog list. Same dual pagination as GET /listings: omit `cursor` for `{ items, total, page, limit }`; " +
          "pass `cursor` for `{ items, limit, nextCursor }`. Order is `createdAt DESC, id DESC`. Limit 1–100, default 20. " +
          "Imported skins expose `marketHashName` and `referencePriceUsd` (USD catalog ask; not checkout currency).",
        security: [],
        parameters: [
          {
            name: "cursor",
            in: "query",
            required: false,
            schema: { type: "string", maxLength: 512 },
            description: "Opaque keyset cursor. Empty starts from the newest product. Invalid values return 400.",
          },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { name: "game", in: "query", schema: { type: "string" } },
          { name: "weapon", in: "query", schema: { type: "string" } },
          { name: "exterior", in: "query", schema: { type: "string" } },
          { name: "rarity", in: "query", schema: { type: "string" } },
          { name: "isStattrak", in: "query", schema: { type: "boolean" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Paginated products (offset or cursor mode)",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OffsetPage" },
                    { $ref: "#/components/schemas/CursorPage" },
                  ],
                },
              },
            },
          },
          400: { description: "Invalid cursor or query" },
        },
      },
    },
    "/orders": {
      post: {
        tags: ["Orders"],
        summary: "Create a new order",
        description:
          "Creates an order and atomically reserves the requested listings. Clients must send an `Idempotency-Key` header. Reusing the same key with the same listing set returns the original order; reusing it with a different request returns 409.",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string", minLength: 1, maxLength: 128 },
            description: "Customer-scoped key used to make order creation safe to retry.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["items"],
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["listingId"],
                      properties: { listingId: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Order created", content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } },
          400: { description: "Listing unavailable or trade locked" },
          409: { description: "Idempotency key was reused with a different order request" },
          404: { description: "Listing not found" },
        },
      },
    },
    "/orders/{id}/status": {
      patch: {
        tags: ["Orders"],
        summary: "Apply a valid order status transition",
        description:
          "Replaces free status updates with the fulfillment state machine. Allowed: PENDING→CONFIRMED|CANCELLED, CONFIRMED→SHIPPED|CANCELLED, SHIPPED→DELIVERED. DELIVERED and CANCELLED are terminal. CUSTOMER may cancel own PENDING/CONFIRMED orders and confirm SHIPPED→DELIVERED. ADMIN may apply any graph edge. SELLER cannot change status. Concurrent transitions from the same row return 409.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Transition applied", content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } },
          400: { description: "Invalid or terminal transition" },
          403: { description: "Role cannot apply this transition, or the order is not the caller's" },
          404: { description: "Order not found" },
          409: { description: "A concurrent request already changed the order status" },
        },
      },
    },
    "/payments/create": {
      post: {
        tags: ["Payments"],
        summary: "Create PayPal payment link for an order",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId"],
                properties: {
                  orderId: { type: "string" },
                  returnUrl: {
                    type: "string",
                    format: "uri",
                    description:
                      "Optional absolute URL forwarded to PayPal OrdersCreate as application_context.return_url. Omitted when absent. Does not confirm payment.",
                  },
                  cancelUrl: {
                    type: "string",
                    format: "uri",
                    description:
                      "Optional absolute URL forwarded to PayPal OrdersCreate as application_context.cancel_url. Omitted when absent. Does not confirm payment.",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "PayPal approval URL returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    orderId: { type: "string" },
                    approvalUrl: { type: "string", format: "uri" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/payments/capture": {
      post: {
        tags: ["Payments"],
        summary: "Capture an approved PayPal order",
        description:
          "Authenticated customer-only. Calls PayPal OrdersCapture when the remote order is APPROVED and the local reservation is still live. Local PAID is applied only if PayPal reports COMPLETED (same confirmPayment path as the capture webhook and GET reconciliation). The client cannot set paymentStatus. Expired holds are not captured (HTTP 409).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId"],
                properties: {
                  orderId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "PayPal status after capture or lookup",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    orderId: { type: "string" },
                    paymentStatus: { type: "string", enum: ["PAID", "PENDING"] },
                    paypalStatus: { type: "string" },
                  },
                },
              },
            },
          },
          403: { description: "Order is not the caller's" },
          409: { description: "Reservation expired; PayPal was not captured" },
        },
      },
    },
    "/payments/webhook": {
      post: {
        tags: ["Payments"],
        summary: "PayPal webhook receiver",
        security: [],
        description:
          "Receives PayPal webhook events. Authenticity is verified with official RSA-SHA256 self-verification (`transmissionId|timestamp|webhookId|crc32(rawBody)` plus the certificate at `paypal-cert-url`). `paypal-transmission-time` must be RFC 3339 and within 5 minutes of the server clock (absolute skew) to reject replayed signed requests. Required headers: `paypal-transmission-id`, `paypal-transmission-time`, `paypal-transmission-sig`, `paypal-cert-url`, `paypal-auth-algo`. Only `PAYMENT.CAPTURE.COMPLETED` confirms local payment. `CHECKOUT.ORDER.APPROVED` is stored as an intermediate event and does not sell listings. Duplicate event IDs are idempotent. HTTP 200 is returned for business-rule failures such as an expired reservation so PayPal does not retry forever; HTTP 503 is returned when the local order cannot be resolved yet.",
        parameters: [
          { name: "paypal-transmission-id", in: "header", required: true, schema: { type: "string" } },
          { name: "paypal-transmission-time", in: "header", required: true, schema: { type: "string" } },
          { name: "paypal-transmission-sig", in: "header", required: true, schema: { type: "string" } },
          { name: "paypal-cert-url", in: "header", required: true, schema: { type: "string" } },
          { name: "paypal-auth-algo", in: "header", required: true, schema: { type: "string", example: "SHA256withRSA" } },
        ],
        responses: {
          200: { description: "Webhook accepted, duplicated, ignored, or rejected by business rule" },
          401: { description: "Invalid or missing signature" },
          503: { description: "Capture event could not be matched to a local order yet; PayPal should retry" },
        },
      },
    },
    "/sellers/apply": {
      post: {
        tags: ["Sellers"],
        summary: "Apply to become a seller",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["storeName"],
                properties: { storeName: { type: "string" } },
              },
            },
          },
        },
        responses: {
          201: { description: "Seller profile created (pending approval)" },
          409: { description: "Already a seller" },
        },
      },
    },
    "/commissions/transactions": {
      get: {
        tags: ["Commissions"],
        summary: "List seller transactions (SELLER: own; ADMIN: all)",
        responses: { 200: { description: "Transaction list" } },
      },
    },
    "/commissions/balance": {
      get: {
        tags: ["Commissions"],
        summary: "Get seller balance",
        responses: {
          200: {
            description: "Balance",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    balance: {
                      type: "string",
                      example: "135.00",
                      description:
                        "Seller.balance projection as a Prisma Decimal JSON string (same wire format as listing price and order totalAmount). Not a JSON number.",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/admin/audit-logs": {
      get: {
        tags: ["Admin"],
        summary: "List audit logs",
        description:
          "ADMIN-only trail of sensitive mutations (seller approval, listing price/cancel, order status, local payment confirmation). before/after are non-sensitive field diffs. Retention: 365 days. CUSTOMER/SELLER receive 403.",
        parameters: [
          { name: "actorId", in: "query", schema: { type: "string" } },
          { name: "action", in: "query", schema: { type: "string" } },
          { name: "resourceType", in: "query", schema: { type: "string" } },
          { name: "resourceId", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
        ],
        responses: {
          200: {
            description: "Paginated audit rows",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/AuditLog" },
                    },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                  },
                },
              },
            },
          },
          401: { description: "Missing or invalid access token" },
          403: { description: "Caller is not ADMIN" },
        },
      },
    },
    "/admin/catalog/cs2sh-import": {
      get: {
        tags: ["Admin"],
        summary: "cs2.sh catalog import status",
        description:
          "ADMIN-only in-process status. Render has no SSH; use this or POST to import without a shell. running is true while GET /v1/schema + /v1/prices/latest and the DB upsert are in flight. lastResult is the last completed summary on this process (lost on restart).",
        responses: {
          200: {
            description: "Import status for this API process",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Cs2ShImportStatus" },
              },
            },
          },
          401: { description: "Missing or invalid access token" },
          403: { description: "Caller is not ADMIN" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "Start cs2.sh catalog import",
        description:
          "ADMIN-only. Starts the cs2.sh catalog upsert in the background and returns 202 before database writes finish. Requires CS2SH_API_KEY. Concurrent starts on the same process return 409. Does not block GET /ready. Alternative: set CS2SH_IMPORT=true so boot schedules the same work after listen.",
        responses: {
          202: {
            description: "Import started on this process",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/Cs2ShImportStatus" },
                    {
                      type: "object",
                      properties: { status: { type: "string", example: "started" } },
                    },
                  ],
                },
              },
            },
          },
          401: { description: "Missing or invalid access token" },
          403: { description: "Caller is not ADMIN" },
          409: { description: "An import is already running on this process" },
          503: { description: "CS2SH_API_KEY is not configured" },
        },
      },
    },
  },
} as const;
