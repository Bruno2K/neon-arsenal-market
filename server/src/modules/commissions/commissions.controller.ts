import { Request, Response, NextFunction } from "express";
import { commissionsService } from "./commissions.service.js";

export const commissionsController = {
  async listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const list = await commissionsService.listTransactions(req.user.id, req.user.role);
      res.json(list);
    } catch (e) {
      next(e);
    }
  },

  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await commissionsService.getBalance(req.user.id);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
};
