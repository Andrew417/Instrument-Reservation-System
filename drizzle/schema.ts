import { pgTable, check, uuid, text, numeric, boolean, timestamp, foreignKey, integer, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const tstzrange = customType<{ data: string; driverData: string }>({
	dataType() {
		return "tstzrange";
	},
});



export const instruments = pgTable("instruments", {
	id: uuid().defaultRandom().notNull(),
	name: text().notNull(),
	type: text().notNull(),
	photoUrl: text("photo_url"),
	description: text(),
	outsideFeePerDay: numeric("outside_fee_per_day").default('0').notNull(),
	bookingMode: text("booking_mode").notNull(),
	isRemoved: boolean("is_removed").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("booking_mode_check", sql`booking_mode = ANY (ARRAY['manual'::text, 'instant'::text])`),
]);

export const sessions = pgTable("sessions", {
	id: uuid().defaultRandom().notNull(),
	token: text().notNull(),
	userId: uuid("user_id"),
	adminId: uuid("admin_id"),
	role: text().notNull(),
	lastActiveAt: timestamp("last_active_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [admins.id],
			name: "sessions_admin_id_admins_id_fk"
		}).onDelete("cascade"),
]);

export const admins = pgTable("admins", {
	id: uuid().defaultRandom().notNull(),
	name: text().notNull(),
	phoneNumber: text("phone_number").notNull(),
	isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	passwordHash: text("password_hash").notNull(),
	role: text().default('admin').notNull(),
	approvalStatus: text("approval_status").default('approved').notNull(),
	email: text().notNull(),
});

export const users = pgTable("users", {
	id: uuid().defaultRandom().notNull(),
	name: text().notNull(),
	phoneNumber: text("phone_number").notNull(),
	isTrusted: boolean("is_trusted").default(false).notNull(),
	isActive: boolean("is_active").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	passwordHash: text("password_hash").notNull(),
	approvalStatus: text("approval_status").default('pending').notNull(),
	email: text().notNull(),
}, (table) => [
	check("user_approval_status_check", sql`approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
]);

export const reservationSeries = pgTable("reservation_series", {
	id: uuid().defaultRandom().notNull(),
	userId: uuid("user_id"),
	adminId: uuid("admin_id"),
	instrumentId: uuid("instrument_id").notNull(),
	patternType: text("pattern_type").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "reservation_series_user_id_users_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [admins.id],
			name: "reservation_series_admin_id_admins_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.instrumentId],
			foreignColumns: [instruments.id],
			name: "reservation_series_instrument_id_instruments_id_fk"
		}).onDelete("cascade"),
	check("pattern_type_check", sql`pattern_type = ANY (ARRAY['weekly'::text, 'custom'::text])`),
]);

export const reservations = pgTable("reservations", {
	id: uuid().defaultRandom().notNull(),
	seriesId: uuid("series_id"),
	userId: uuid("user_id"),
	adminId: uuid("admin_id"),
	instrumentId: uuid("instrument_id").notNull(),
	timeRange: tstzrange("time_range").notNull(),
	reservationType: text("reservation_type").notNull(),
	feeSnapshot: numeric("fee_snapshot"),
	status: text().default('pending').notNull(),
	rejectionReason: text("rejection_reason"),
	paymentScreenshotUrl: text("payment_screenshot_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	serviceName: text("service_name").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.seriesId],
			foreignColumns: [reservationSeries.id],
			name: "reservations_series_id_reservation_series_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "reservations_user_id_users_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [admins.id],
			name: "reservations_admin_id_admins_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.instrumentId],
			foreignColumns: [instruments.id],
			name: "reservations_instrument_id_instruments_id_fk"
		}).onDelete("cascade"),
	check("reservation_type_check", sql`reservation_type = ANY (ARRAY['in_church'::text, 'outside_church'::text])`),
	check("status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'auto_rejected'::text, 'cancelled'::text, 'ongoing'::text, 'completed'::text])`),
]);

