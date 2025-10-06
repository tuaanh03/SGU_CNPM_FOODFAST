import { Router } from "express";
import {
    register,
    login,
    getProfile,
    updateProfile,
    logout
} from "../controllers/auth";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);

router.post("/logout", authenticateToken, logout);

export default router;
