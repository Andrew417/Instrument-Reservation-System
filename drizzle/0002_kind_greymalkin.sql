CREATE TABLE "notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mute_account_approval_emails" boolean DEFAULT false NOT NULL,
	"mute_reservation_request_emails" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_admin_id" uuid,
	"actor_admin_name" text,
	"target_email" text NOT NULL,
	"target_name" text NOT NULL,
	"old_role" text NOT NULL,
	"new_role" text NOT NULL,
	"action" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admins" DROP CONSTRAINT "admins_phone_number_key";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_phone_number_key";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "failed_login_attempts" ADD COLUMN "email" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "admin_id" uuid;--> statement-breakpoint
ALTER TABLE "password_reset_otps" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "password_reset_otps" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "password_reset_otps" ADD COLUMN "request_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "password_reset_otps" ADD COLUMN "window_start_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "password_reset_otps" ADD COLUMN "last_requested_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failed_login_attempts" DROP COLUMN "phone_number";--> statement-breakpoint
ALTER TABLE "password_reset_otps" DROP COLUMN "phone_number";--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_email_key" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "password_reset_otps" ADD CONSTRAINT "password_reset_otps_email_key" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE("email");