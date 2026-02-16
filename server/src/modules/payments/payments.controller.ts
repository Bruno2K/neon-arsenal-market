import { Request, Response, NextFunction } from "express";
import { paymentsService } from "./payments.service.js";

export const paymentsController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await paymentsService.createPaymentLink(req.user.id, req.body);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },

  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await paymentsService.handleWebhook(req.body);
      res.status(200).send();
    } catch (e) {
      next(e);
    }
  },
};
