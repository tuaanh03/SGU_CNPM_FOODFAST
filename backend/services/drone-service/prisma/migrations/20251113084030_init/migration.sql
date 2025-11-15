-- CreateEnum
CREATE TYPE "DroneStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'CHARGING', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'ASSIGNED', 'PICKING_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "drones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "battery" INTEGER NOT NULL DEFAULT 100,
    "maxPayload" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "maxRange" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "status" "DroneStatus" NOT NULL DEFAULT 'AVAILABLE',
    "lastMaintenance" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "droneId" TEXT NOT NULL,
    "restaurantName" TEXT NOT NULL,
    "restaurantLat" DOUBLE PRECISION NOT NULL,
    "restaurantLng" DOUBLE PRECISION NOT NULL,
    "restaurantAddress" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerLat" DOUBLE PRECISION NOT NULL,
    "customerLng" DOUBLE PRECISION NOT NULL,
    "customerAddress" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "estimatedTime" INTEGER NOT NULL,
    "actualTime" INTEGER,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_points" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "altitude" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "battery" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" TEXT NOT NULL,
    "droneId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drones_serialNumber_key" ON "drones"("serialNumber");

-- CreateIndex
CREATE INDEX "drones_status_idx" ON "drones"("status");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_orderId_key" ON "deliveries"("orderId");

-- CreateIndex
CREATE INDEX "deliveries_orderId_idx" ON "deliveries"("orderId");

-- CreateIndex
CREATE INDEX "deliveries_droneId_idx" ON "deliveries"("droneId");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE INDEX "tracking_points_deliveryId_idx" ON "tracking_points"("deliveryId");

-- CreateIndex
CREATE INDEX "maintenance_logs_droneId_idx" ON "maintenance_logs"("droneId");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "drones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_points" ADD CONSTRAINT "tracking_points_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "drones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
