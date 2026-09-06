import { z } from "zod";
import { RESOURCE_ID_MAX, SEARCH_MAX } from "../../shared/validation/httpLimits.js";

export const listAuditLogsQueryDto = z.object({
  actorId: z.string().min(1).max(RESOURCE_ID_MAX).optional(),
  action: z.string().min(1).max(SEARCH_MAX).optional(),
  resourceType: z.string().min(1).max(SEARCH_MAX).optional(),
  resourceId: z.string().min(1).max(RESOURCE_ID_MAX).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type ListAuditLogsQueryInput = z.infer<typeof listAuditLogsQueryDto>;
