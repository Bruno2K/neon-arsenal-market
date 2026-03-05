import { Request, Response, NextFunction } from "express";
import { sellersService } from "./sellers.service.js";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";

export const sellersController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isApproved = req.query.approved as string | undefined;
      const filters =
        isApproved !== undefined ? { isApproved: isApproved === "true" } : undefined;
      const list = await sellersService.list(filters);
      res.json(list);
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const seller = await sellersService.getById(req.params.id);
      res.json(seller);
    } catch (e) {
      next(e);
    }
  },

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const seller = await sellersService.getByUserId(user.id);
      res.json(seller);
    } catch (e) {
      next(e);
    }
  },

  async apply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const seller = await sellersService.apply(user.id, req.body);
      res.status(201).json(seller);
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const seller = await sellersService.update(req.params.id, user.id, user.role, req.body);
      res.json(seller);
    } catch (e) {
      next(e);
    }
  },

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const seller = await sellersService.approve(req.params.id, req.body.isApproved);
      res.json(seller);
    } catch (e) {
      next(e);
    }
  },
};
