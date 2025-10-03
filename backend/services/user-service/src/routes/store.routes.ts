import { Router } from "express";
import {
  createStore,
  getMyStore,
  updateStore,
  getAllStores,
  getStoreById
} from "../controllers/store";
import { authenticateToken, requireStoreAdmin } from "../middleware/auth";

const router = Router();

// Public routes
router.get("/", getAllStores);
router.get("/:id", getStoreById);

// Protected routes for STORE_ADMIN only
router.post("/", authenticateToken, requireStoreAdmin, createStore);
router.get("/my/store", authenticateToken, requireStoreAdmin, getMyStore);
router.put("/my/store", authenticateToken, requireStoreAdmin, updateStore);

export default router;
