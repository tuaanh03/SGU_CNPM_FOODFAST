import prisma from '../lib/prisma';
import { droneLocationRedis } from '../lib/redis';

// Helper: Calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Interpolate between two points
function interpolate(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  progress: number
): { lat: number; lng: number } {
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress,
  };
}

// Drone movement simulator
export class DroneSimulator {
  private deliveryId: string;
  private droneId: string;
  private route: Array<{ lat: number; lng: number }>;
  private currentSegmentIndex: number = 0;
  private progress: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private onPositionUpdate?: (lat: number, lng: number) => void;
  private homeBase: { lat: number; lng: number };

  constructor(
    deliveryId: string,
    droneId: string,
    route: Array<{ lat: number; lng: number }>,
    homeBase: { lat: number; lng: number },
    onPositionUpdate?: (lat: number, lng: number) => void
  ) {
    this.deliveryId = deliveryId;
    this.droneId = droneId;
    this.route = route;
    this.homeBase = homeBase;
    this.onPositionUpdate = onPositionUpdate;
  }

  // Start simulation
  async start(): Promise<void> {
    if (this.intervalId) {
      console.log(`⚠️ Drone ${this.droneId} simulation already running`);
      return;
    }

    console.log(`🚁 Starting drone ${this.droneId} simulation for delivery ${this.deliveryId}`);

    // Update every 3 seconds
    this.intervalId = setInterval(async () => {
      await this.updatePosition();
    }, 3000);

    // Update immediately
    await this.updatePosition();
  }

  // Update drone position
  private async updatePosition(): Promise<void> {
    // ✅ Bỏ early stop check - để arrival detection có cơ hội chạy
    if (this.currentSegmentIndex >= this.route.length) {
      console.log(`⚠️ Drone ${this.droneId} index out of bounds - stopping`);
      await this.stop();
      return;
    }

    const start = this.route[this.currentSegmentIndex];
    const end = this.route[Math.min(this.currentSegmentIndex + 1, this.route.length - 1)];

    // Calculate segment distance
    const segmentDistance = calculateDistance(start.lat, start.lng, end.lat, end.lng);

    // Drone speed: ~30 km/h = 0.5 km/min = 0.025 km per 3 seconds
    const speed = 0.025; // km per update
    const progressIncrement = speed / segmentDistance;

    this.progress += progressIncrement;

    if (this.progress >= 1) {
      // Move to next segment
      this.currentSegmentIndex++;
      this.progress = 0;

      // ✅ Không stop ngay - để arrival check có cơ hội chạy
      console.log(`🚁 Drone ${this.droneId} moved to segment ${this.currentSegmentIndex}/${this.route.length - 1}`);
    }

    // Interpolate position
    const currentPosition = interpolate(start, end, this.progress);

    // ✅ CHECK ARRIVAL TRƯỚC - Quan trọng: check distance trước khi stop
    const destination = this.route[this.route.length - 1];
    const distanceToDestination = calculateDistance(
      currentPosition.lat,
      currentPosition.lng,
      destination.lat,
      destination.lng
    );

    console.log(`📍 Drone ${this.droneId} - Distance to destination: ${(distanceToDestination * 1000).toFixed(0)}m`);

    // If within 100 meters of restaurant (tăng threshold để dễ trigger)
    if (distanceToDestination < 0.1) { // 100m instead of 50m
      console.log(`🎯 Drone ${this.droneId} arrived at restaurant!`);

      // Update delivery status to PICKING_UP
      const prisma = require('../lib/prisma').default;
      await prisma.delivery.update({
        where: { id: this.deliveryId },
        data: { status: 'PICKING_UP' }
      });

      // Auto-generate OTP
      const { otpRedis } = require('../lib/redis');
      const { publishOtpGeneratedEvent } = require('./kafka');
      const otp = await otpRedis.generateOtp(this.deliveryId);

      // Get delivery info for event
      const delivery = await prisma.delivery.findUnique({
        where: { id: this.deliveryId },
        select: {
          orderId: true,
          restaurantName: true
        }
      });

      // Publish OTP generated event
      await publishOtpGeneratedEvent({
        eventType: 'OTP_GENERATED',
        deliveryId: this.deliveryId,
        orderId: delivery?.orderId,
        otp,
        expiresIn: 30,
        restaurantName: delivery?.restaurantName,
        timestamp: new Date().toISOString()
      });

      console.log(`🔐 Auto-generated OTP for delivery ${this.deliveryId}: ${otp}`);

      // Publish arrival event
      const { publishDroneArrivedEvent } = require('./kafka');
      await publishDroneArrivedEvent({
        eventType: 'DRONE_ARRIVED_AT_RESTAURANT',
        deliveryId: this.deliveryId,
        droneId: this.droneId,
        orderId: delivery?.orderId,
        timestamp: new Date().toISOString()
      });

      console.log(`📤 Published drone.arrived event for orderId: ${delivery?.orderId}`);

      // Stop simulation - wait for OTP verification
      await this.stop();
      return;
    }

    // Save to Redis
    await droneLocationRedis.setDroneLocation(this.droneId, currentPosition.lat, currentPosition.lng);
    await droneLocationRedis.setRouteProgress(this.deliveryId,
      (this.currentSegmentIndex + this.progress) / (this.route.length - 1) * 100
    );

    console.log(`🚁 Drone ${this.droneId} at [${currentPosition.lat.toFixed(6)}, ${currentPosition.lng.toFixed(6)}] - Progress: ${((this.currentSegmentIndex + this.progress) / (this.route.length - 1) * 100).toFixed(1)}%`);

    // Callback for socket emission
    if (this.onPositionUpdate) {
      this.onPositionUpdate(currentPosition.lat, currentPosition.lng);
    }
  }

