/*
  Warnings:

  - You are about to drop the column `checkIn` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `checkOut` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `roomId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the `RatePlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Room` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `date` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guestName` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slot` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('RESORT', 'FUNCTION_HALL');

-- CreateEnum
CREATE TYPE "BookingSlot" AS ENUM ('DAY', 'NIGHT', 'OVERNIGHT');

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_userId_fkey";

-- DropForeignKey
ALTER TABLE "RatePlan" DROP CONSTRAINT "RatePlan_roomId_fkey";

-- DropIndex
DROP INDEX "Booking_roomId_checkIn_checkOut_idx";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "checkIn",
DROP COLUMN "checkOut",
DROP COLUMN "roomId",
DROP COLUMN "userId",
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "date" DATE NOT NULL,
ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestName" TEXT NOT NULL,
ADD COLUMN     "guestPhone" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pax" INTEGER,
ADD COLUMN     "resource" "ResourceType" NOT NULL DEFAULT 'RESORT',
ADD COLUMN     "slot" "BookingSlot" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';

-- DropTable
DROP TABLE "RatePlan";

-- DropTable
DROP TABLE "Room";

-- CreateIndex
CREATE INDEX "Booking_resource_date_idx" ON "Booking"("resource", "date");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Guard against double-booking at the database level: no two active
-- (non-cancelled) bookings may share the same resource + date + slot.
-- Cross-slot conflicts (e.g. OVERNIGHT vs DAY) are enforced in the
-- application transaction; see src/lib/booking.ts and src/app/actions/bookings.ts.
CREATE UNIQUE INDEX "Booking_active_slot_key" ON "Booking"("resource", "date", "slot") WHERE "status" <> 'CANCELLED';
