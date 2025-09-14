import express from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStock
} from "../controllers/product";
import { authMiddleware } from "../middleware/authMiddleware";
import { validateBody, validateParams } from "../middleware/validation";
import {
  createProductSchema,
  updateProductSchema,
  uuidParamSchema
} from "../validations/product.validation";

const router = express.Router();

// Public routes - không cần auth
router.get("/", getAllProducts);
router.get("/:id", validateParams(uuidParamSchema), getProductById);
router.get("/:id/stock", validateParams(uuidParamSchema), getProductStock);

// Protected routes - cần auth (dành cho admin sau này)
router.post("/", authMiddleware, validateBody(createProductSchema), createProduct);
router.put("/:id", authMiddleware, validateParams(uuidParamSchema), validateBody(updateProductSchema), updateProduct);
router.delete("/:id", authMiddleware, validateParams(uuidParamSchema), deleteProduct);

export default router;
