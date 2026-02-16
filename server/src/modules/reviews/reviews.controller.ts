import { Request, Response, NextFunction } from "express";
import { reviewsService } from "./reviews.service.js";

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
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const review = await reviewsService.create(req.user.id, req.body);
      res.status(201).json(review);
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const review = await reviewsService.update(req.params.id, req.user.id, req.body);
      res.json(review);
    } catch (e) {
      next(e);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      await reviewsService.delete(req.params.id, req.user.id);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
};
