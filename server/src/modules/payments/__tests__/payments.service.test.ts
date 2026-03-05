import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    listing: {
      update: vi.fn(),
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
}));

import { prisma } from "../../../shared/database/index.js";
import { createPayPalOrder, getPayPalApprovalLink } from "../../../shared/utils/paypal.js";
import { paymentsService } from "../payments.service.js";

const mockOrder = (overrides = {}) => ({
  id: "order-1",
  customerId: "user-1",
  totalAmount: 150.0,
  status: "PENDING",
  paymentStatus: "PENDING",
  paypalOrderId: null,
  items: [
    { listingId: "listing-1", sellerId: "seller-1", priceSnapshot: 150.0 },
  ],
  ...overrides,
});

describe("paymentsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPaymentLink()", () => {
    it("creates PayPal order and returns approval URL", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder() as any);
      vi.mocked(createPayPalOrder).mockResolvedValue({ id: "paypal-order-1", links: [] } as any);
      vi.mocked(getPayPalApprovalLink).mockReturnValue("https://paypal.com/approve/123");
      vi.mocked(prisma.order.update).mockResolvedValue({} as any);

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
        mockOrder({ customerId: "other-user" }) as any
      );

      await expect(
        paymentsService.createPaymentLink("user-1", { orderId: "order-1" })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("throws 400 when order is already paid", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        mockOrder({ paymentStatus: "PAID" }) as any
      );

      await expect(
        paymentsService.createPaymentLink("user-1", { orderId: "order-1" })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("already paid") });
    });

    it("throws 500 when PayPal approval link is missing", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder() as any);
      vi.mocked(createPayPalOrder).mockResolvedValue({ id: "paypal-1", links: [] } as any);
      vi.mocked(getPayPalApprovalLink).mockReturnValue(null as any);

      await expect(
        paymentsService.createPaymentLink("user-1", { orderId: "order-1" })
      ).rejects.toMatchObject({ statusCode: 500 });
    });

    it("stores paypalOrderId on the order", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder() as any);
      vi.mocked(createPayPalOrder).mockResolvedValue({ id: "paypal-order-99" } as any);
      vi.mocked(getPayPalApprovalLink).mockReturnValue("https://approve.url");
      vi.mocked(prisma.order.update).mockResolvedValue({} as any);

      await paymentsService.createPaymentLink("user-1", { orderId: "order-1" });

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { paypalOrderId: "paypal-order-99" },
        })
      );
    });
  });

  describe("confirmPayment()", () => {
    it("marks order as PAID and CONFIRMED", async () => {
      const order = mockOrder();
      vi.mocked(prisma.order.findUnique).mockResolvedValue(order as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        vi.mocked(prisma.order.update).mockResolvedValue({} as any);
        vi.mocked(prisma.listing.update).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.findUnique).mockResolvedValue({ commissionRate: 0.1 } as any);
        vi.mocked(prisma.sellerTransaction.create).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.update).mockResolvedValue({} as any);
        return fn(prisma);
      });

      await paymentsService.confirmPayment("order-1");

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { paymentStatus: "PAID", status: "CONFIRMED" },
        })
      );
    });

    it("marks listings as SOLD after payment", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder() as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        vi.mocked(prisma.order.update).mockResolvedValue({} as any);
        vi.mocked(prisma.listing.update).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.findUnique).mockResolvedValue({ commissionRate: 0.1 } as any);
        vi.mocked(prisma.sellerTransaction.create).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.update).mockResolvedValue({} as any);
        return fn(prisma);
      });

      await paymentsService.confirmPayment("order-1");

      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "listing-1" },
          data: expect.objectContaining({ status: "SOLD" }),
        })
      );
    });

    it("calculates commission correctly (10%) and creates SellerTransaction", async () => {
      // grossAmount = 150, commissionRate = 10%, commissionAmount = 15, netAmount = 135
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder() as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        vi.mocked(prisma.order.update).mockResolvedValue({} as any);
        vi.mocked(prisma.listing.update).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.findUnique).mockResolvedValue({ commissionRate: 0.1 } as any);
        vi.mocked(prisma.sellerTransaction.create).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.update).mockResolvedValue({} as any);
        return fn(prisma);
      });

      await paymentsService.confirmPayment("order-1");

      expect(prisma.sellerTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sellerId: "seller-1",
            orderId: "order-1",
            grossAmount: 150,
            commissionAmount: 15,
            netAmount: 135,
            status: "PAID",
          }),
        })
      );
    });

    it("increments seller balance by netAmount", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder() as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        vi.mocked(prisma.order.update).mockResolvedValue({} as any);
        vi.mocked(prisma.listing.update).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.findUnique).mockResolvedValue({ commissionRate: 0.1 } as any);
        vi.mocked(prisma.sellerTransaction.create).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.update).mockResolvedValue({} as any);
        return fn(prisma);
      });

      await paymentsService.confirmPayment("order-1");

      expect(prisma.seller.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "seller-1" },
          data: { balance: { increment: 135 } },
        })
      );
    });

    it("is idempotent: skips already-paid orders", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        mockOrder({ paymentStatus: "PAID" }) as any
      );

      await paymentsService.confirmPayment("order-1");

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("does nothing when order not found", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

      await paymentsService.confirmPayment("non-existent");

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("handleWebhook()", () => {
    it("ignores non-payment events", async () => {
      await paymentsService.handleWebhook({ event_type: "SOME.OTHER.EVENT" });

      expect(prisma.order.findUnique).not.toHaveBeenCalled();
    });

    it("routes CHECKOUT.ORDER.APPROVED to confirmPayment by reference_id", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        mockOrder({ paymentStatus: "PENDING" }) as any
      );
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        vi.mocked(prisma.order.update).mockResolvedValue({} as any);
        vi.mocked(prisma.listing.update).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.findUnique).mockResolvedValue({ commissionRate: 0.1 } as any);
        vi.mocked(prisma.sellerTransaction.create).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.update).mockResolvedValue({} as any);
        return fn(prisma);
      });

      await paymentsService.handleWebhook({
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: {
          purchase_units: [{ reference_id: "order-1" }],
        },
      });

      expect(prisma.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "order-1" } })
      );
    });

    it("routes PAYMENT.CAPTURE.COMPLETED by paypalOrderId when no reference_id", async () => {
      vi.mocked(prisma.order.findFirst).mockResolvedValue({ id: "order-1" } as any);
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        mockOrder({ paymentStatus: "PENDING" }) as any
      );
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        vi.mocked(prisma.order.update).mockResolvedValue({} as any);
        vi.mocked(prisma.listing.update).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.findUnique).mockResolvedValue({ commissionRate: 0.1 } as any);
        vi.mocked(prisma.sellerTransaction.create).mockResolvedValue({} as any);
        vi.mocked(prisma.seller.update).mockResolvedValue({} as any);
        return fn(prisma);
      });

      await paymentsService.handleWebhook({
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: { id: "paypal-order-99" },
      });

      expect(prisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { paypalOrderId: "paypal-order-99" } })
      );
    });
  });
});
