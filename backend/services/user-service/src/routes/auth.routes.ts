import { Router } from "express";
import {
    registerCustomer,
    registerAdmin,
    registerSystemAdmin,
    loginCustomer,
    loginAdmin,
    loginSystemAdmin,
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

// Public routes - Store Admin
router.post("/admin/register", registerAdmin);
router.post("/admin/login", loginAdmin);

// Public routes - System Admin
router.post("/system-admin/register", registerSystemAdmin);
router.post("/system-admin/login", loginSystemAdmin);

// Endpoint cho API Gateway
router.post("/verify-token", verifyToken);

// Protected routes
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);

router.post("/logout", authenticateToken, logout);

export default router;
