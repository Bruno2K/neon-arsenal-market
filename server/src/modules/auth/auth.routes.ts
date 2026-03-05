import { Router } from "express";
import { authController } from "./auth.controller.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { authenticate } from "../../shared/middlewares/authenticate.js";
import { registerDto, verifyEmailDto, loginDto, refreshDto } from "./auth.dto.js";

const router = Router();

router.post("/register", validateBody(registerDto), authController.register);
router.post("/verify-email", validateBody(verifyEmailDto), authController.verifyEmail);
router.post("/login", validateBody(loginDto), authController.login);
router.post("/refresh", validateBody(refreshDto), authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

export const authRoutes = router;