export const failedLoginAttempts = pgTable("failed_login_attempts", {
	email: text().notNull(),
	consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
	lockedUntil: timestamp("locked_until", { withTimezone: true, mode: 'string' }),
	lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const paymentSettings = pgTable("payment_settings", {
	id: uuid().defaultRandom().notNull(),
	instapayNumber: text("instapay_number"),
	instapayLink: text("instapay_link"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().notNull(),
	userId: uuid("user_id"),
	type: text().notNull(),
	message: text().notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	reservationId: uuid("reservation_id"),
	adminId: uuid("admin_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.reservationId],
			foreignColumns: [reservations.id],
			name: "notifications_reservation_id_reservations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [admins.id],
			name: "notifications_admin_id_admins_id_fk"
		}).onDelete("cascade"),
]);

export const messages = pgTable("messages", {
	id: uuid().defaultRandom().notNull(),
	reservationId: uuid("reservation_id").notNull(),
	adminId: uuid("admin_id"),
	userId: uuid("user_id"),
	senderRole: text("sender_role").default('admin').notNull(),
	senderName: text("sender_name"),
	content: text().notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.reservationId],
			foreignColumns: [reservations.id],
			name: "messages_reservation_id_reservations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [admins.id],
			name: "messages_admin_id_admins_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "messages_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const hardLimits = pgTable("hard_limits", {
	id: uuid().defaultRandom().notNull(),
	maxActiveReservations: integer("max_active_reservations").default(5).notNull(),
	maxReservationsPerDay: integer("max_reservations_per_day").default(5).notNull(),
	maxDurationHours: integer("max_duration_hours").default(5).notNull(),
	maxConcurrentPerType: integer("max_concurrent_per_type").default(2).notNull(),
	maxSeriesOccurrences: integer("max_series_occurrences").default(8).notNull(),
	maxSubmissionsPerHour: integer("max_submissions_per_hour").default(10).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	bypassHardLimits: boolean("bypass_hard_limits").default(false).notNull(),
});

export const trustedStatusAuditLog = pgTable("trusted_status_audit_log", {
	id: uuid().defaultRandom().notNull(),
	targetUserId: uuid("target_user_id").notNull(),
	grantedByAdminId: uuid("granted_by_admin_id").notNull(),
	action: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.targetUserId],
			foreignColumns: [users.id],
			name: "trusted_status_audit_log_target_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.grantedByAdminId],
			foreignColumns: [admins.id],
			name: "trusted_status_audit_log_granted_by_admin_id_admins_id_fk"
		}).onDelete("cascade"),
	check("audit_action_check", sql`action = ANY (ARRAY['granted'::text, 'revoked'::text])`),
]);

export const notificationSettings = pgTable("notification_settings", {
	id: uuid().defaultRandom().notNull(),
	muteAccountApprovalEmails: boolean("mute_account_approval_emails").default(false).notNull(),
	muteReservationRequestEmails: boolean("mute_reservation_request_emails").default(false).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const passwordResetOtps = pgTable("password_reset_otps", {
	id: uuid().defaultRandom().notNull(),
	email: text().notNull(),
	otpHash: text("otp_hash").notNull(),
	attempts: integer().default(0).notNull(),
	verified: boolean().default(false).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	lastRequestedAt: timestamp("last_requested_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lockedUntil: timestamp("locked_until", { withTimezone: true, mode: 'string' }),
	requestCount: integer("request_count").default(1).notNull(),
	windowStartAt: timestamp("window_start_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const roleAuditLog = pgTable("role_audit_log", {
	id: uuid().defaultRandom().notNull(),
	actorAdminId: uuid("actor_admin_id"),
	actorAdminName: text("actor_admin_name"),
	targetEmail: text("target_email").notNull(),
	targetName: text("target_name").notNull(),
	oldRole: text("old_role").notNull(),
	newRole: text("new_role").notNull(),
	action: text().notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});
