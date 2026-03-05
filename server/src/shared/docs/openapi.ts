/**
 * Neon Arsenal Market — OpenAPI 3.0 specification
 *
 * Served at GET /docs as Swagger UI (CDN-based, no extra packages needed).
 * Raw JSON available at GET /docs/json.
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Neon Arsenal Market API",
    version: "1.0.0",
    description:
      "REST API for Neon Arsenal Market — a CS2 skin marketplace with PayPal payments, " +
      "seller commissions, and admin management.",
    contact: { name: "Bruno", email: "brunoharry2009@gmail.com" },
  },
  servers: [
    { url: "http://localhost:3001", description: "Local development" },
    { url: "https://api.neonarsenal.com", description: "Production" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token obtained from /auth/login or /auth/refresh",
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
          steamAssetId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
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
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        security: [],
        responses: {
          200: { description: "Service is running", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" } } } } } },
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
                  password: { type: "string", minLength: 6 },
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
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate refresh token — returns new access + refresh token pair",
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
          401: { description: "Token revoked or expired" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout — revokes the refresh token",
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
        security: [],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "weapon", in: "query", schema: { type: "string" } },
          { name: "exterior", in: "query", schema: { type: "string" } },
          { name: "rarity", in: "query", schema: { type: "string" } },
          { name: "minPrice", in: "query", schema: { type: "number" } },
          { name: "maxPrice", in: "query", schema: { type: "number" } },
          { name: "isStattrak", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          200: {
            description: "Paginated listings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Listing" } },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    totalPages: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/orders": {
      post: {
        tags: ["Orders"],
        summary: "Create a new order",
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
          404: { description: "Listing not found" },
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
                properties: { orderId: { type: "string" } },
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
    "/payments/webhook": {
      post: {
        tags: ["Payments"],
        summary: "PayPal webhook receiver (PAYMENT.CAPTURE.COMPLETED)",
        security: [],
        description:
          "Receives PayPal webhook events. Signature is verified via `PAYPAL_WEBHOOK_ID` env var.",
        responses: { 200: { description: "Webhook processed" }, 401: { description: "Invalid signature" } },
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
                  properties: { balance: { type: "number", example: 135.0 } },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
