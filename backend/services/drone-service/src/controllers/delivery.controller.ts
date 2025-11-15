import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { DeliveryStatus } from "@prisma/client";

// Get all deliveries
export const getAllDeliveries = async (req: Request, res: Response) => {
  try {
    const { status, droneId } = req.query;

    const deliveries = await prisma.delivery.findMany({
      where: {
        ...(status && { status: status as DeliveryStatus }),
        ...(droneId && { droneId: droneId as string })
      },
      orderBy: { createdAt: 'desc' },
      include: {
        drone: true,
        trackingPoints: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });

    res.status(200).json({
      success: true,
      data: deliveries,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get delivery by ID
export const getDeliveryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        drone: true,
        trackingPoints: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery not found",
      });
    }

    res.status(200).json({
      success: true,
      data: delivery,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get delivery by order ID
export const getDeliveryByOrderId = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const delivery = await prisma.delivery.findUnique({
      where: { orderId },
      include: {
        drone: true,
        trackingPoints: {
          orderBy: { timestamp: 'desc' },
          take: 50
        }
      }
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery not found",
      });
    }

    res.status(200).json({
      success: true,
      data: delivery,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create delivery (assign drone to order)
export const createDelivery = async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      droneId,
      restaurantName,
      restaurantLat,
      restaurantLng,
      restaurantAddress,
      customerName,
      customerPhone,
      customerLat,
      customerLng,
      customerAddress,
      distance,
      estimatedTime
    } = req.body;

    // Check if drone is available
    const drone = await prisma.drone.findUnique({
      where: { id: droneId }
    });

    if (!drone) {
      return res.status(404).json({
        success: false,
        message: "Drone not found",
      });
    }

    if (drone.status !== 'AVAILABLE') {
      return res.status(400).json({
        success: false,
        message: "Drone is not available",
      });
    }

    // Create delivery and update drone status
    const delivery = await prisma.$transaction(async (tx) => {
      const newDelivery = await tx.delivery.create({
        data: {
          orderId,
          droneId,
          restaurantName,
          restaurantLat,
          restaurantLng,
          restaurantAddress,
          customerName,
          customerPhone,
          customerLat,
          customerLng,
          customerAddress,
          distance,
          estimatedTime,
          status: 'ASSIGNED',
          assignedAt: new Date()
        },
        include: {
          drone: true
        }
      });

      await tx.drone.update({
        where: { id: droneId },
        data: { status: 'IN_USE' }
      });

      return newDelivery;
    });

    res.status(201).json({
      success: true,
      data: delivery,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update delivery status
export const updateDeliveryStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updateData: any = { status };

    if (status === 'PICKING_UP') {
      updateData.pickedUpAt = new Date();
    } else if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    }

    const delivery = await prisma.delivery.update({
      where: { id },
      data: updateData,
      include: {
        drone: true
      }
    });

    // If delivery is completed, set drone back to available
    if (status === 'DELIVERED' || status === 'FAILED' || status === 'CANCELLED') {
      await prisma.drone.update({
        where: { id: delivery.droneId },
        data: { status: 'AVAILABLE' }
      });
    }

    res.status(200).json({
      success: true,
      data: delivery,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add tracking point
export const addTrackingPoint = async (req: Request, res: Response) => {
  try {
    const { deliveryId } = req.params;
    const { lat, lng, altitude, speed, battery } = req.body;

    const trackingPoint = await prisma.trackingPoint.create({
      data: {
        deliveryId,
        lat,
        lng,
        altitude,
        speed,
        battery
      }
    });

    // Update drone location
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId }
    });

    if (delivery) {
      await prisma.drone.update({
        where: { id: delivery.droneId },
        data: {
          currentLat: lat,
          currentLng: lng,
          battery
        }
      });
    }

    res.status(201).json({
      success: true,
      data: trackingPoint,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

