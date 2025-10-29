import { Router } from "express";
import {
    register,
    login,
    getProfile,
    updateProfile,
    logout,
    verifyToken
} from "../controllers/auth";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/verify-token", verifyToken); // Endpoint cho API Gateway

// Protected routes
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);

router.post("/logout", authenticateToken, logout);

export default router;
