import { Router } from "express";
import {
  getAllDeliveries,
  getDeliveryById,
  getDeliveryByOrderId,
  createDelivery,
  updateDeliveryStatus,
  addTrackingPoint
} from "../controllers/delivery.controller";

const router = Router();

router.get("/", getAllDeliveries);
router.get("/:id", getDeliveryById);
router.get("/order/:orderId", getDeliveryByOrderId);
router.post("/", createDelivery);
router.patch("/:id/status", updateDeliveryStatus);
router.post("/:deliveryId/tracking", addTrackingPoint);

export default router;

