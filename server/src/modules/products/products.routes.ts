import { Router } from "express";
import { productsController } from "./products.controller.js";
import { authenticate, requireRole } from "../../shared/middlewares/index.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { createProductDto, updateProductDto } from "./products.dto.js";

const router = Router();

router.get("/", productsController.list);
router.get("/:id", productsController.getById);

router.post(
  "/",
  authenticate,
  requireRole("SELLER"),
  validateBody(createProductDto),
  productsController.create
);
router.patch(
  "/:id",
  authenticate,
  requireRole("SELLER", "ADMIN"),
  validateBody(updateProductDto),
  productsController.update
);
router.delete(
  "/:id",
  authenticate,
  requireRole("SELLER", "ADMIN"),
  productsController.delete
);

export const productsRoutes = router;
