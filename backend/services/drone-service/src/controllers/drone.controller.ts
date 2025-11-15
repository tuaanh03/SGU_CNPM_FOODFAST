import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { DroneStatus } from "@prisma/client";

// Get all drones
export const getAllDrones = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const drones = await prisma.drone.findMany({
      where: status ? { status: status as DroneStatus } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        deliveries: {
          where: { status: 'IN_TRANSIT' },
          take: 1
        }
      }
    });

    res.status(200).json({
      success: true,
      data: drones,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get drone by ID
export const getDroneById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const drone = await prisma.drone.findUnique({
      where: { id },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        maintenanceLogs: {
          orderBy: { performedAt: 'desc' },
          take: 5
        }
      }
    });

    if (!drone) {
      return res.status(404).json({
        success: false,
        message: "Drone not found",
      });
    }

    res.status(200).json({
      success: true,
      data: drone,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create new drone
export const createDrone = async (req: Request, res: Response) => {
  try {
    const { name, model, serialNumber, maxPayload, maxRange } = req.body;

    const drone = await prisma.drone.create({
      data: {
        name,
        model,
        serialNumber,
        maxPayload: maxPayload || 5.0,
        maxRange: maxRange || 20.0,
        battery: 100,
        status: 'AVAILABLE'
      },
    });

    res.status(201).json({
      success: true,
      data: drone,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update drone
export const updateDrone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const drone = await prisma.drone.update({
      where: { id },
      data,
    });

    res.status(200).json({
      success: true,
      data: drone,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update drone location
export const updateDroneLocation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { lat, lng, battery } = req.body;

    const drone = await prisma.drone.update({
      where: { id },
      data: {
        currentLat: lat,
        currentLng: lng,
        battery: battery || undefined,
        updatedAt: new Date()
      },
    });

    res.status(200).json({
      success: true,
      data: drone,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get available drones for order
export const getAvailableDrones = async (req: Request, res: Response) => {
  try {
    const { restaurantLat, restaurantLng, orderWeight } = req.query;

    const drones = await prisma.drone.findMany({
      where: {
        status: 'AVAILABLE',
        battery: { gte: 30 },
        maxPayload: { gte: parseFloat(orderWeight as string) || 0 }
      },
      orderBy: { battery: 'desc' }
    });

    // Calculate distance from restaurant if coordinates provided
    if (restaurantLat && restaurantLng) {
      const dronesWithDistance = drones.map(drone => {
        const distance = calculateDistance(
          parseFloat(restaurantLat as string),
          parseFloat(restaurantLng as string),
          drone.currentLat || 0,
          drone.currentLng || 0
        );
        return { ...drone, distanceFromRestaurant: distance };
      });

      dronesWithDistance.sort((a, b) => a.distanceFromRestaurant - b.distanceFromRestaurant);

      return res.status(200).json({
        success: true,
        data: dronesWithDistance,
      });
    }

    res.status(200).json({
      success: true,
      data: drones,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete drone
export const deleteDrone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.drone.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Drone deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Helper function
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

