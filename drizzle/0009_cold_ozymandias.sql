CREATE INDEX "instruments_service_removed_idx" ON "instruments" USING btree ("service_id","is_removed");--> statement-breakpoint
CREATE INDEX "reservations_instrument_status_idx" ON "reservations" USING btree ("instrument_id","status");--> statement-breakpoint
CREATE INDEX "reservations_user_status_idx" ON "reservations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_services_service_id_idx" ON "user_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "users_status_created_at_idx" ON "users" USING btree ("approval_status","is_active","created_at");