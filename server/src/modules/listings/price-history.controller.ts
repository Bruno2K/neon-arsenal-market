import { Request, Response, NextFunction } from "express";
import { priceHistoryService } from "./price-history.service.js";

export const priceHistoryController = {
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const history = await priceHistoryService.getHistory(req.params.listingId);
      res.json(history);
    } catch (e) {
      next(e);
    }
  },
};
