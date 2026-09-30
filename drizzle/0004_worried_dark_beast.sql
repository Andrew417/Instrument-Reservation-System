ALTER TABLE "instruments" ADD COLUMN IF NOT EXISTS "is_reserve_pool" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "reservation_series" ADD COLUMN IF NOT EXISTS "service_location" text;
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "service_location" text;
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "band_pack_id" text;
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "condition_status" text DEFAULT 'uninspected';
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "condition_notes" text;
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "condition_photo_url" text;
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "condition_tags" text;
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "condition_checked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "condition_checked_by" text;
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "booked_by_admin" boolean DEFAULT false NOT NULL;