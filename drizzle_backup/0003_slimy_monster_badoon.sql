ALTER TABLE "hard_limits" ADD COLUMN "show_policy_explainer_to_users" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "cancellation_reason" text;