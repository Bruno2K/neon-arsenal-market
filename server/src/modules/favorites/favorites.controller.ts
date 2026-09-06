import { Request, Response, NextFunction } from "express";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";
import { requestParam } from "../../shared/http/requestFields.js";
import { favoritesService } from "./favorites.service.js";

export const favoritesController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const result = await favoritesService.list(user.id);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const result = await favoritesService.add(user.id, req.body);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      await favoritesService.remove(user.id, requestParam(req, "listingId"));
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
};
