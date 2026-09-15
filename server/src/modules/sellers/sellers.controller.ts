import { Request, Response, NextFunction } from "express";
import { sellersService } from "./sellers.service.js";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";
import { requestParam } from "../../shared/http/requestFields.js";

export const sellersController = {
  /**
   * AUD-008 (PR11): public, unauthenticated. Always approved-only and always the
   * narrow public projection — no email, balance, commissionRate, or isApproved.
   * There is no client-controlled filter; `GET /admin/sellers` is the ADMIN-only
   * full-row equivalent (all statuses) used by the admin management screens.
   */
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await sellersService.listPublic();
      res.json(list);
    } catch (e) {
      next(e);
    }
  },

  /** AUD-008 (PR11): public, unauthenticated, approved-only, narrow projection. */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const seller = await sellersService.getPublicById(requestParam(req, "id"));
      res.json(seller);
    } catch (e) {
      next(e);
    }
  },

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const seller = await sellersService.getByUserId(user.id);
      res.json(seller);
    } catch (e) {
      next(e);
    }
  },

  async apply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const seller = await sellersService.apply(user.id, req.body);
      res.status(201).json(seller);
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(req);
      const seller = await sellersService.update(requestParam(req, "id"), user.id, user.role, req.body);
      res.json(seller);
    } catch (e) {
      next(e);
    }
  },

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const seller = await sellersService.approve(requestParam(req, "id"), req.body.isApproved);
      res.json(seller);
    } catch (e) {
      next(e);
    }
  },
};
