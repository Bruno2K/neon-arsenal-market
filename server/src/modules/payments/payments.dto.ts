import { z } from "zod";
import { URL_MAX, resourceIdSchema } from "../../shared/validation/httpLimits.js";

export const createPaymentDto = z.object({
  orderId: resourceIdSchema("Order ID"),
  returnUrl: z.string().url().max(URL_MAX).optional(),
  cancelUrl: z.string().url().max(URL_MAX).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentDto>;

export const capturePaymentDto = z.object({
  orderId: resourceIdSchema("Order ID"),
});

export type CapturePaymentInput = z.infer<typeof capturePaymentDto>;
