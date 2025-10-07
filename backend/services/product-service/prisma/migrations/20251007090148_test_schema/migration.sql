/*
  Warnings:

  - You are about to drop the column `isActive` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `reserved` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `stockOnHand` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "isActive",
DROP COLUMN "reserved",
DROP COLUMN "stockOnHand",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "soldOutUntil" TIMESTAMP(3),
ADD COLUMN     "storeId" TEXT,
ADD COLUMN     "unavailableReason" TEXT;

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "public"."Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_isAvailable_idx" ON "public"."Product"("isAvailable");

-- CreateIndex
CREATE INDEX "Product_storeId_idx" ON "public"."Product"("storeId");

-- CreateIndex
CREATE INDEX "Reservation_orderId_idx" ON "public"."Reservation"("orderId");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "public"."Reservation"("status");
