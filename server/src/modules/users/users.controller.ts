import { Request, Response, NextFunction } from "express";
import { usersService } from "./users.service.js";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";

export const usersController = {
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const me = await usersService.getMe(user.id);
      res.json(me);
    } catch (e) {
      next(e);
    }
  },

  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const updated = await usersService.updateMe(user.id, req.body);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
};
