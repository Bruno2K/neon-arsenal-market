import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
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
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function createReq(idempotencyKey?: string) {
  return {
    user: { id: "customer-1", email: "buyer@test.local", role: "CUSTOMER" },
    body: { items: [{ listingId: "listing-1" }] },
    get: vi.fn((name: string) => (name.toLowerCase() === "idempotency-key" ? idempotencyKey : undefined)),
  } as unknown as Request;
}

describe("ordersController.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes a valid Idempotency-Key to the service and returns 201", async () => {
    const order = {
      id: "order-1",
      customerId: "customer-1",
      totalAmount: new Prisma.Decimal("100.00"),
      status: "PENDING",
      paymentStatus: "PENDING",
    };
    vi.mocked(ordersService.create).mockResolvedValue(order as never);
    const req = createReq("order-key-1");
    const res = mockRes();
    const next = vi.fn();

    await ordersController.create(req, res, next);

    expect(ordersService.create).toHaveBeenCalledWith("customer-1", req.body, "order-key-1");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(order);
    expect(next).not.toHaveBeenCalled();
  });

  it("propagates missing Idempotency-Key as 400", async () => {
    const error = new AppError(400, "Idempotency-Key header is required");
    vi.mocked(ordersService.create).mockRejectedValue(error);
    const req = createReq();
    const res = mockRes();
    const next = vi.fn();

    await ordersController.create(req, res, next);

    expect(ordersService.create).toHaveBeenCalledWith("customer-1", req.body, "");
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("propagates overlong Idempotency-Key as 400", async () => {
    const key = "x".repeat(129);
    const error = new AppError(400, "Idempotency-Key must be 128 characters or fewer");
    vi.mocked(ordersService.create).mockRejectedValue(error);
    const req = createReq(key);
    const res = mockRes();
    const next = vi.fn();

    await ordersController.create(req, res, next);

    expect(ordersService.create).toHaveBeenCalledWith("customer-1", req.body, key);
    expect(next).toHaveBeenCalledWith(error);
  });

  it("propagates conflicting idempotency key reuse as 409", async () => {
    const error = new AppError(409, "Idempotency key was already used with a different order request");
    vi.mocked(ordersService.create).mockRejectedValue(error);
    const req = createReq("order-key-1");
    const res = mockRes();
    const next = vi.fn();

    await ordersController.create(req, res, next);

    expect(ordersService.create).toHaveBeenCalledWith("customer-1", req.body, "order-key-1");
    expect(next).toHaveBeenCalledWith(error);
  });
});
