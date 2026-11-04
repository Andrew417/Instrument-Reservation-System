CREATE TABLE IF NOT EXISTS "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_services" (
	"user_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "user_services_user_id_service_id_pk" PRIMARY KEY("user_id","service_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_assignment_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_user_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"granted_by_admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_assignment_action_check" CHECK ("service_assignment_audit_log"."action" IN ('granted', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN IF NOT EXISTS "service_id" uuid;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_services" ADD CONSTRAINT "user_services_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_services" ADD CONSTRAINT "user_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "service_assignment_audit_log" ADD CONSTRAINT "service_assignment_audit_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "service_assignment_audit_log" ADD CONSTRAINT "service_assignment_audit_log_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "service_assignment_audit_log" ADD CONSTRAINT "service_assignment_audit_log_granted_by_admin_id_admins_id_fk" FOREIGN KEY ("granted_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "instruments" ADD CONSTRAINT "instruments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "instruments" DROP CONSTRAINT IF EXISTS "visibility_level_check";
--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "visibility_level_check" CHECK ("visibility_level" IN ('public', 'musician', 'room_stock', 'service'));
--> statement-breakpoint
ALTER TABLE "instruments" DROP CONSTRAINT IF EXISTS "service_visibility_check";
--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "service_visibility_check" CHECK (("visibility_level" = 'service' AND "service_id" IS NOT NULL) OR ("visibility_level" <> 'service' AND "service_id" IS NULL));
