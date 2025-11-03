import { Router } from "express";
import {
    registerCustomer,
    registerAdmin,
    loginCustomer,
    loginAdmin,
    getProfile,
    updateProfile,
    logout,
    verifyToken
} from "../controllers/auth";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Public routes - Customer
router.post("/customer/register", registerCustomer);
router.post("/customer/login", loginCustomer);

// Public routes - Admin
router.post("/admin/register", registerAdmin);
router.post("/admin/login", loginAdmin);

// Endpoint cho API Gateway
router.post("/verify-token", verifyToken);

// Protected routes
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);

router.post("/logout", authenticateToken, logout);

export default router;
