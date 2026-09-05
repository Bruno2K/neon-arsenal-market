import { Request, Response, NextFunction } from "express";
import { paymentsService } from "./payments.service.js";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";
import { logger } from "../../shared/logger.js";
import { verifyPayPalWebhookSignature } from "../../shared/utils/paypalWebhook.js";

export const paymentsController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const result = await paymentsService.createPaymentLink(user.id, req.body);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },

  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawBody = req.rawBody;
      if (!rawBody) {
        logger.warn({ requestId: req.requestId }, "paypal webhook missing raw body");
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }

      const verified = await verifyPayPalWebhookSignature({
        rawBody,
        headers: {
          "paypal-transmission-id": headerValue(req.headers["paypal-transmission-id"]),
          "paypal-transmission-time": headerValue(req.headers["paypal-transmission-time"]),
          "paypal-transmission-sig": headerValue(req.headers["paypal-transmission-sig"]),
          "paypal-cert-url": headerValue(req.headers["paypal-cert-url"]),
          "paypal-auth-algo": headerValue(req.headers["paypal-auth-algo"]),
        },
      });

      if (!verified) {
        logger.warn({ requestId: req.requestId }, "paypal webhook signature rejected");
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }

      await paymentsService.handleWebhook(req.body);
      res.status(200).send();
    } catch (e) {
      next(e);
    }
  },
};

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
