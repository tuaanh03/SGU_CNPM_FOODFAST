import { Router } from "express";
import {
  getAllDeliveries,
  getDeliveryById,
  getDeliveryByOrderId,
  createDelivery,
  assignDroneToDelivery,
  updateDeliveryStatus,
  generatePickupOtp,
  verifyPickupOtp,
  addTrackingPoint
} from "../controllers/delivery.controller";

const router = Router();

router.get("/", getAllDeliveries);
router.get("/:id", getDeliveryById);
router.get("/order/:orderId", getDeliveryByOrderId);
router.post("/", createDelivery);
router.patch("/:deliveryId/assign-drone", assignDroneToDelivery);
router.post("/:deliveryId/generate-otp", generatePickupOtp);
router.post("/:deliveryId/verify-otp", verifyPickupOtp);
router.patch("/:id/status", updateDeliveryStatus);
router.post("/:deliveryId/tracking", addTrackingPoint);

export default router;

