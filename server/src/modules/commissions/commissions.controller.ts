import { Request, Response, NextFunction } from "express";
import { commissionsService } from "./commissions.service.js";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";

export const commissionsController = {
  async listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const list = await commissionsService.listTransactions(user.id, user.role);
      res.json(list);
    } catch (e) {
      next(e);
    }
  },

  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const result = await commissionsService.getBalance(user.id);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
};
