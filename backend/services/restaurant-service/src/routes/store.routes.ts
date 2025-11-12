import { Router } from "express";
import {
  createStore,
  getMyStore,
  updateStore,
  getAllStores,
  getStoreById,
  checkStoreByOwnerId,
  getMyOrders
} from "../controllers/store";
import { authenticateToken, requireStoreAdmin } from "../middleware/auth";

const router = Router();

// Public routes - không cần authentication
router.get("/", getAllStores);

// Internal route - kiểm tra store theo ownerId (must be before "/:id")
router.get("/internal/check/:ownerId", checkStoreByOwnerId);

// Protected routes - chỉ STORE_ADMIN mới được phép
router.post("/", authenticateToken, requireStoreAdmin, createStore);
router.get("/my/store", authenticateToken, requireStoreAdmin, getMyStore);
router.get("/my/orders", authenticateToken, requireStoreAdmin, getMyOrders);
router.put("/my/store", authenticateToken, requireStoreAdmin, updateStore);

// Lấy thông tin cửa hàng theo ID (public) - đặt sau các route tĩnh để tránh bị che khuất
router.get("/:id", getStoreById);

export default router;
