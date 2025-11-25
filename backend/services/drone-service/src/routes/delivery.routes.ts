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
  verifyPickupOtpByOrderId,
  addTrackingPoint,
  getDeliveryProgress,
  verifyCustomerPickupOtp,
  verifyCustomerPickupOtpByOrderId
} from "../controllers/delivery.controller";

const router = Router();

router.get("/", getAllDeliveries);
router.get("/:id", getDeliveryById);
router.get("/:id/progress", getDeliveryProgress); // Get delivery progress from Redis
router.get("/order/:orderId", getDeliveryByOrderId);
router.post("/", createDelivery);
router.patch("/:deliveryId/assign-drone", assignDroneToDelivery);
router.post("/:deliveryId/generate-otp", generatePickupOtp);
router.post("/:deliveryId/verify-otp", verifyPickupOtp); // Merchant verify OTP
router.post("/order/:orderId/verify-otp", verifyPickupOtpByOrderId); // Merchant verify by orderId
router.post("/:deliveryId/verify-customer-otp", verifyCustomerPickupOtp); // Customer verify OTP
router.post("/order/:orderId/verify-customer-otp", verifyCustomerPickupOtpByOrderId); // Customer verify by orderId
router.patch("/:id/status", updateDeliveryStatus);
router.post("/:deliveryId/tracking", addTrackingPoint);

export default router;

