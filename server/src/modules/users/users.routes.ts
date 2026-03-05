import { Router } from "express";
import { usersController } from "./users.controller.js";
import { authenticate } from "../../shared/middlewares/authenticate.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { updateMeDto } from "./users.dto.js";

const router = Router();

router.use(authenticate);
router.get("/me", usersController.getMe);
router.patch("/me", validateBody(updateMeDto), usersController.updateMe);

export const usersRoutes = router;
