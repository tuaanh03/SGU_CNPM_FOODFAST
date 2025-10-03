import express from "express";
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from "../controllers/category";
import { authenticateToken, requireStoreAdmin } from "../middleware/auth";
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

// Protected routes - chỉ STORE_ADMIN mới được phép
router.post("/", authenticateToken, requireStoreAdmin, validateBody(createCategorySchema), createCategory);
router.put("/:id", authenticateToken, requireStoreAdmin, validateParams(uuidParamSchema), validateBody(updateCategorySchema), updateCategory);
router.delete("/:id", authenticateToken, requireStoreAdmin, validateParams(uuidParamSchema), deleteCategory);

export default router;
