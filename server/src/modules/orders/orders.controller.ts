import { Request, Response, NextFunction } from "express";
import { ordersService } from "./orders.service.js";

export const ordersController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const order = await ordersService.create(req.user.id, req.body);
      res.status(201).json(order);
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const order = await ordersService.getById(
        req.params.id,
        req.user.id,
        req.user.role
      );
      res.json(order);
    } catch (e) {
      next(e);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      let list;
      if (req.user.role === "ADMIN") {
        list = await ordersService.listAdmin({
          status: req.query.status as string,
          paymentStatus: req.query.paymentStatus as string,
        });
      } else if (req.user.role === "SELLER") {
        list = await ordersService.listBySeller(req.user.id);
      } else {
        list = await ordersService.listByCustomer(req.user.id);
      }
      res.json(list);
    } catch (e) {
      next(e);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const order = await ordersService.updateStatus(
        req.params.id,
        req.user.id,
        req.user.role,
        req.body.status
      );
      res.json(order);
    } catch (e) {
      next(e);
    }
  },
};
