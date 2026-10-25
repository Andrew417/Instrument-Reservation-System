CREATE TABLE IF NOT EXISTS "admin_push_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"notify_new_registrations" boolean DEFAULT true NOT NULL,
	"notify_new_requests" boolean DEFAULT true NOT NULL,
	"notify_member_messages" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_push_preferences_admin_id_unique" UNIQUE("admin_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "instrument_type_settings" (
	"type" text PRIMARY KEY NOT NULL,
	"can_be_requested" boolean DEFAULT false NOT NULL,
	"flat_fee_outside" numeric DEFAULT '0.00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "musician_status_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_user_id" uuid NOT NULL,
	"granted_by_admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "musician_audit_action_check" CHECK ("musician_status_audit_log"."action" IN ('granted', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"admin_id" uuid,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"language" text DEFAULT 'ar' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "reservation_series" ALTER COLUMN "instrument_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "instrument_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN IF NOT EXISTS "visibility_level" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN IF NOT EXISTS "is_out_of_service" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_series" ADD COLUMN IF NOT EXISTS "is_type_request" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_series" ADD COLUMN IF NOT EXISTS "requested_type" text;--> statement-breakpoint
ALTER TABLE "reservation_series" ADD COLUMN IF NOT EXISTS "exceeded_limits" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "is_type_request" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "requested_type" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "exceeded_limits" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_musician" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "admin_push_preferences" ADD CONSTRAINT "admin_push_preferences_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "musician_status_audit_log" ADD CONSTRAINT "musician_status_audit_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "musician_status_audit_log" ADD CONSTRAINT "musician_status_audit_log_granted_by_admin_id_admins_id_fk" FOREIGN KEY ("granted_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "instruments" ADD CONSTRAINT "visibility_level_check" CHECK ("instruments"."visibility_level" IN ('public', 'musician', 'room_stock')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;