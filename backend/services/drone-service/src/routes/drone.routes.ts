import { Router } from "express";
import {
  getAllDrones,
  getDroneById,
  createDrone,
  updateDrone,
  updateDroneLocation,
  getAvailableDrones,
  deleteDrone
} from "../controllers/drone.controller";

const router = Router();

router.get("/", getAllDrones);
router.get("/available", getAvailableDrones);
router.get("/:id", getDroneById);
router.post("/", createDrone);
router.put("/:id", updateDrone);
router.patch("/:id/location", updateDroneLocation);
router.delete("/:id", deleteDrone);

export default router;

