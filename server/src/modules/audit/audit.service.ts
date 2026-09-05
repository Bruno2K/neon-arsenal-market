import type { Request } from "express";
import type { UserRole } from "@prisma/client";
import { auditRepository, type ListAuditLogsQuery } from "./audit.repository.js";
import type { AuditActor, AuditClient, AuditWriteInput } from "./audit.types.js";

export const auditService = {
  async record(input: AuditWriteInput, client?: AuditClient) {
    return auditRepository.create(input, client);
  },

  async list(query: ListAuditLogsQuery) {
    return auditRepository.findMany(query);
  },
};

export function auditActorFromRequest(req: Request): AuditActor {
  return {
    actorId: req.user?.id ?? null,
    actorRole: (req.user?.role as UserRole | undefined) ?? null,
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

export function systemAuditActor(): AuditActor {
  return { actorId: null, actorRole: null };
}
