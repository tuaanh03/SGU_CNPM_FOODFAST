import { Router } from "express";
import {
  getAllDrones,
  getDroneById,
  createDrone,
  updateDrone,
  updateDroneLocation,
  getAvailableDrones,
  getNearbyDrones,
  deleteDrone,
  getDroneLocation
} from "../controllers/drone.controller";

const router = Router();

router.get("/", getAllDrones);
router.get("/available", getAvailableDrones);
router.get("/nearby", getNearbyDrones);
router.get("/:id", getDroneById);
router.get("/:id/location", getDroneLocation); // Get realtime location from Redis
router.post("/", createDrone);
router.put("/:id", updateDrone);
router.patch("/:id/location", updateDroneLocation);
router.delete("/:id", deleteDrone);

export default router;

