import { z } from "zod";

export const createPaymentDto = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentDto>;
