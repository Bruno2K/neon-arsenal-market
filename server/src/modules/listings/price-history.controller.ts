import { Request, Response, NextFunction } from "express";
import { priceHistoryService } from "./price-history.service.js";
import { requestParam } from "../../shared/http/requestFields.js";

export const priceHistoryController = {
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const history = await priceHistoryService.getHistory(requestParam(req, "listingId"));
      res.json(history);
    } catch (e) {
      next(e);
    }
  },
};
