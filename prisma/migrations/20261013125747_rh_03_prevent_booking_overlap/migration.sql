
-- RH-03: Enforce reservation booking integrity.
-- These PostgreSQL constraints cannot be expressed in Prisma Schema Language.

-- Enable GiST equality support for UUID resource identifiers.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent invalid or zero-length reservation intervals.
ALTER TABLE "Reservation"
ADD CONSTRAINT "reservation_valid_interval"
CHECK ("endAt" > "startAt");

-- Prevent overlapping confirmed reservations for the same resource.
-- Half-open intervals [startAt, endAt) allow adjacent bookings.
-- Cancelled reservations are excluded from conflict checking.
ALTER TABLE "Reservation"
ADD CONSTRAINT "reservation_no_confirmed_overlap"
EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
)
WHERE ("status" = 'CONFIRMED');