  // Stop simulation
  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`🛑 Stopped drone ${this.droneId} simulation`);
    }

    // Return to home base
    await this.returnToHomeBase();
  }

  // Return drone to home base
  private async returnToHomeBase(): Promise<void> {
    console.log(`🏠 Drone ${this.droneId} returning to home base [${this.homeBase.lat}, ${this.homeBase.lng}]`);

    // Update drone location to home base in Redis
    await droneLocationRedis.setDroneLocation(this.droneId, this.homeBase.lat, this.homeBase.lng);

    // Update drone status to AVAILABLE
    await prisma.drone.update({
      where: { id: this.droneId },
      data: {
        status: 'AVAILABLE',
        currentLat: this.homeBase.lat,
        currentLng: this.homeBase.lng
      }
    });

    // Clear route progress
    await droneLocationRedis.setRouteProgress(this.deliveryId, 100);

    console.log(`✅ Drone ${this.droneId} returned to home base`);
  }
}

// Singleton to manage all active simulations
class DroneSimulatorManager {
  private simulators: Map<string, DroneSimulator> = new Map();

  async startSimulation(
    deliveryId: string,
    droneId: string,
    route: Array<{ lat: number; lng: number }>,
    homeBase: { lat: number; lng: number },
    onPositionUpdate?: (lat: number, lng: number) => void
  ): Promise<void> {
    // Stop existing simulation if any
    if (this.simulators.has(droneId)) {
      await this.stopSimulation(droneId);
    }

    const simulator = new DroneSimulator(deliveryId, droneId, route, homeBase, onPositionUpdate);
    this.simulators.set(droneId, simulator);
    await simulator.start();
  }

  async stopSimulation(droneId: string): Promise<void> {
    const simulator = this.simulators.get(droneId);
    if (simulator) {
      await simulator.stop();
      this.simulators.delete(droneId);
    }
  }

  async stopAllSimulations(): Promise<void> {
    const promises = Array.from(this.simulators.keys()).map(droneId => this.stopSimulation(droneId));
    await Promise.all(promises);
  }
}

export const droneSimulatorManager = new DroneSimulatorManager();

