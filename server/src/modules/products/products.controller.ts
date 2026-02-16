import { Request, Response, NextFunction } from "express";
import { productsService } from "./products.service.js";
import { listProductsQueryDto } from "./products.dto.js";

export const productsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listProductsQueryDto.parse({
        ...req.query,
        page: req.query.page,
        limit: req.query.limit,
      });
      const result = await productsService.list(query);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productsService.getById(req.params.id);
      res.json(product);
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
      const product = await productsService.create(req.user.id, req.body);
      res.status(201).json(product);
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
      const product = await productsService.update(
        req.params.id,
        req.user.id,
        req.user.role,
        req.body
      );
      res.json(product);
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
      await productsService.delete(req.params.id, req.user.id, req.user.role);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
};
