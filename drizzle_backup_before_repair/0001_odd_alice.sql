DO $$ BEGIN
  ALTER TABLE "sessions" DROP CONSTRAINT "sessions_token_unique";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "reservations" DROP CONSTRAINT "status_check";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint

ALTER TABLE "messages" ALTER COLUMN "admin_id" DROP NOT NULL;--> statement-breakpoint

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "user_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sender_role" text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sender_name" text;--> statement-breakpoint

ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "is_no_show" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "no_show_marked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "no_show_admin_id" uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "reservations" ADD CONSTRAINT "reservations_no_show_admin_id_admins_id_fk" FOREIGN KEY ("no_show_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "reservations" ADD CONSTRAINT "status_check" CHECK ("reservations"."status" IN ('pending','approved','rejected','auto_rejected','cancelled','ongoing','completed','expired'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;