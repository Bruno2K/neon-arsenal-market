import { Router } from "express";
import { productsController } from "./products.controller.js";
import { authenticate, requireRole, validateQuery, validateParams } from "../../shared/middlewares/index.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { createProductDto, updateProductDto, listProductsQueryDto, productIdParamsDto } from "./products.dto.js";

const router = Router();

router.get("/", validateQuery(listProductsQueryDto), productsController.list);
router.get("/:id", validateParams(productIdParamsDto), productsController.getById);

router.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  validateBody(createProductDto),
  productsController.create
);
router.patch(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  validateParams(productIdParamsDto),
  validateBody(updateProductDto),
  productsController.update
);
router.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  validateParams(productIdParamsDto),
  productsController.delete
);

export const productsRoutes = router;
