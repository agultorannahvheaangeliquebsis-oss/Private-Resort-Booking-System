-- Add a guest-facing reference code to Booking, backfilling existing rows.
ALTER TABLE "Booking" ADD COLUMN "reference" TEXT;

UPDATE "Booking"
SET "reference" = upper(substr(md5(random()::text || "id"), 1, 7))
WHERE "reference" IS NULL;

ALTER TABLE "Booking" ALTER COLUMN "reference" SET NOT NULL;

CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");
