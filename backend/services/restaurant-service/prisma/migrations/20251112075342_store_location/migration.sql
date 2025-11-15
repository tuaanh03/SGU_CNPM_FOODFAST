-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Store_latitude_longitude_idx" ON "Store"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Store_district_isActive_idx" ON "Store"("district", "isActive");
