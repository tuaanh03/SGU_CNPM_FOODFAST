import { Router } from "express";
import {
  createStore,
  getMyStore,
  updateStore,
  getAllStores,
  getStoreById,
  checkStoreByOwnerId
} from "../controllers/store";
import { authenticateToken, requireStoreAdmin } from "../middleware/auth";

const router = Router();

// Public routes - không cần authentication
router.get("/", getAllStores);
router.get("/:id", getStoreById);

// Internal route - kiểm tra store theo ownerId
router.get("/internal/check/:ownerId", checkStoreByOwnerId);

// Protected routes - chỉ STORE_ADMIN mới được phép
router.post("/", authenticateToken, requireStoreAdmin, createStore);
router.get("/my/store", authenticateToken, requireStoreAdmin, getMyStore);
router.put("/my/store", authenticateToken, requireStoreAdmin, updateStore);

export default router;

