import { z } from "zod";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "../../shared/types/roles.js";
import { TRACKING_MAX, resourceIdSchema } from "../../shared/validation/httpLimits.js";

export const createOrderItemDto = z.object({
  listingId: resourceIdSchema("Listing ID"),
});

export const createOrderDto = z.object({
  items: z.array(createOrderItemDto).min(1, "At least one item is required"),
});

export const updateOrderStatusDto = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const listOrdersQueryDto = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
});

export const orderIdParamsDto = z.object({
  id: resourceIdSchema("Order ID"),
});

export const updateOrderTrackingDto = z.object({
  trackingCode: z.string().max(TRACKING_MAX).optional(),
  trackingCarrier: z.string().max(TRACKING_MAX).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderDto>;
export type UpdateOrderTrackingInput = z.infer<typeof updateOrderTrackingDto>;
export type ListOrdersQuery = z.infer<typeof listOrdersQueryDto>;
