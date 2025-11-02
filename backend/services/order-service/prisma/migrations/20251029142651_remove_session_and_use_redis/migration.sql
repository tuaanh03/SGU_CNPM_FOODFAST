/*
  Warnings:

  - The values [failed,expired] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `OrderSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('pending', 'success', 'cancelled');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."OrderSession" DROP CONSTRAINT "OrderSession_orderId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "expirationTime" TIMESTAMP(3);

-- DropTable
DROP TABLE "public"."OrderSession";

-- DropEnum
DROP TYPE "public"."OrderSessionStatus";

-- CreateIndex
CREATE INDEX "Order_expirationTime_idx" ON "Order"("expirationTime");
