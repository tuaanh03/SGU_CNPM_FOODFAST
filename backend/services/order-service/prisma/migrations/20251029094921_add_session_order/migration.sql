-- CreateEnum
CREATE TYPE "OrderSessionStatus" AS ENUM ('active', 'expired', 'completed', 'cancelled');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'expired';

-- CreateTable
CREATE TABLE "OrderSession" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderSessionStatus" NOT NULL DEFAULT 'active',
    "sessionDurationMinutes" INTEGER NOT NULL DEFAULT 15,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentAttempts" INTEGER NOT NULL DEFAULT 0,
    "maxPaymentAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastPaymentAttempt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderSession_orderId_key" ON "OrderSession"("orderId");

-- CreateIndex
CREATE INDEX "OrderSession_orderId_idx" ON "OrderSession"("orderId");

-- CreateIndex
CREATE INDEX "OrderSession_status_expiresAt_idx" ON "OrderSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "OrderSession_expiresAt_idx" ON "OrderSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "OrderSession" ADD CONSTRAINT "OrderSession_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
