import { relations } from "drizzle-orm/relations";
import { users, sessions, admins, reservationSeries, instruments, reservations, notifications, messages, trustedStatusAuditLog } from "./schema";

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
	admin: one(admins, {
		fields: [sessions.adminId],
		references: [admins.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	sessions: many(sessions),
	reservationSeries: many(reservationSeries),
	reservations: many(reservations),
	notifications: many(notifications),
	trustedStatusAuditLogs: many(trustedStatusAuditLog),
}));

export const adminsRelations = relations(admins, ({many}) => ({
	sessions: many(sessions),
	reservationSeries: many(reservationSeries),
	reservations: many(reservations),
	notifications: many(notifications),
	messages: many(messages),
	trustedStatusAuditLogs: many(trustedStatusAuditLog),
}));

export const reservationSeriesRelations = relations(reservationSeries, ({one, many}) => ({
	user: one(users, {
		fields: [reservationSeries.userId],
		references: [users.id]
	}),
	admin: one(admins, {
		fields: [reservationSeries.adminId],
		references: [admins.id]
	}),
	instrument: one(instruments, {
		fields: [reservationSeries.instrumentId],
		references: [instruments.id]
	}),
	reservations: many(reservations),
}));

export const instrumentsRelations = relations(instruments, ({many}) => ({
	reservationSeries: many(reservationSeries),
	reservations: many(reservations),
}));

export const reservationsRelations = relations(reservations, ({one, many}) => ({
	reservationSery: one(reservationSeries, {
		fields: [reservations.seriesId],
		references: [reservationSeries.id]
	}),
	user: one(users, {
		fields: [reservations.userId],
		references: [users.id]
	}),
	admin: one(admins, {
		fields: [reservations.adminId],
		references: [admins.id]
	}),
	instrument: one(instruments, {
		fields: [reservations.instrumentId],
		references: [instruments.id]
	}),
	notifications: many(notifications),
	messages: many(messages),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
	reservation: one(reservations, {
		fields: [notifications.reservationId],
		references: [reservations.id]
	}),
	admin: one(admins, {
		fields: [notifications.adminId],
		references: [admins.id]
	}),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	reservation: one(reservations, {
		fields: [messages.reservationId],
		references: [reservations.id]
	}),
	admin: one(admins, {
		fields: [messages.adminId],
		references: [admins.id]
	}),
}));

export const trustedStatusAuditLogRelations = relations(trustedStatusAuditLog, ({one}) => ({
	user: one(users, {
		fields: [trustedStatusAuditLog.targetUserId],
		references: [users.id]
	}),
	admin: one(admins, {
		fields: [trustedStatusAuditLog.grantedByAdminId],
		references: [admins.id]
	}),
}));