import { z } from "zod";

export const createOrderItemDto = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
});

export const createOrderDto = z.object({
  items: z.array(createOrderItemDto).min(1, "At least one item is required"),
});

export const updateOrderStatusDto = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

export type CreateOrderInput = z.infer<typeof createOrderDto>;
