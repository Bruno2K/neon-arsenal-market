import { describe, expect, it } from "vitest";
import {
  ApiClientError,
  USER_FACING_CONFLICT,
  USER_FACING_CREDENTIALS,
  USER_FACING_CS2SH_IMPORT_RUNNING,
  USER_FACING_CS2SH_KEY_MISSING,
  USER_FACING_EMAIL_TAKEN,
  USER_FACING_FORBIDDEN,
  USER_FACING_GENERIC,
  USER_FACING_LISTING_CONFLICT,
  USER_FACING_NETWORK,
  USER_FACING_NOT_FOUND,
  USER_FACING_PAYPAL_CLIENT_AUTH,
  USER_FACING_RATE_LIMIT,
  USER_FACING_REVIEW_EXISTS,
  USER_FACING_SERVER,
  USER_FACING_UNAUTHORIZED,
  USER_FACING_VALIDATION,
  USER_FACING_VERIFICATION_CODE,
  listingStatusLabel,
  orderStatusLabel,
  paymentStatusLabel,
  userFacingApiError,
} from "../userFacingApiError";

describe("userFacingApiError", () => {
  it("maps network failures without leaking the API URL", () => {
    const error = new ApiClientError(
      "Could not reach API at http://localhost:3001/listings: Failed to fetch",
      { code: "NETWORK" },
    );

    expect(userFacingApiError(error)).toBe(USER_FACING_NETWORK);
    expect(error.message).toContain("http://localhost:3001");
    expect(error.message).toContain("Failed to fetch");
    expect(userFacingApiError(error)).not.toMatch(
      /localhost|Failed to fetch|http:\/\//i,
    );
  });

  it("maps Failed to fetch and TypeError fetch failures to the network copy", () => {
    expect(userFacingApiError(new Error("Failed to fetch"))).toBe(
      USER_FACING_NETWORK,
    );
    expect(userFacingApiError(new TypeError("Failed to fetch"))).toBe(
      USER_FACING_NETWORK,
    );
  });

  it("maps 401 session and credential errors", () => {
    expect(
      userFacingApiError(new ApiClientError("Unauthorized", { status: 401 })),
    ).toBe(USER_FACING_UNAUTHORIZED);
    expect(
      userFacingApiError(
        new ApiClientError("Invalid email or password", { status: 401 }),
      ),
    ).toBe(USER_FACING_CREDENTIALS);
  });

  it("maps 403 and 404", () => {
    expect(
      userFacingApiError(new ApiClientError("Forbidden", { status: 403 })),
    ).toBe(USER_FACING_FORBIDDEN);
    expect(
      userFacingApiError(
        new ApiClientError("Listing not found", { status: 404 }),
      ),
    ).toBe(USER_FACING_NOT_FOUND);
    expect(userFacingApiError(new Error("Listing not found"))).toBe(
      USER_FACING_NOT_FOUND,
    );
    expect(userFacingApiError(new Error("Listing not found"))).not.toBe(
      "Listing not found",
    );
  });

  it("maps 409 listing reservation to the buyer conflict copy", () => {
    expect(
      userFacingApiError(
        new ApiClientError("Listing is already reserved", { status: 409 }),
      ),
    ).toBe(USER_FACING_LISTING_CONFLICT);
    expect(
      userFacingApiError(
        new ApiClientError(
          "Listing listing-1 is not available (status: RESERVED)",
          {
            status: 400,
          },
        ),
      ),
    ).toBe(USER_FACING_LISTING_CONFLICT);
  });

  it("maps other 409s, 429, 5xx and validation", () => {
    expect(
      userFacingApiError(
        new ApiClientError(
          "A importação do catálogo cs2.sh já está em andamento",
          {
            status: 409,
          },
        ),
      ),
    ).toBe(USER_FACING_CS2SH_IMPORT_RUNNING);
    expect(
      userFacingApiError(
        new ApiClientError("A chave da API cs2.sh não está configurada", {
          status: 503,
        }),
      ),
    ).toBe(USER_FACING_CS2SH_KEY_MISSING);
    expect(
      userFacingApiError(
        new ApiClientError("PayPal client authentication failed", {
          status: 503,
        }),
      ),
    ).toBe(USER_FACING_PAYPAL_CLIENT_AUTH);
    expect(
      userFacingApiError(
        new ApiClientError("Order status changed concurrently", {
          status: 409,
        }),
      ),
    ).toBe(USER_FACING_CONFLICT);
    expect(
      userFacingApiError(
        new ApiClientError("You already reviewed this product", {
          status: 409,
        }),
      ),
    ).toBe(USER_FACING_REVIEW_EXISTS);
    expect(
      userFacingApiError(
        new ApiClientError("Email already registered", { status: 409 }),
      ),
    ).toBe(USER_FACING_EMAIL_TAKEN);
    expect(
      userFacingApiError(
        new ApiClientError("Too many requests", { status: 429 }),
      ),
    ).toBe(USER_FACING_RATE_LIMIT);
    expect(
      userFacingApiError(
        new ApiClientError("Internal server error.", { status: 500 }),
      ),
    ).toBe(USER_FACING_SERVER);
    expect(
      userFacingApiError(
        new ApiClientError("Invalid verification code", { status: 400 }),
      ),
    ).toBe(USER_FACING_VERIFICATION_CODE);
    expect(
      userFacingApiError(
        new ApiClientError("Float must be between 0 and 1", { status: 400 }),
      ),
    ).toBe(USER_FACING_VALIDATION);
  });

  it("never returns localhost, Failed to fetch, or an API URL", () => {
    const cases: unknown[] = [
      new Error(
        "Could not reach API at http://localhost:3001/auth/login: Failed to fetch",
      ),
      new Error("Failed to fetch"),
      new ApiClientError("Request failed: 502", { status: 502 }),
      "Could not reach API at https://api.example.com/v1",
      { status: 0, message: "Failed to fetch" },
    ];

    for (const error of cases) {
      const copy = userFacingApiError(error);
      expect(copy).not.toMatch(/localhost/i);
      expect(copy).not.toMatch(/Failed to fetch/i);
      expect(copy).not.toMatch(/https?:\/\//i);
      expect(copy.length).toBeGreaterThan(0);
    }
  });

  it("keeps a generic Portuguese fallback without echoing unknown English", () => {
    expect(userFacingApiError(new Error("ECONNRESET boom"))).toBe(
      USER_FACING_NETWORK,
    );
    expect(userFacingApiError(new Error("weird upstream stack"))).toBe(
      USER_FACING_GENERIC,
    );
    expect(userFacingApiError(new Error("weird upstream stack"))).not.toBe(
      "weird upstream stack",
    );
  });
});

describe("status labels", () => {
  it("translates listing statuses visible to the user", () => {
    expect(listingStatusLabel("ACTIVE")).toBe("Disponível");
    expect(listingStatusLabel("RESERVED")).toBe("Reservado");
    expect(listingStatusLabel("SOLD")).toBe("Vendido");
    expect(listingStatusLabel("CANCELED")).toBe("Cancelado");
  });

  it("translates order and payment statuses", () => {
    expect(orderStatusLabel("PENDING")).toBe("Pendente");
    expect(orderStatusLabel("CONFIRMED")).toBe("Confirmado");
    expect(orderStatusLabel("SHIPPED")).toBe("Enviado");
    expect(orderStatusLabel("DELIVERED")).toBe("Entregue");
    expect(orderStatusLabel("CANCELLED")).toBe("Cancelado");
    expect(paymentStatusLabel("PENDING")).toBe("Pendente");
    expect(paymentStatusLabel("PAID")).toBe("Pago");
    expect(paymentStatusLabel("REFUNDED")).toBe("Reembolsado");
  });
});
