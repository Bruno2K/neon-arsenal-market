import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { AppError } from "../../../shared/errors/AppError.js";

vi.mock("../orders.service.js", () => ({
  ordersService: {
    create: vi.fn(),
  },
}));

import { ordersController } from "../orders.controller.js";
import { ordersService } from "../orders.service.js";

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe("ordersController.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a missing Idempotency-Key before creating an order", async () => {
    const req = {
      user: { id: "user-1", role: "CUSTOMER" },
      body: { items: [{ listingId: "listing-1" }] },
      headers: {},
      requestId: "req-1",
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await ordersController.create(req, res, next);

    expect(ordersService.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("Idempotency-Key"),
    });
  });

  it("passes the parsed key and request id to the service", async () => {
    vi.mocked(ordersService.create).mockResolvedValue({ id: "order-1" } as never);
    const req = {
      user: { id: "user-1", role: "CUSTOMER" },
      body: { items: [{ listingId: "listing-1" }] },
      headers: { "idempotency-key": "order-key-1" },
      requestId: "req-1",
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await ordersController.create(req, res, next);

    expect(ordersService.create).toHaveBeenCalledWith(
      "user-1",
      { items: [{ listingId: "listing-1" }] },
      "order-key-1",
      "req-1"
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: "order-1" });
    expect(next).not.toHaveBeenCalled();
  });
});
