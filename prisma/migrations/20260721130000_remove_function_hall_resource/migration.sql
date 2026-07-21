-- DropIndex
DROP INDEX "Booking_resource_date_idx";

-- DropIndex
DROP INDEX "Booking_resource_endDate_idx";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "resource";

-- DropEnum
DROP TYPE "ResourceType";

-- CreateIndex
CREATE INDEX "Booking_date_idx" ON "Booking"("date");

-- CreateIndex
CREATE INDEX "Booking_endDate_idx" ON "Booking"("endDate");

