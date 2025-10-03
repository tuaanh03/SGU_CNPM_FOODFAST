import { Router } from "express";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} from "../controllers/address";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Tất cả routes đều yêu cầu authentication
router.get("/", authenticateToken, getAddresses);
router.post("/", authenticateToken, createAddress);
router.put("/:id", authenticateToken, updateAddress);
router.delete("/:id", authenticateToken, deleteAddress);
router.patch("/:id/default", authenticateToken, setDefaultAddress);

export default router;
