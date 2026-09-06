import { z } from "zod";
import { passwordSchema } from "../../shared/validation/passwordPolicy.js";

export const updateMeDto = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: passwordSchema.optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeDto>;
