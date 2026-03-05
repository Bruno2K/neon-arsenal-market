import { Request, Response, NextFunction } from "express";
import { productsService } from "./products.service.js";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";
import type { ListProductsQuery } from "./products.dto.js";

export const productsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await productsService.list(req.query as unknown as ListProductsQuery);
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
      const user = getAuthUser(req);
      const product = await productsService.create(user.id, user.role, req.body);
      res.status(201).json(product);
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const product = await productsService.update(req.params.id, user.id, user.role, req.body);
      res.json(product);
    } catch (e) {
      next(e);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      await productsService.delete(req.params.id, user.id, user.role);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
};
