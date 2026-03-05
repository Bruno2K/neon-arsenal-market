import { Request, Response, NextFunction } from "express";
import { reviewsService } from "./reviews.service.js";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";

export const reviewsController = {
  async listByProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await reviewsService.listByProductId(req.params.productId);
      res.json(list);
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const review = await reviewsService.getById(req.params.id);
      res.json(review);
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const review = await reviewsService.create(user.id, req.body);
      res.status(201).json(review);
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const review = await reviewsService.update(req.params.id, user.id, req.body);
      res.json(review);
    } catch (e) {
      next(e);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      await reviewsService.delete(req.params.id, user.id);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
};
