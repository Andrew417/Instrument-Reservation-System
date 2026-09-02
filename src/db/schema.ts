import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Custom type for PostgreSQL tstzrange
export const tstzrange = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tstzrange";
  },
});

// 1. Users Table
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique("users_email_key"),
    phoneNumber: text("phone_number").notNull(),
    passwordHash: text("password_hash").notNull(),
    isTrusted: boolean("is_trusted").default(false).notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    approvalStatus: text("approval_status").default("pending").notNull(), // 'pending' | 'approved' | 'rejected'
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "user_approval_status_check",
      sql`${table.approvalStatus} IN ('pending', 'approved', 'rejected')`,
    ),
  ],
);

// 2. Admins Table
export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique("admins_email_key"),
  phoneNumber: text("phone_number").notNull(),
  passwordHash: text("password_hash").notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  role: text("role").default("admin").notNull(),
  approvalStatus: text("approval_status").default("approved").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 3. Instruments Table
export const instruments = pgTable(
  "instruments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    photoUrl: text("photo_url"),
    description: text("description"),
    outsideFeePerDay: numeric("outside_fee_per_day").default("0").notNull(),
    bookingMode: text("booking_mode").notNull(), // 'manual' | 'instant'
    isRemoved: boolean("is_removed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "booking_mode_check",
      sql`${table.bookingMode} IN ('manual', 'instant')`,
    ),
  ],
);

// 4. Reservation Series Table
export const reservationSeries = pgTable(
  "reservation_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    adminId: uuid("admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    instrumentId: uuid("instrument_id")
      .references(() => instruments.id, { onDelete: "cascade" })
      .notNull(),
    patternType: text("pattern_type").notNull(), // 'weekly' | 'custom'
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "pattern_type_check",
      sql`${table.patternType} IN ('weekly', 'custom')`,
    ),
  ],
);

// 5. Reservations Table
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id").references(() => reservationSeries.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    adminId: uuid("admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    instrumentId: uuid("instrument_id")
      .references(() => instruments.id, { onDelete: "cascade" })
      .notNull(),
    serviceName: text("service_name").notNull(),
    timeRange: tstzrange("time_range").notNull(),
    reservationType: text("reservation_type").notNull(), // 'in_church' | 'outside_church'
    feeSnapshot: numeric("fee_snapshot"),
    status: text("status").default("pending").notNull(), // 'pending' | 'approved' | 'rejected' | 'auto_rejected' | 'cancelled' | 'ongoing' | 'completed'
    rejectionReason: text("rejection_reason"),
    paymentScreenshotUrl: text("payment_screenshot_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "reservation_type_check",
      sql`${table.reservationType} IN ('in_church', 'outside_church')`,
    ),
    check(
      "status_check",
      sql`${table.status} IN ('pending','approved','rejected','auto_rejected','cancelled','ongoing','completed')`,
    ),
  ],
);

