import { z } from "zod";

export const registerDto = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["CUSTOMER", "SELLER"]).default("CUSTOMER"),
});

export const loginDto = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const refreshDto = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type RegisterInput = z.infer<typeof registerDto>;
export type LoginInput = z.infer<typeof loginDto>;
export type RefreshInput = z.infer<typeof refreshDto>;
