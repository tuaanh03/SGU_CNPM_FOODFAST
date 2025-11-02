import { Router } from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductAvailability,
  syncAllProducts,
} from "../controllers/product";
import { authenticateToken, requireStoreAdmin } from "../middleware/auth";

const router = Router();

// Public routes - không cần authentication
router.get("/", getAllProducts);
router.get("/:id", getProductById);

// Protected routes - chỉ STORE_ADMIN mới được phép
router.post("/", authenticateToken, requireStoreAdmin, createProduct);
router.put("/:id", authenticateToken, requireStoreAdmin, updateProduct);
router.delete("/:id", authenticateToken, requireStoreAdmin, deleteProduct);
router.patch("/:id/availability", authenticateToken, requireStoreAdmin, updateProductAvailability);

// Đồng bộ thủ công tất cả products sang Order Service
router.post("/sync-all", authenticateToken, requireStoreAdmin, syncAllProducts);

export default router;
