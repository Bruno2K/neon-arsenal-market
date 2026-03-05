import { Request, Response, NextFunction } from "express";
import { ordersService } from "./orders.service.js";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";

export const ordersController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const order = await ordersService.create(user.id, req.body);
      res.status(201).json(order);
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const order = await ordersService.getById(req.params.id, user.id, user.role);
      res.json(order);
    } catch (e) {
      next(e);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      let list;
      if (user.role === "ADMIN") {
        list = await ordersService.listAdmin({
          status: req.query.status as string,
          paymentStatus: req.query.paymentStatus as string,
        });
      } else if (user.role === "SELLER") {
        list = await ordersService.listBySeller(user.id);
      } else {
        list = await ordersService.listByCustomer(user.id);
      }
      res.json(list);
    } catch (e) {
      next(e);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const order = await ordersService.updateStatus(
        req.params.id,
        user.id,
        user.role,
        req.body.status
      );
      res.json(order);
    } catch (e) {
      next(e);
    }
  },

  async updateTracking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const order = await ordersService.updateTracking(
        req.params.id,
        user.id,
        user.role,
        req.body
      );
      res.json(order);
    } catch (e) {
      next(e);
    }
  },
};
