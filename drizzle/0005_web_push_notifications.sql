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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'push_subscriptions_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'push_subscriptions_admin_id_admins_id_fk'
  ) THEN
    ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_push_subs_user" ON "push_subscriptions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_push_subs_admin" ON "push_subscriptions" USING btree ("admin_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_push_preferences" (
	"id" uuid DEFAULT gen_random_uuid(),
	"admin_id" uuid NOT NULL,
	"notify_new_registrations" boolean DEFAULT true NOT NULL,
	"notify_new_requests" boolean DEFAULT true NOT NULL,
	"notify_member_messages" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_push_preferences_admin_id_unique" UNIQUE("admin_id")
);
--> statement-breakpoint
DO $$
BEGIN
  -- Add id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_push_preferences' AND column_name = 'id'
  ) THEN
    ALTER TABLE "admin_push_preferences" ADD COLUMN "id" uuid DEFAULT gen_random_uuid();
  END IF;

  -- Rename old column notify_registrations -> notify_new_registrations if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_push_preferences' AND column_name = 'notify_registrations'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_push_preferences' AND column_name = 'notify_new_registrations'
  ) THEN
    ALTER TABLE "admin_push_preferences" RENAME COLUMN "notify_registrations" TO "notify_new_registrations";
  END IF;

  -- Rename old column notify_reservations -> notify_new_requests if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_push_preferences' AND column_name = 'notify_reservations'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_push_preferences' AND column_name = 'notify_new_requests'
  ) THEN
    ALTER TABLE "admin_push_preferences" RENAME COLUMN "notify_reservations" TO "notify_new_requests";
  END IF;

  -- Rename old column notify_chat -> notify_member_messages if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_push_preferences' AND column_name = 'notify_chat'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_push_preferences' AND column_name = 'notify_member_messages'
  ) THEN
    ALTER TABLE "admin_push_preferences" RENAME COLUMN "notify_chat" TO "notify_member_messages";
  END IF;

  -- Ensure FK exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'admin_push_preferences_admin_id_admins_id_fk'
  ) THEN
    ALTER TABLE "admin_push_preferences" ADD CONSTRAINT "admin_push_preferences_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
