import { z } from "zod";
import { REGISTRATION_ROLES } from "../../shared/types/roles.js";

export const registerDto = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(REGISTRATION_ROLES).default("CUSTOMER"),
    storeName: z.string().min(1).optional(),
  })
  .refine((data) => data.role !== "SELLER" || (data.storeName && data.storeName.trim().length > 0), {
    message: "Store name is required for seller registration",
    path: ["storeName"],
  });

export const verifyEmailDto = z.object({
  email: z.string().email("Invalid email"),
  code: z.string().length(6, "Code must be 6 digits"),
});

export const loginDto = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const refreshDto = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type RegisterInput = z.infer<typeof registerDto>;
export type VerifyEmailInput = z.infer<typeof verifyEmailDto>;
export type LoginInput = z.infer<typeof loginDto>;
export type RefreshInput = z.infer<typeof refreshDto>;
