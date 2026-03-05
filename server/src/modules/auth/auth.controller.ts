import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service.js";
import { prisma } from "../../shared/database/index.js";
import { getAuthUser } from "../../shared/helpers/getAuthUser.js";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.verifyEmail(req.body);
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.refresh(req.body.refreshToken);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };
      const result = await authService.logout(refreshToken ?? "");
      res.json(result);
    } catch (e) {
      next(e);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = getAuthUser(req);
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json(user);
    } catch (e) {
      next(e);
    }
  },
};
