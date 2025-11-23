-- DropForeignKey
ALTER TABLE "deliveries" DROP CONSTRAINT "deliveries_droneId_fkey";

-- AlterTable
ALTER TABLE "deliveries" ALTER COLUMN "droneId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "drones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
