CREATE TABLE IF NOT EXISTS "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"admin_id" uuid,
	"token" text NOT NULL,
	"language" text DEFAULT 'ar' NOT NULL,
	"platform" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_key" UNIQUE("token"),
	CONSTRAINT "push_tokens_language_check" CHECK ("language" IN ('ar', 'en')),
	CONSTRAINT "push_tokens_owner_check" CHECK ("user_id" IS NOT NULL OR "admin_id" IS NOT NULL)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_tokens_user_id_idx" ON "push_tokens" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_tokens_admin_id_idx" ON "push_tokens" ("admin_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_push_preferences" (
	"admin_id" uuid PRIMARY KEY NOT NULL,
	"notify_registrations" boolean DEFAULT true NOT NULL,
	"notify_reservations" boolean DEFAULT true NOT NULL,
	"notify_chat" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_push_preferences" ADD CONSTRAINT "admin_push_preferences_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
