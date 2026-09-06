import { Request, Response, NextFunction } from "express";
import { adminService } from "./admin.service.js";
import type { ListOrdersQuery } from "../orders/orders.dto.js";
import { auditActorFromRequest } from "../audit/audit.service.js";
import type { ListAuditLogsQueryInput } from "../audit/audit.dto.js";
import { AppError } from "../../shared/errors/AppError.js";
import { requestParam } from "../../shared/http/requestFields.js";
import { isCs2ShConfigured } from "../../shared/config/cs2sh.js";
import {
  getCs2ShImportStatus,
  tryStartCs2ShCatalogImport,
} from "../products/cs2shImport.service.js";

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
        requestParam(req, "id"),
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

  async getCs2ShImport(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(getCs2ShImportStatus());
    } catch (e) {
      next(e);
    }
  },

  async startCs2ShImport(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!isCs2ShConfigured()) {
        throw new AppError(503, "A chave da API cs2.sh não está configurada");
      }
      const started = tryStartCs2ShCatalogImport();
      if (!started) {
        throw new AppError(409, "A importação do catálogo cs2.sh já está em andamento");
      }
      res.status(202).json({ status: "started", ...getCs2ShImportStatus() });
    } catch (e) {
      next(e);
    }
  },
};