// 6. Messages Table
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  reservationId: uuid("reservation_id")
    .references(() => reservations.id, { onDelete: "cascade" })
    .notNull(),
  adminId: uuid("admin_id")
    .references(() => admins.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 7. Notifications Table
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  adminId: uuid("admin_id").references(() => admins.id, {
    onDelete: "cascade",
  }),
  reservationId: uuid("reservation_id").references(() => reservations.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
// 8. Hard Limits Table (Single row, editable by super admin only)
export const hardLimits = pgTable("hard_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  maxActiveReservations: integer("max_active_reservations")
    .default(5)
    .notNull(),
  maxReservationsPerDay: integer("max_reservations_per_day")
    .default(5)
    .notNull(),
  maxDurationHours: integer("max_duration_hours").default(5).notNull(),
  maxConcurrentPerType: integer("max_concurrent_per_type").default(2).notNull(),
  maxSeriesOccurrences: integer("max_series_occurrences").default(8).notNull(),
  showPolicyExplainerToUsers: boolean("show_policy_explainer_to_users")
    .default(true)
    .notNull(),
  maxSubmissionsPerHour: integer("max_submissions_per_hour")
    .default(10)
    .notNull(),
  bypassHardLimits: boolean("bypass_hard_limits").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 9. Payment Settings Table (Single row, super admin only)
export const paymentSettings = pgTable("payment_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  instapayNumber: text("instapay_number"),
  instapayLink: text("instapay_link"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const notificationSettings = pgTable("notification_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  muteAccountApprovalEmails: boolean("mute_account_approval_emails")
    .default(false)
    .notNull(),
  muteReservationRequestEmails: boolean("mute_reservation_request_emails")
    .default(false)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 10. Trusted Status Audit Log Table
export const trustedStatusAuditLog = pgTable(
  "trusted_status_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetUserId: uuid("target_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    grantedByAdminId: uuid("granted_by_admin_id")
      .references(() => admins.id, { onDelete: "cascade" })
      .notNull(),
    action: text("action").notNull(), // 'granted' | 'revoked'
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("audit_action_check", sql`${table.action} IN ('granted', 'revoked')`),
  ],
);

// 11. Failed Login Attempts Table
export const failedLoginAttempts = pgTable("failed_login_attempts", {
  email: text("email").primaryKey(),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 12. Sessions Table (Custom Server-Side Session Store with Inactivity Expiry)
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  adminId: uuid("admin_id").references(() => admins.id, {
    onDelete: "cascade",
  }),
  role: text("role").notNull(), // 'user' | 'admin' | 'super_admin'
  lastActiveAt: timestamp("last_active_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 13. Password Reset OTPs Table (Email OTP Reset Flow via Gmail SMTP)
export const passwordResetOtps = pgTable("password_reset_otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique("password_reset_otps_email_key"),
  otpHash: text("otp_hash").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  verified: boolean("verified").default(false).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  requestCount: integer("request_count").default(1).notNull(),
  windowStartAt: timestamp("window_start_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastRequestedAt: timestamp("last_requested_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 14. Role Audit Log Table (For tracking Super Admin promote/demote/delete actions)
export const roleAuditLog = pgTable("role_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorAdminId: uuid("actor_admin_id"),
  actorAdminName: text("actor_admin_name"),
  targetEmail: text("target_email").notNull(),
  targetName: text("target_name").notNull(),
  oldRole: text("old_role").notNull(), // 'user' | 'admin' | 'super_admin'
  newRole: text("new_role").notNull(), // 'user' | 'admin' | 'super_admin' | 'deleted'
  action: text("action").notNull(), // 'promote' | 'demote' | 'delete'
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  reservations: many(reservations),
  series: many(reservationSeries),
  notifications: many(notifications),
  auditLogs: many(trustedStatusAuditLog),
}));

export const adminsRelations = relations(admins, ({ many }) => ({
  reservations: many(reservations),
  series: many(reservationSeries),
  messages: many(messages),
  grantedAudits: many(trustedStatusAuditLog),
}));

export const instrumentsRelations = relations(instruments, ({ many }) => ({
  reservations: many(reservations),
  series: many(reservationSeries),
}));

export const reservationSeriesRelations = relations(
  reservationSeries,
  ({ one, many }) => ({
    user: one(users, {
      fields: [reservationSeries.userId],
      references: [users.id],
    }),
    admin: one(admins, {
      fields: [reservationSeries.adminId],
      references: [admins.id],
    }),
    instrument: one(instruments, {
      fields: [reservationSeries.instrumentId],
      references: [instruments.id],
    }),
    reservations: many(reservations),
  }),
);

export const reservationsRelations = relations(
  reservations,
  ({ one, many }) => ({
    series: one(reservationSeries, {
      fields: [reservations.seriesId],
      references: [reservationSeries.id],
    }),
    user: one(users, { fields: [reservations.userId], references: [users.id] }),
    admin: one(admins, {
      fields: [reservations.adminId],
      references: [admins.id],
    }),
    instrument: one(instruments, {
      fields: [reservations.instrumentId],
      references: [instruments.id],
    }),
    messages: many(messages),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  reservation: one(reservations, {
    fields: [messages.reservationId],
    references: [reservations.id],
  }),
  admin: one(admins, { fields: [messages.adminId], references: [admins.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const trustedStatusAuditLogRelations = relations(
  trustedStatusAuditLog,
  ({ one }) => ({
    targetUser: one(users, {
      fields: [trustedStatusAuditLog.targetUserId],
      references: [users.id],
    }),
    grantedByAdmin: one(admins, {
      fields: [trustedStatusAuditLog.grantedByAdminId],
      references: [admins.id],
    }),
  }),
);
