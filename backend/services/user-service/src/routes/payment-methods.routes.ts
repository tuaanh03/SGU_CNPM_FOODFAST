import { Router } from "express";
import {
  addPaymentMethod,
  getPaymentMethods,
  updatePaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod
} from "../controllers/payment-methods";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Tất cả routes đều yêu cầu authentication
router.get("/", authenticateToken, getPaymentMethods);
router.post("/", authenticateToken, addPaymentMethod);
router.put("/:id", authenticateToken, updatePaymentMethod);
router.delete("/:id", authenticateToken, deletePaymentMethod);
router.patch("/:id/default", authenticateToken, setDefaultPaymentMethod);

export default router;
