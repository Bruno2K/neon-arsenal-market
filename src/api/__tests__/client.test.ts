import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, tokenStorage } from "../client";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("api extra headers", () => {
  beforeEach(() => {
    tokenStorage.clear();
    tokenStorage.setTokens("access-token", "refresh-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    tokenStorage.clear();
    vi.unstubAllGlobals();
  });

  it("forwards Idempotency-Key on post without dropping auth", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse({ id: "order-1" }, 201));

    await api.post(
      "/orders",
      { items: [{ listingId: "listing-ak" }] },
      { headers: { "Idempotency-Key": "retry-key-1" } },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/orders$/);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "Idempotency-Key": "retry-key-1",
      Authorization: "Bearer access-token",
    });
  });

  it("forwards Idempotency-Key on patch", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse({ id: "order-1" }));

    await api.patch(
      "/orders/order-1/status",
      { status: "PAID" },
      { headers: { "Idempotency-Key": "patch-key" } },
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("PATCH");
    expect(init?.headers).toMatchObject({
      "Idempotency-Key": "patch-key",
      Authorization: "Bearer access-token",
    });
  });
});
