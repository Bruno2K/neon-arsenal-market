import { z } from "zod";
import { ORDER_STATUSES } from "../../shared/types/roles.js";

export const createOrderItemDto = z.object({
  listingId: z.string().min(1, "Listing ID is required"),
});

export const createOrderDto = z.object({
  items: z.array(createOrderItemDto).min(1, "At least one item is required"),
});

export const updateOrderStatusDto = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const orderIdParamsDto = z.object({
  id: z.string().min(1, "Order ID is required"),
});

export const updateOrderTrackingDto = z.object({
  trackingCode: z.string().optional(),
  trackingCarrier: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderDto>;
export type UpdateOrderTrackingInput = z.infer<typeof updateOrderTrackingDto>;
