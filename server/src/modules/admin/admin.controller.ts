import { Request, Response, NextFunction } from "express";
import { adminService } from "./admin.service.js";

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
      const orders = await adminService.listOrders({
        status: req.query.status as import("../../shared/types/roles.js").OrderStatus | undefined,
        paymentStatus: req.query.paymentStatus as import("../../shared/types/roles.js").PaymentStatus | undefined,
      });
      res.json(orders);
    } catch (e) {
      next(e);
    }
  },

  async approveSeller(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const seller = await adminService.approveSeller(
        req.params.id,
        req.body.isApproved
      );
      res.json(seller);
    } catch (e) {
      next(e);
    }
  },
};
