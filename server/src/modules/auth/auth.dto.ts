import { z } from "zod";
import { REGISTRATION_ROLES } from "../../shared/types/roles.js";
import { passwordSchema } from "../../shared/validation/passwordPolicy.js";
import { PERSON_NAME_MAX, STORE_NAME_MAX } from "../../shared/validation/httpLimits.js";

export const registerDto = z
  .object({
    name: z.string().min(1, "Name is required").max(PERSON_NAME_MAX),
    email: z.string().email("Invalid email"),
    password: passwordSchema,
    role: z.enum(REGISTRATION_ROLES).default("CUSTOMER"),
    storeName: z.string().min(1).max(STORE_NAME_MAX).optional(),
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
