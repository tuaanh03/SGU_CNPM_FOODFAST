import { Request, Response } from "express";
import prisma from "../lib/prisma";
const { droneSimulatorManager } = require('../utils/droneSimulator');
const { publishDroneLocationUpdate } = require('../utils/kafka');
const { otpRedis } = require('../lib/redis');
// Get all deliveries
export const getAllDeliveries = async (req: Request, res: Response) => {
  try {
    const { status, droneId } = req.query;

    const deliveries = await prisma.delivery.findMany({
      where: {
        ...(status && { status: status as any }),
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
    console.log(`🔍 [getDeliveryByOrderId] Fetching delivery for orderId: ${orderId}`);

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
      console.warn(`⚠️ [getDeliveryByOrderId] Delivery not found for orderId: ${orderId}`);
      return res.status(404).json({
        success: false,
        message: "Delivery not found",
      });
    }

    console.log(`✅ [getDeliveryByOrderId] Found delivery ${delivery.id} for orderId: ${orderId}`);
    res.status(200).json({
      success: true,
      data: delivery,
    });
  } catch (error: any) {
    console.error(`❌ [getDeliveryByOrderId] Error fetching delivery for orderId ${req.params.orderId}:`, error);
    console.error(`❌ [getDeliveryByOrderId] Error details:`, error.message, error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

// Create delivery (assign drone to order)
export const createDelivery = async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      droneId,
      storeId, // ✅ Add storeId
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
    const delivery = await prisma.$transaction(async (tx: any) => {
      const newDelivery = await tx.delivery.create({
        data: {
          orderId,
          droneId,
          storeId, // ✅ Include storeId
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

// Assign drone to delivery (Admin action)
export const assignDroneToDelivery = async (req: Request, res: Response) => {
  try {
    const { deliveryId } = req.params;
    const { droneId } = req.body;

    // Check delivery exists
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId }
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery not found",
      });
    }

    // Check drone is available
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
        message: `Drone is ${drone.status}, not available`,
      });
    }

    // Update delivery and drone status
    const updatedDelivery = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          droneId,
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

      return updated;
    });

    // Publish event to Kafka for real-time update
    const { publishDroneAssignedEvent } = require('../utils/kafka');
    try {
      await publishDroneAssignedEvent({
        eventType: 'DRONE_ASSIGNED',
        orderId: updatedDelivery.orderId,
        deliveryId: updatedDelivery.id,
        drone: {
          id: drone.id,
          name: drone.name,
          model: drone.model,
          battery: drone.battery
        },
        delivery: {
          restaurantName: updatedDelivery.restaurantName,
          restaurantAddress: updatedDelivery.restaurantAddress,
          customerName: updatedDelivery.customerName,
          customerAddress: updatedDelivery.customerAddress,
          distance: updatedDelivery.distance,
          estimatedTime: updatedDelivery.estimatedTime
        },
        assignedAt: updatedDelivery.assignedAt,
        timestamp: new Date().toISOString()
      });
      console.log(`📤 Published DRONE_ASSIGNED event for order ${updatedDelivery.orderId}`);
    } catch (kafkaError) {
      console.error('❌ Error publishing drone.assigned event:', kafkaError);
    }

    // Start drone movement simulation

    try {
      // Fetch route from Mapbox Directions API
      const mapboxToken = process.env.VITE_MAPBOX_ACCESS_TOKEN || '';
      const routeUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${drone.currentLng},${drone.currentLat};${updatedDelivery.restaurantLng},${updatedDelivery.restaurantLat}?geometries=geojson&access_token=${mapboxToken}`;

      const routeResponse = await fetch(routeUrl);
      const routeData = await routeResponse.json();

      let routeCoordinates: Array<{ lat: number; lng: number }>;

      if (routeData.routes && routeData.routes.length > 0) {
        const coordinates = routeData.routes[0].geometry.coordinates;
        routeCoordinates = coordinates.map((coord: number[]) => ({
          lng: coord[0],
          lat: coord[1]
        }));
      } else {
        // Fallback: straight line
        routeCoordinates = [
          { lat: drone.currentLat || 0, lng: drone.currentLng || 0 },
          { lat: updatedDelivery.restaurantLat, lng: updatedDelivery.restaurantLng }
        ];
      }

      const homeBase = {
        lat: drone.currentLat || 0,
        lng: drone.currentLng || 0
      };

      // Start simulation with position update callback
      await droneSimulatorManager.startSimulation(
        updatedDelivery.id,
        drone.id,
        routeCoordinates,
        homeBase,
        async (lat: number, lng: number) => {
          // Publish location update to Kafka → Socket Service
          await publishDroneLocationUpdate({
            eventType: 'DRONE_LOCATION_UPDATE',
            droneId: drone.id,
            deliveryId: updatedDelivery.id,
            orderId: updatedDelivery.orderId,
            lat,
            lng,
            timestamp: new Date().toISOString()
          });
        }
      );

      console.log(`🚁 Started drone ${drone.id} simulation for delivery ${updatedDelivery.id}`);
    } catch (simError) {
      console.error('❌ Error starting drone simulation:', simError);
    }

    res.status(200).json({
      success: true,
      data: updatedDelivery,
      message: `Drone ${drone.name} assigned successfully`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Generate OTP for pickup (when drone arrives at restaurant)
export const generatePickupOtp = async (req: Request, res: Response) => {
  try {
    const { deliveryId } = req.params;

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId }
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery not found",
      });
    }

    if (delivery.status !== 'PICKING_UP') {
      return res.status(400).json({
        success: false,
        message: "Delivery must be in PICKING_UP status to generate OTP",
      });
    }

    // Generate OTP and store in Redis with 30s TTL

    const otp = await otpRedis.generateOtp(deliveryId);
    const ttl = await otpRedis.getOtpTtl(deliveryId);

    res.status(200).json({
      success: true,
      data: {
        otp,
        expiresIn: ttl, // seconds
        deliveryId
      },
      message: "OTP generated successfully. Valid for 30 seconds."
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Wrapper: Verify OTP by orderId (convert to deliveryId)
export const verifyPickupOtpByOrderId = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Find delivery by orderId
    const delivery = await prisma.delivery.findUnique({
      where: { orderId }
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery not found for this order",
      });
    }

    // Forward to verifyPickupOtp with deliveryId
    req.params.deliveryId = delivery.id;
    return verifyPickupOtp(req, res);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Verify OTP from restaurant merchant
export const verifyPickupOtp = async (req: Request, res: Response) => {
  try {
    const { deliveryId } = req.params;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required",
      });
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId }
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery not found",
      });
    }

    // Verify OTP from Redis
    const { otpRedis } = require('../lib/redis');
    const isValid = await otpRedis.verifyOtp(deliveryId, otp);

    if (!isValid) {
      const ttl = await otpRedis.getOtpTtl(deliveryId);
      if (ttl === -2) {
        return res.status(400).json({
          success: false,
          message: "OTP has expired or does not exist",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Delete OTP after successful verification
    await otpRedis.deleteOtp(deliveryId);

    // OTP is valid - update delivery status
    const updatedDelivery = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        pickupVerifiedAt: new Date(),
        pickedUpAt: new Date(),
        status: 'IN_TRANSIT' // Drone bắt đầu bay đến khách hàng
      },
      include: {
        drone: true
      }
    });

    // Publish event to Kafka for real-time update
    const { publishPickupVerifiedEvent } = require('../utils/kafka');
    try {
      await publishPickupVerifiedEvent({
        eventType: 'PICKUP_VERIFIED',
        orderId: updatedDelivery.orderId,
        deliveryId: updatedDelivery.id,
        status: 'IN_TRANSIT',
        drone: {
          id: updatedDelivery.drone?.id,
          name: updatedDelivery.drone?.name
        },
        verifiedAt: updatedDelivery.pickupVerifiedAt,
        timestamp: new Date().toISOString()
      });
      console.log(`📤 Published PICKUP_VERIFIED event for order ${updatedDelivery.orderId}`);
    } catch (kafkaError) {
      console.error('❌ Error publishing pickup.verified event:', kafkaError);
    }

    res.status(200).json({
      success: true,
      data: updatedDelivery,
      message: "Pickup verified successfully. Drone is now in transit to customer."
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

    // If status is PICKING_UP, generate OTP automatically in Redis
    if (status === 'PICKING_UP') {
      const { otpRedis } = require('../lib/redis');
      const otp = await otpRedis.generateOtp(id);
      console.log(`🔐 Auto-generated OTP for delivery ${id}: ${otp}`);

      // Publish OTP to Socket Service for real-time notification
      const delivery = await prisma.delivery.findUnique({ where: { id } });
      if (delivery) {
        const { publishOtpGeneratedEvent } = require('../utils/kafka');
        try {
          await publishOtpGeneratedEvent({
            eventType: 'OTP_GENERATED',
            deliveryId: id,
            orderId: delivery.orderId,
            otp,
            expiresIn: 30,
            restaurantName: delivery.restaurantName,
            timestamp: new Date().toISOString()
          });
          console.log(`📤 Published OTP_GENERATED event for delivery ${id}`);
        } catch (kafkaError) {
          console.error('❌ Error publishing otp.generated event:', kafkaError);
        }
      }
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
    if ((status === 'DELIVERED' || status === 'FAILED' || status === 'CANCELLED') && delivery.droneId) {
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

    if (delivery && delivery.droneId) {
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

