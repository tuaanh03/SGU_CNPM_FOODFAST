-- CreateTable
CREATE TABLE "RestaurantOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "customerInfo" JSONB NOT NULL,
    "restaurantStatus" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),

    CONSTRAINT "RestaurantOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOrder_orderId_key" ON "RestaurantOrder"("orderId");

-- CreateIndex
CREATE INDEX "RestaurantOrder_storeId_receivedAt_idx" ON "RestaurantOrder"("storeId", "receivedAt");

-- CreateIndex
CREATE INDEX "RestaurantOrder_restaurantStatus_idx" ON "RestaurantOrder"("restaurantStatus");
