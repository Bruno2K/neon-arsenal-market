import { Request, Response, NextFunction } from "express";
import { adminService } from "./admin.service.js";
import type { ListOrdersQuery } from "../orders/orders.dto.js";
import { auditActorFromRequest } from "../audit/audit.service.js";
import type { ListAuditLogsQueryInput } from "../audit/audit.dto.js";

export const adminController = {
  async listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await adminService.listUsers();
      res.json(users);
    } catch (e) {
      next(e);
    }
  },

  async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orders = await adminService.listOrders(req.query as ListOrdersQuery);
      res.json(orders);
    } catch (e) {
      next(e);
    }
  },

  async approveSeller(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const seller = await adminService.approveSeller(
        req.params.id,
        req.body.isApproved,
        auditActorFromRequest(req)
      );
      res.json(seller);
    } catch (e) {
      next(e);
    }
  },

  async listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await adminService.listAuditLogs(req.query as unknown as ListAuditLogsQueryInput);
      res.json(logs);
    } catch (e) {
      next(e);
    }
  },
};
