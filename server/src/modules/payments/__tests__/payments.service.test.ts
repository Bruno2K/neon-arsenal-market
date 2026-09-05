import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    paymentWebhookEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    paymentLink: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    listing: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    seller: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    sellerTransaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../../shared/utils/paypal.js", () => ({
  createPayPalOrder: vi.fn(),
  getPayPalApprovalLink: vi.fn(),
  getPayPalOrder: vi.fn(),
}));

import { prisma } from "../../../shared/database/index.js";
import { createPayPalOrder, getPayPalApprovalLink, getPayPalOrder } from "../../../shared/utils/paypal.js";
import { paymentsService } from "../payments.service.js";
import { Prisma } from "@prisma/client";

const mockOrder = (overrides = {}) => ({
  id: "order-1",
  customerId: "user-1",
  totalAmount: new Prisma.Decimal("150.00"),
  status: "PENDING",
  paymentStatus: "PENDING",
  paypalOrderId: null,
  items: [
    { listingId: "listing-1", sellerId: "seller-1", priceSnapshot: new Prisma.Decimal("150.00") },
  ],
  ...overrides,
});

describe("paymentsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPaymentLink()", () => {
    const setupCreateLink = () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder({ paymentLink: null }) as never);
      vi.mocked(prisma.paymentLink.create).mockResolvedValue({} as never);
      vi.mocked(prisma.paymentLink.update).mockResolvedValue({} as never);
      vi.mocked(prisma.paymentLink.deleteMany).mockResolvedValue({ count: 0 } as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) =>
        fn(prisma)
      );
      vi.mocked(createPayPalOrder).mockResolvedValue({ id: "paypal-order-1", links: [] } as never);
      vi.mocked(getPayPalApprovalLink).mockReturnValue("https://paypal.com/approve/123");
      vi.mocked(prisma.order.update).mockResolvedValue({} as never);
    };

    it("creates PayPal order and returns approval URL", async () => {
      setupCreateLink();

      const result = await paymentsService.createPaymentLink("user-1", { orderId: "order-1" });

      expect(createPayPalOrder).toHaveBeenCalledWith("150.00", "BRL", "order-1");
      expect(result.approvalUrl).toBe("https://paypal.com/approve/123");
      expect(result.orderId).toBe("order-1");
    });

    it("throws 404 when order not found", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

      await expect(
        paymentsService.createPaymentLink("user-1", { orderId: "bad-order" })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 403 when user does not own the order", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        mockOrder({ customerId: "other-user", paymentLink: null }) as never
      );

      await expect(
        paymentsService.createPaymentLink("user-1", { orderId: "order-1" })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("throws 400 when order is already paid", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        mockOrder({ paymentStatus: "PAID", paymentLink: null }) as never
      );

      await expect(
        paymentsService.createPaymentLink("user-1", { orderId: "order-1" })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("already paid") });
    });

    it("falls back to the PayPal checkout URL when the approve link is missing", async () => {
      setupCreateLink();
      vi.mocked(createPayPalOrder).mockResolvedValue({ id: "paypal-1", links: [] } as never);
      vi.mocked(getPayPalApprovalLink).mockReturnValue(undefined);

      const result = await paymentsService.createPaymentLink("user-1", { orderId: "order-1" });

      expect(result.approvalUrl).toBe("https://www.sandbox.paypal.com/checkoutnow?token=paypal-1");
      expect(prisma.paymentLink.deleteMany).not.toHaveBeenCalled();
    });

    it("stores paypalOrderId on the order", async () => {
      setupCreateLink();
      vi.mocked(createPayPalOrder).mockResolvedValue({ id: "paypal-order-99" } as never);
      vi.mocked(getPayPalApprovalLink).mockReturnValue("https://approve.url");

      await paymentsService.createPaymentLink("user-1", { orderId: "order-1" });

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { paypalOrderId: "paypal-order-99" } })
      );
    });

    it("replays an existing PayPal order without calling OrdersCreate", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        mockOrder({
          paypalOrderId: "paypal-existing",
          paymentLink: {
            status: "COMPLETED",
            paypalOrderId: "paypal-existing",
            approvalUrl: "https://paypal.com/approve/existing",
          },
        }) as never
      );

      const result = await paymentsService.createPaymentLink("user-1", { orderId: "order-1" });

      expect(createPayPalOrder).not.toHaveBeenCalled();
      expect(prisma.paymentLink.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        orderId: "order-1",
        paypalOrderId: "paypal-existing",
        approvalUrl: "https://paypal.com/approve/existing",
      });
    });

    it("returns 409 when a concurrent claim is still in progress", async () => {
      vi.mocked(prisma.order.findUnique)
        .mockResolvedValueOnce(mockOrder({ paymentLink: null }) as never)
        .mockResolvedValueOnce(mockOrder({ paymentLink: { status: "IN_PROGRESS", paypalOrderId: null, approvalUrl: null } }) as never);
      vi.mocked(prisma.paymentLink.create).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "5.22.0",
          meta: { target: ["orderId"] },
        })
      );

      await expect(
        paymentsService.createPaymentLink("user-1", { orderId: "order-1" })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("still in progress"),
      });
      expect(createPayPalOrder).not.toHaveBeenCalled();
    });

    it("replays when a concurrent claim has already completed", async () => {
      vi.mocked(prisma.order.findUnique)
        .mockResolvedValueOnce(mockOrder({ paymentLink: null }) as never)
        .mockResolvedValueOnce(
          mockOrder({
            paypalOrderId: "paypal-won",
            paymentLink: {
              status: "COMPLETED",
              paypalOrderId: "paypal-won",
              approvalUrl: "https://paypal.com/approve/won",
            },
          }) as never
        );
      vi.mocked(prisma.paymentLink.create).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "5.22.0",
          meta: { target: ["orderId"] },
        })
      );

      const result = await paymentsService.createPaymentLink("user-1", { orderId: "order-1" });

      expect(createPayPalOrder).not.toHaveBeenCalled();
      expect(result.paypalOrderId).toBe("paypal-won");
    });

    it("releases the in-progress claim when OrdersCreate fails", async () => {
      setupCreateLink();
      vi.mocked(createPayPalOrder).mockRejectedValue(new Error("PayPal unavailable"));

      await expect(
        paymentsService.createPaymentLink("user-1", { orderId: "order-1" })
      ).rejects.toThrow(/PayPal unavailable/);

      expect(prisma.paymentLink.deleteMany).toHaveBeenCalledWith({
        where: { orderId: "order-1", status: "IN_PROGRESS" },
      });
    });
  });

  describe("confirmPayment()", () => {
    const setupTransaction = (claimedCount = 1) => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) => {
        vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: claimedCount } as never);
        vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder() as never);
        vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.seller.findUnique).mockResolvedValue({ commissionRate: new Prisma.Decimal("0.1") } as never);
        vi.mocked(prisma.sellerTransaction.create).mockResolvedValue({} as never);
        vi.mocked(prisma.seller.update).mockResolvedValue({} as never);
        return fn(prisma);
      });
    };

    it("claims the payment transition atomically", async () => {
      setupTransaction();

      await paymentsService.confirmPayment("order-1");

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: "order-1", paymentStatus: "PENDING", status: "PENDING" },
        data: { paymentStatus: "PAID", status: "CONFIRMED" },
      });
    });

    it("marks reserved listings as SOLD after payment", async () => {
      setupTransaction();

      await paymentsService.confirmPayment("order-1");

      expect(prisma.listing.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ["listing-1"] },
            status: "RESERVED",
            reservedByOrderId: "order-1",
            reservationExpiresAt: { gt: expect.any(Date) },
          },
          data: expect.objectContaining({ status: "SOLD", soldAt: expect.any(Date) }),
        })
      );
    });

    it("calculates commission using Decimal arithmetic", async () => {
      setupTransaction();

      await paymentsService.confirmPayment("order-1");

      expect(prisma.sellerTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sellerId: "seller-1",
            orderId: "order-1",
            grossAmount: new Prisma.Decimal("150.00"),
            commissionAmount: new Prisma.Decimal("15.000"),
            netAmount: new Prisma.Decimal("135.000"),
            status: "PAID",
          }),
        })
      );
    });

    it("increments seller balance by the Decimal net amount", async () => {
      setupTransaction();

      await paymentsService.confirmPayment("order-1");

      expect(prisma.seller.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "seller-1" },
          data: { balance: { increment: new Prisma.Decimal("135.000") } },
        })
      );
    });

    it("is idempotent when the order was already claimed", async () => {
      setupTransaction(0);

      await paymentsService.confirmPayment("order-1");

      expect(prisma.order.findUnique).not.toHaveBeenCalled();
      expect(prisma.sellerTransaction.create).not.toHaveBeenCalled();
      expect(prisma.seller.update).not.toHaveBeenCalled();
      expect(prisma.listing.updateMany).not.toHaveBeenCalled();
    });

    it("does not perform seller payout when payment claim fails", async () => {
      setupTransaction(0);

      await paymentsService.confirmPayment("order-1");

      expect(prisma.sellerTransaction.create).not.toHaveBeenCalled();
    });

    it("throws and skips payout when reserved listings cannot be sold", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) => {
        vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder() as never);
        vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 0 } as never);
        return fn(prisma);
      });

      await expect(paymentsService.confirmPayment("order-1")).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("expired"),
      });
      expect(prisma.sellerTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe("handleWebhook()", () => {
    beforeEach(() => {
      vi.mocked(prisma.paymentWebhookEvent.create).mockResolvedValue({} as never);
      vi.mocked(prisma.paymentWebhookEvent.update).mockResolvedValue({} as never);
    });

    it("ignores payloads without an event id", async () => {
      await paymentsService.handleWebhook({ event_type: "SOME.OTHER.EVENT" });
      expect(prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("stores CHECKOUT.ORDER.APPROVED without confirming payment", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "order-1" } as never);

      await paymentsService.handleWebhook({
        id: "WH-APPROVED-1",
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: { id: "paypal-order-1", purchase_units: [{ reference_id: "order-1" }] },
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "IGNORED", orderId: "order-1" }),
        })
      );
    });

    it("confirms payment on PAYMENT.CAPTURE.COMPLETED using related PayPal order id", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "order-1" } as never);
      setupWebhookTransaction();

      await paymentsService.handleWebhook({
        id: "WH-CAPTURE-1",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          id: "CAPTURE-99",
          supplementary_data: { related_ids: { order_id: "paypal-order-99" } },
        },
      });

      expect(prisma.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { paypalOrderId: "paypal-order-99" } })
      );
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "order-1", paymentStatus: "PENDING", status: "PENDING" },
        })
      );
    });

    it("is a no-op when the same event was already processed", async () => {
      vi.mocked(prisma.paymentWebhookEvent.create).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "5.22.0",
        })
      );
      vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValue({
        status: "PROCESSED",
      } as never);

      await paymentsService.handleWebhook({
        id: "WH-DUP-1",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          supplementary_data: { related_ids: { order_id: "paypal-order-99" } },
        },
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("signals PayPal to retry when a capture cannot resolve a local order", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

      await expect(
        paymentsService.handleWebhook({
          id: "WH-ORPHAN-1",
          event_type: "PAYMENT.CAPTURE.COMPLETED",
          resource: {
            supplementary_data: { related_ids: { order_id: "paypal-unknown" } },
          },
        })
      ).rejects.toMatchObject({ statusCode: 503 });

      expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED", failureReason: "order_not_resolved" }),
        })
      );
    });
  });

  describe("reconcilePendingPaypalOrders()", () => {
    it("confirms locally when PayPal reports COMPLETED", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        { id: "order-1", paypalOrderId: "paypal-1" },
      ] as never);
      vi.mocked(getPayPalOrder).mockResolvedValue({ id: "paypal-1", status: "COMPLETED" });
      setupWebhookTransaction();

      const result = await paymentsService.reconcilePendingPaypalOrders();

      expect(getPayPalOrder).toHaveBeenCalledWith("paypal-1");
      expect(prisma.order.updateMany).toHaveBeenCalled();
      expect(result).toEqual({ scanned: 1, confirmed: 1 });
    });

    it("does not confirm when PayPal is not COMPLETED", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        { id: "order-1", paypalOrderId: "paypal-1" },
      ] as never);
      vi.mocked(getPayPalOrder).mockResolvedValue({ id: "paypal-1", status: "APPROVED" });

      const result = await paymentsService.reconcilePendingPaypalOrders();

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result).toEqual({ scanned: 1, confirmed: 0 });
    });
  });
});

function setupWebhookTransaction() {
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder() as never);
    vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({ commissionRate: new Prisma.Decimal("0.1") } as never);
    vi.mocked(prisma.sellerTransaction.create).mockResolvedValue({} as never);
    vi.mocked(prisma.seller.update).mockResolvedValue({} as never);
    return fn(prisma);
  });
}
