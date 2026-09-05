import { prisma } from "../../shared/database/index.js";
import type { Prisma } from "@prisma/client";
import type { AuditClient, AuditWriteInput } from "./audit.types.js";
import { sanitizeAuditIp, sanitizeAuditJson, sanitizeAuditUserAgent } from "./audit.sanitize.js";

export type ListAuditLogsQuery = {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  page: number;
  limit: number;
};

export const auditRepository = {
  async create(input: AuditWriteInput, client: AuditClient = prisma) {
    return client.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        before: sanitizeAuditJson(input.before) as Prisma.InputJsonValue | undefined,
        after: sanitizeAuditJson(input.after) as Prisma.InputJsonValue | undefined,
        ip: sanitizeAuditIp(input.ip),
        userAgent: sanitizeAuditUserAgent(input.userAgent),
      },
    });
  },

  async findMany(query: ListAuditLogsQuery) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = query.action;
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.resourceId) where.resourceId = query.resourceId;

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  },
};
