import { z } from "zod";
import { passwordSchema } from "../../shared/validation/passwordPolicy.js";
import { PERSON_NAME_MAX } from "../../shared/validation/httpLimits.js";

export const updateMeDto = z.object({
  name: z.string().min(1).max(PERSON_NAME_MAX).optional(),
  email: z.string().email().optional(),
  password: passwordSchema.optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeDto>;
