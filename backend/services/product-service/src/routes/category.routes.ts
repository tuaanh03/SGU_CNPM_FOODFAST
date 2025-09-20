import express from "express";
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from "../controllers/category";
import { authMiddleware } from "../middleware/authMiddleware";
import { validateBody, validateParams } from "../middleware/validation";
import {
  createCategorySchema,
  updateCategorySchema,
  uuidParamSchema
} from "../validations/product.validation";

const router = express.Router();

// Public routes - không cần auth
router.get("/", getAllCategories);
router.get("/:id", validateParams(uuidParamSchema), getCategoryById);

// Protected routes - cần auth (dành cho admin sau này)
router.post("/", authMiddleware, validateBody(createCategorySchema), createCategory);
router.put("/:id", authMiddleware, validateParams(uuidParamSchema), validateBody(updateCategorySchema), updateCategory);
router.delete("/:id", authMiddleware, validateParams(uuidParamSchema), deleteCategory);

export default router;
