import { Request, Response, NextFunction } from "express";
import { usersService } from "./users.service.js";

export const usersController = {
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const user = await usersService.getMe(req.user.id);
      res.json(user);
    } catch (e) {
      next(e);
    }
  },

  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const user = await usersService.updateMe(req.user.id, req.body);
      res.json(user);
    } catch (e) {
      next(e);
    }
  },
};
