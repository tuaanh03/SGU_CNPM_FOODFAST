-- CreateTable
CREATE TABLE "MenuItemRead" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "categoryId" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "soldOutUntil" TIMESTAMP(3),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSyncStatus" (
    "storeId" TEXT NOT NULL,
    "menuId" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncVersion" INTEGER NOT NULL DEFAULT 0,
    "totalMenuItems" INTEGER NOT NULL DEFAULT 0,
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSyncStatus_pkey" PRIMARY KEY ("storeId")
);

-- CreateIndex
CREATE INDEX "MenuItemRead_storeId_idx" ON "MenuItemRead"("storeId");

-- CreateIndex
CREATE INDEX "MenuItemRead_productId_idx" ON "MenuItemRead"("productId");

-- CreateIndex
CREATE INDEX "MenuItemRead_isAvailable_idx" ON "MenuItemRead"("isAvailable");

-- CreateIndex
CREATE INDEX "MenuItemRead_storeId_isAvailable_idx" ON "MenuItemRead"("storeId", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemRead_menuId_productId_key" ON "MenuItemRead"("menuId", "productId");
