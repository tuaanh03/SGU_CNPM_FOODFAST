import { Request, Response } from "express";
import prisma from "../lib/prisma";

// Get all drones
export const getAllDrones = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const drones = await prisma.drone.findMany({
      where: status ? { status: status as any } : {},
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
      const dronesWithDistance = drones.map((drone: any) => {
        const distance = calculateDistance(
          parseFloat(restaurantLat as string),
          parseFloat(restaurantLng as string),
          drone.currentLat || 0,
          drone.currentLng || 0
        );
        return { ...drone, distanceFromRestaurant: distance };
      });

      dronesWithDistance.sort((a: any, b: any) => a.distanceFromRestaurant - b.distanceFromRestaurant);

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

// Get nearby drones for map display (admin dashboard)
export const getNearbyDrones = async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp tọa độ (lat, lng)",
      });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const radiusKm = Math.min(parseFloat(radius as string), 10); // Max 10km

    // Get all available drones with coordinates
    const allDrones = await prisma.drone.findMany({
      where: {
        status: 'AVAILABLE',
        battery: { gte: 30 },
        currentLat: { not: null },
        currentLng: { not: null }
      }
    });

    // Calculate distance for each drone
    const dronesWithDistance = allDrones
      .map((drone: any) => {
        const distance = calculateDistance(latitude, longitude, drone.currentLat!, drone.currentLng!);
        return {
          id: drone.id,
          name: drone.name,
          model: drone.model,
          battery: drone.battery,
          maxPayload: drone.maxPayload,
          currentLat: drone.currentLat,
          currentLng: drone.currentLng,
          distance: Math.round(distance * 100) / 100,
          status: drone.status
        };
      })
      .filter((drone: any) => drone.distance <= radiusKm)
      .sort((a: any, b: any) => a.distance - b.distance);

    res.status(200).json({
      success: true,
      data: dronesWithDistance,
      meta: {
        radius: radiusKm,
        total: dronesWithDistance.length,
        center: { lat: latitude, lng: longitude }
      }
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

// Get drone realtime location from Redis
export const getDroneLocation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { droneLocationRedis } = require('../lib/redis');

    // Try to get location from Redis first (realtime position)
    const redisLocation = await droneLocationRedis.getDroneLocation(id);

    if (redisLocation) {
      console.log(`✅ [getDroneLocation] Found realtime location in Redis for drone ${id}`);
      return res.status(200).json({
        success: true,
        data: {
          lat: redisLocation.lat,
          lng: redisLocation.lng,
          source: 'redis' // Realtime position
        }
      });
    }

    // Fallback to database (home base position)
    const drone = await prisma.drone.findUnique({
      where: { id },
      select: { currentLat: true, currentLng: true, status: true }
    });

    if (!drone) {
      return res.status(404).json({
        success: false,
        message: "Drone not found"
      });
    }

    if (!drone.currentLat || !drone.currentLng) {
      return res.status(404).json({
        success: false,
        message: "Drone location not available"
      });
    }

    console.log(`⚠️ [getDroneLocation] Using DB location (home base) for drone ${id}`);
    return res.status(200).json({
      success: true,
      data: {
        lat: drone.currentLat,
        lng: drone.currentLng,
        source: 'database' // Home base position
      }
    });
  } catch (error: any) {
    console.error('❌ [getDroneLocation] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
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

