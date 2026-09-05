import { z } from "zod";

export const listAuditLogsQueryDto = z.object({
  actorId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  resourceType: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type ListAuditLogsQueryInput = z.infer<typeof listAuditLogsQueryDto>;
