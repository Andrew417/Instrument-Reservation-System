ALTER TABLE "reservations" ADD COLUMN "musician_name" text NOT NULL DEFAULT 'Not specified';
ALTER TABLE "reservations" ALTER COLUMN "musician_name" DROP DEFAULT;
