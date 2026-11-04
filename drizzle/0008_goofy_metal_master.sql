ALTER TABLE "instruments" DROP CONSTRAINT IF EXISTS "visibility_level_check";
--> statement-breakpoint
ALTER TABLE "instruments" DROP CONSTRAINT IF EXISTS "instrument_visibility_level_check";
--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instrument_visibility_level_check" CHECK ("instruments"."visibility_level" IN ('public', 'musician', 'room_stock', 'service'));