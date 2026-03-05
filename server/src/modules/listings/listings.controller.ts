import { Request, Response, NextFunction } from "express";
import { listingsService } from "./listings.service.js";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";
import type { ListListingsQuery } from "./listings.dto.js";

export const listingsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await listingsService.list(req.query as unknown as ListListingsQuery);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const listing = await listingsService.getById(req.params.id);
      res.json(listing);
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const listing = await listingsService.create(user.id, req.body);
      res.status(201).json(listing);
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const listing = await listingsService.update(req.params.id, user.id, user.role, req.body);
      res.json(listing);
    } catch (e) {
      next(e);
    }
  },

  async updatePrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const listing = await listingsService.updatePrice(req.params.id, user.id, user.role, req.body);
      res.json(listing);
    } catch (e) {
      next(e);
    }
  },

  async reserve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const listing = await listingsService.reserve(req.params.id);
      res.json(listing);
    } catch (e) {
      next(e);
    }
  },

  async markAsSold(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const listing = await listingsService.markAsSold(req.params.id);
      res.json(listing);
    } catch (e) {
      next(e);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      await listingsService.cancel(req.params.id, user.id, user.role);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },

  async getBySeller(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const result = await listingsService.getBySellerUserId(user.id);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
};
