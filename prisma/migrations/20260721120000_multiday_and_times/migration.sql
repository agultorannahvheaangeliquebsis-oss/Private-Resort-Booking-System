-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('STAFF', 'GUEST');

-- AlterTable: add multi-day range, owner-entered times, and source.
ALTER TABLE "Booking"
  ADD COLUMN "endDate" DATE,
  ADD COLUMN "source" "BookingSource" NOT NULL DEFAULT 'STAFF',
  ADD COLUMN "startTime" TEXT,
  ADD COLUMN "endTime" TEXT;

-- Backfill: existing single-date bookings check out the same day.
UPDATE "Booking" SET "endDate" = "date" WHERE "endDate" IS NULL;

-- Enforce NOT NULL now that every row has a value.
ALTER TABLE "Booking" ALTER COLUMN "endDate" SET NOT NULL;

-- The old single-date guard (resource, date, slot) cannot express multi-day
-- range overlaps, so it is replaced by an application-level interval check in
-- a Serializable transaction. See src/lib/booking.ts and
-- src/app/actions/bookings.ts.
DROP INDEX IF EXISTS "Booking_active_slot_key";

-- CreateIndex
CREATE INDEX "Booking_resource_endDate_idx" ON "Booking"("resource", "endDate");
