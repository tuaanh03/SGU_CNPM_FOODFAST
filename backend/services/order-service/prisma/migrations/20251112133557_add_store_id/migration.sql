-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "storeId" TEXT;

-- CreateIndex
CREATE INDEX "Order_storeId_createdAt_idx" ON "Order"("storeId", "createdAt");
