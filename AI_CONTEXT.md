# AI Codebase Signature & Route Index (Generated)

> This auto-generated index contains the signatures, types, and routes of the application without full function bodies. Feed this to AI assistants along with ARCHITECTURE.md.

**Total Files Scanned:** 90

## Components (UI)

### `src/components/AdminPortal.tsx` (417 lines)
```typescript
export interface AdminPortalProps extends UseAdminPortalDataProps {}
export const AdminPortal: React.FC<AdminPortalProps> = (props)
```

### `src/components/AnalyticsTab.tsx` (904 lines)
```typescript
export const AnalyticsTab: React.FC = ()
```

### `src/components/AssignInstrumentModal.tsx` (572 lines)
```typescript
export interface AssignmentOption
export interface AssignInstrumentModalProps
export const AssignInstrumentModal: React.FC<AssignInstrumentModalProps> = (
```

### `src/components/AuthScreen.tsx` (906 lines)
```typescript
export const AuthScreen: React.FC = ()
```

### `src/components/AvailabilityCalendar.tsx` (1210 lines)
```typescript
export interface Instrument
export interface ReservedSlot
export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = (
```

### `src/components/ConditionCheckModal.tsx` (542 lines)
```typescript
export interface ConditionCheckModalProps
export const ConditionCheckModal: React.FC<ConditionCheckModalProps> = (
```

### `src/components/EditReservationModal.tsx` (1705 lines)
```typescript
export interface EditReservationModalProps
export const EditReservationModal: React.FC<EditReservationModalProps> = (
```

### `src/components/ErrorBoundary.tsx` (92 lines)
*No top-level exports or routes detected*

### `src/components/HandoverSheetModal.tsx` (774 lines)
```typescript
export interface HandoverSheetModalProps
export const HandoverSheetModal: React.FC<HandoverSheetModalProps> = (
```

### `src/components/InstrumentDetailModal.tsx` (1303 lines)
```typescript
export interface InstrumentDetailModalProps
export const InstrumentDetailModal: React.FC<InstrumentDetailModalProps> = (
```

### `src/components/LanguageProfileDropdown.tsx` (268 lines)
```typescript
export interface LanguageProfileDropdownProps
export const LanguageProfileDropdown: React.FC<
```

### `src/components/MusicianMinistryProfileModal.tsx` (496 lines)
```typescript
export interface MusicianMinistryProfileModalProps
export const MusicianMinistryProfileModal: React.FC<
```

### `src/components/MyReservations.tsx` (1321 lines)
```typescript
export interface MyReservationsProps
export const MyReservations: React.FC<MyReservationsProps> = (
```

### `src/components/NotificationsModal.tsx` (1441 lines)
```typescript
export interface AppNotification
export interface NotificationsModalProps
export const NotificationsModal: React.FC<NotificationsModalProps> = (
```

### `src/components/PolicyExplainerModal.tsx` (300 lines)
```typescript
export interface PolicyExplainerModalProps
export const PolicyExplainerModal: React.FC<PolicyExplainerModalProps> = (
```

### `src/components/PushNotificationPrompt.tsx` (423 lines)
```typescript
export const PushNotificationPrompt: React.FC = ()
```

### `src/components/QuickRebookCard.tsx` (527 lines)
```typescript
export interface QuickRebookSuggestion
export interface QuickRebookCardProps
export const QuickRebookCard: React.FC<QuickRebookCardProps> = (
```

### `src/components/ReservationDetailModal.tsx` (2527 lines)
```typescript
export interface ReservationDetailModalProps
export const ReservationDetailModal: React.FC<ReservationDetailModalProps> = (
```

### `src/components/ReservationFiltersPopover.tsx` (911 lines)
```typescript
export type ReservationFilterState =
export const EMPTY_FILTER_STATE: ReservationFilterState =
export interface FilterOptions
export const countActiveFilters = (f: ReservationFilterState): number
export const hasActiveFilters = (f: ReservationFilterState): boolean
export const matchesFilters = (
export interface ActiveFiltersBarProps
export const ActiveFiltersBar: React.FC<ActiveFiltersBarProps> = (
export interface ReservationFiltersPopoverProps
export const ReservationFiltersPopover: React.FC<
```

### `src/components/ReservationFormModal.tsx` (1115 lines)
```typescript
export interface SeriesPrefill
export interface ReservationFormProps
export const ReservationFormModal: React.FC<ReservationFormProps> = (
```

### `src/components/ReservationUsageTypeSelector.tsx` (156 lines)
```typescript
export interface ReservationUsageTypeSelectorProps
export const ReservationUsageTypeSelector: React.FC<
```

### `src/components/SeriesBuilderModal.tsx` (1730 lines)
```typescript
export interface OccurrenceItem
export interface SeriesBuilderModalProps
export const SeriesBuilderModal: React.FC<SeriesBuilderModalProps> = (
```

### `src/components/UserDetailModal.tsx` (957 lines)
```typescript
export interface UserDetailModalProps
export const UserDetailModal: React.FC<UserDetailModalProps> = (props)
```

### `src/components/admin/AdminAccountsTab.tsx` (168 lines)
```typescript
export interface AdminAccountItem
export const AdminAccountsTab: React.FC<AdminAccountsTabProps> = (
```

### `src/components/admin/AdminConfirmModal.tsx` (71 lines)
```typescript
export interface ConfirmModalState
export const AdminConfirmModal: React.FC<AdminConfirmModalProps> = (
```

### `src/components/admin/AdminModalsHost.tsx` (141 lines)
```typescript
export interface AdminModalsHostProps
export const AdminModalsHost: React.FC<AdminModalsHostProps> = (
```

### `src/components/admin/AdminStatCards.tsx` (197 lines)
```typescript
export interface AdminStatCardsProps
export const AdminStatCards: React.FC<AdminStatCardsProps> = (
```

### `src/components/admin/BookOnBehalfModal.tsx` (83 lines)
```typescript
export interface BookOnBehalfUserState
export const BookOnBehalfModal: React.FC<BookOnBehalfModalProps> = (
```

### `src/components/admin/BulkSelectionBottomBar.tsx` (139 lines)
```typescript
export interface BulkSelectionBottomBarProps
export const BulkSelectionBottomBar: React.FC<BulkSelectionBottomBarProps> = (
```

### `src/components/admin/CancelReasonModal.tsx` (142 lines)
```typescript
export interface CancelReasonModalState
export const CancelReasonModal: React.FC<CancelReasonModalProps> = (
```

### `src/components/admin/DeleteInstrumentModal.tsx` (148 lines)
```typescript
export const DeleteInstrumentModal: React.FC<DeleteInstrumentModalProps> = (
```

### `src/components/admin/HardLimitsTab.tsx` (343 lines)
```typescript
export interface HardLimitsFormState
export const HardLimitsTab: React.FC<HardLimitsTabProps> = (
```

### `src/components/admin/InstrumentFormModal.tsx` (454 lines)
```typescript
export interface InstrumentFormState
export const InstrumentFormModal: React.FC<InstrumentFormModalProps> = (
```

### `src/components/admin/NewAdminModal.tsx` (189 lines)
```typescript
export interface NewAdminFormState
export const NewAdminModal: React.FC<NewAdminModalProps> = (
```

### `src/components/admin/NotificationSettingsTab.tsx` (341 lines)
```typescript
export interface AdminPushPreferences
export interface NotificationSettingsState
export const NotificationSettingsTab: React.FC<NotificationSettingsTabProps> = (
```

### `src/components/admin/PaymentSettingsTab.tsx` (88 lines)
```typescript
export interface PaymentSettingsState
export const PaymentSettingsTab: React.FC<PaymentSettingsTabProps> = (
```

### `src/components/admin/PromoteUserModal.tsx` (134 lines)
```typescript
export interface PromoteModalState
export const PromoteUserModal: React.FC<PromoteUserModalProps> = (
```

### `src/components/admin/RejectReasonModal.tsx` (202 lines)
```typescript
export interface RejectModalState
export const RejectReasonModal: React.FC<RejectReasonModalProps> = (
```

### `src/components/admin/RetireInstrumentModal.tsx` (96 lines)
```typescript
export interface RetireInstrumentItem
export const RetireInstrumentModal: React.FC<RetireInstrumentModalProps> = (
```

### `src/components/admin/TrustedStatusTab.tsx` (181 lines)
```typescript
export interface TrustedStatusAuditLogItem
export const TrustedStatusTab: React.FC<TrustedStatusTabProps> = (
```

### `src/components/admin/tabs/ApprovalsTab.tsx` (564 lines)
```typescript
export interface ApprovalsTabProps
export const ApprovalsTab: React.FC<ApprovalsTabProps> = (
```

### `src/components/admin/tabs/DashboardTab.tsx` (378 lines)
```typescript
export interface DashboardTabProps
export const DashboardTab: React.FC<DashboardTabProps> = (
```

### `src/components/admin/tabs/InstrumentsTab.tsx` (227 lines)
```typescript
export interface InstrumentsTabProps
export const InstrumentsTab: React.FC<InstrumentsTabProps> = (
```

### `src/components/admin/tabs/MessagingTab.tsx` (217 lines)
```typescript
export interface MessagingTabProps
export const MessagingTab: React.FC<MessagingTabProps> = (
```

### `src/components/admin/tabs/ReviewTab.tsx` (964 lines)
```typescript
export interface ReviewTabProps
export const ReviewTab: React.FC<ReviewTabProps> = (
```

### `src/components/admin/tabs/UsersTab.tsx` (263 lines)
```typescript
export interface UsersTabProps
export const UsersTab: React.FC<UsersTabProps> = (
```

### `src/components/admin/useAdminPortalData.ts` (1894 lines)
```typescript
export type AdminTab =
export interface UseAdminPortalDataProps
export const ADMIN_TABS_EVENT = "admin-tabs:update";
export function useAdminPortalData(
```

### `src/components/shared/EmptyStateCard.tsx` (37 lines)
```typescript
export interface EmptyStateCardProps
export const EmptyStateCard: React.FC<EmptyStateCardProps> = (
```

### `src/components/shared/LoadingSpinner.tsx` (54 lines)
```typescript
export interface LoadingSpinnerProps
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = (
```

### `src/components/shared/ModalActionButtons.tsx` (76 lines)
```typescript
export interface ModalActionButtonsProps
export const ModalActionButtons: React.FC<ModalActionButtonsProps> = (
```

### `src/components/shared/ModalShell.tsx` (108 lines)
```typescript
export interface ModalShellProps
export const ModalShell: React.FC<ModalShellProps> = (
```

### `src/components/shared/ReservationStatusBadge.tsx` (44 lines)
```typescript
export interface ReservationStatusBadgeProps
export const ReservationStatusBadge: React.FC<ReservationStatusBadgeProps> = (
```

## Server Routes (API)

### `src/server/admin.ts` (3559 lines)
```typescript
Route: GET /analytics
Route: GET /users
Route: GET /approvals
```

### `src/server/auth.ts` (1042 lines)
```typescript
Route: POST /register
Route: POST /login
Route: GET /me
Route: POST /logout
```

### `src/server/instruments.ts` (552 lines)
```typescript
export async function ensureSampleInstruments(): Promise<void>
Route: GET /
Route: GET /:id
Route: PUT /:id/mode
```

### `src/server/notifications.ts` (140 lines)
```typescript
Route: GET /
Route: POST /:id/read
```

### `src/server/push.ts` (315 lines)
```typescript
Route: GET /public-key
Route: POST /subscribe
Route: POST /unsubscribe
Route: POST /test
Route: GET /preferences
Route: POST /preferences
```

### `src/server/reservations.ts` (1893 lines)
```typescript
Route: GET /limits
export function getMaskedInstrumentName(type?: string | null): string
Route: POST /evaluate
Route: POST /series
Route: POST /
Route: PUT /:id
Route: GET /:id
Route: GET /
```

### `src/server/session-manager.ts` (310 lines)
```typescript
export interface SessionUser
export interface ActiveSession
export function generateSessionToken(): string
export async function createSession(
export async function validateSession(
export async function destroySession(token: string): Promise<void>
export async function requireAuth(
export async function withUserContext<T>(
```

## Services & Business Logic

### `src/services/reservation-logic.ts` (3277 lines)
```typescript
export interface TimeSlot
export interface ReservationSubmissionInput
export interface SeriesSubmissionInput
export interface EvaluationResult
export function getMaskedInstrumentName(type?: string | null): string
export function buildTimeRange(
export function validateWorkingHours(start: Date, end: Date)
export async function getNotificationSettings()
export async function getHardLimits()
export function toNullableString(val: any): string | null
export async function resolveUserAndAdminIds(
export async function evaluateReservationSubmission(
export async function autoRejectOverlappingPending(
export async function createReservation(input: ReservationSubmissionInput)
export async function createReservationSeries(input: SeriesSubmissionInput)
// ... +19 more signatures
```

## Utilities & Lib

### `src/lib/auth-helpers.ts` (76 lines)
```typescript
export function normalizeEmail(email: string): string
export function isValidEmail(email: string): boolean
export function normalizePhoneNumber(rawPhone: string): string
export function phoneToPseudoEmail(rawPhone: string): string
export function getAuthSessionToken(explicitToken?: string | null): string | null
export async function adminFetch(
```

### `src/lib/date-utils.ts` (282 lines)
```typescript
export function isConditionCheckWindowOpen(
export function isNoShowWindowOpen(
export function getCairoParts(dateInput: Date | string | number | null | undefined = new Date())
export function getCairoDateString(date: Date | string | number | null | undefined = new Date()): string
export function getCairoTimeString(date: Date | string | number | null | undefined = new Date()): string
export function formatCairoDateTime(date: Date | string | number | null | undefined): string
export function cairoDateTimeToDate(dateStr: string, timeStr: string): Date
export function getLocalDateString(d: Date = new Date()): string
export function getTodayDateString(): string
export function parseLocalDate(dateStr: string): Date
export function addDaysToDateString(dateStr: string, days: number): string
export function formatDisplayDate(dateStr: string, locale?: string): string
export function formatHhmmTo12Hour(hhmm: string, locale?: string): string
export function shiftDateToWeekday(dateStr: string, targetWeekday: number): string
export function isFullDayReservation(
// ... +2 more signatures
```

### `src/lib/email.ts` (106 lines)
```typescript
export async function sendOtpEmail(
```

### `src/lib/firebase.ts` (17 lines)
```typescript
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
```

### `src/lib/handover-export.ts` (444 lines)
```typescript
export type HandoverExportFormat = "csv" | "xlsx" | "pdf";
export interface HandoverReservationItem
export function formatHandoverDate(iso: string | null | undefined): string
export function escapeCsvCell(val: any): string
export function getHandoverFileName(
export async function fetchHandoverReservations(
export function buildHandoverCsvContent(
export function downloadHandoverCsv(
export async function downloadHandoverXlsx(
export async function downloadHandoverExport(
```

### `src/lib/handover-templates.ts` (404 lines)
```typescript
export type HandoverLocale = "ar" | "en";
export interface HandoverTemplateOptions
export function buildHandoverWhatsAppMessage(
export async function shareHandoverMessage(
export function buildHandoverWhatsAppUrl(
export function buildHandoverPrintHtml(
export function printHandoverSheet(
```

### `src/lib/hard-limits.ts` (73 lines)
```typescript
export type HardLimitsState =
export function normalizeHardLimitsState(limits: any): HardLimitsState
export function buildHardLimitsPayload(state: any)
```

### `src/lib/i18n.ts` (53 lines)
*No top-level exports or routes detected*

### `src/lib/mailer.ts` (1144 lines)
```typescript
export async function sendOtpEmail(
export interface AccountApprovedEmailData
export async function sendAccountApprovedEmail(
export interface ReservationApprovedEmailData
export async function sendReservationApprovedEmail(
export interface ReservationRejectedEmailData
export async function sendReservationRejectedEmail(
export async function sendSuperAdminNotificationEmail(
export interface ReservationPaidEmailData
export async function sendReservationPaidEmail(
export interface NewMessageToMemberEmailData
export async function sendNewMessageToMemberEmail(
export interface NewMessageToAdminsEmailData
export async function sendNewMessageToAdminsEmail(
```

### `src/lib/push-client.ts` (251 lines)
```typescript
export function isPushSupported(): boolean
export function isInAppBrowser(): boolean
export function isIOS(): boolean
export function isIOSStandalone(): boolean
export function getNotificationPermission(): NotificationPermission | "unsupported"
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null>
export async function getCurrentSubscription(): Promise<PushSubscription | null>
export async function subscribeToPush(
export async function unsubscribeFromPush(sessionToken?: string | null): Promise<boolean>
export async function sendTestNotification(
export async function resyncPushSubscriptionOnLogin(
```

### `src/lib/push-service.ts` (295 lines)
```typescript
export interface PushNotificationPayload
export type AdminNotificationCategory =
export function safeWaitUntil(task: Promise<any>): void
export async function sendPushToUser(
export async function sendPushToAdmins(
export async function sendTestPushToSubscription(
```

### `src/lib/push-vapid.ts` (94 lines)
```typescript
export function isPushConfigured(): boolean
export function getVapidKeys(): VapidKeys | null
export function getVapidPublicKey(): string
```

### `src/lib/reservant-colors.ts` (200 lines)
```typescript
export interface ReservantColorTheme
export const RESERVANT_COLOR_PALETTES: ReservantColorTheme[] = [
export function getReservantColorTheme(reservantKey?: string | null): ReservantColorTheme
```

### `src/lib/reservation-owner.ts` (18 lines)
```typescript
export interface OnBehalfOf
export const buildOwnerPayload = (
```

### `src/lib/status-colors.ts` (29 lines)
```typescript
export const RESERVATION_STATUS_COLORS: Record<string, string> =
export const getStatusColor = (status: string)
export const RESERVATION_TYPE_COLORS: Record<string, string> =
export const getReservationTypeColor = (type: string)
```

## Database & Schema

### `src/db/drizzle.config.local.ts` (19 lines)
*No top-level exports or routes detected*

### `src/db/drizzle.config.prod.ts` (33 lines)
*No top-level exports or routes detected*

### `src/db/drizzle.config.ts` (27 lines)
*No top-level exports or routes detected*

### `src/db/index.ts` (176 lines)
```typescript
export const createPool = ()
export const pool = createPool();
export const db = drizzle(pool,
export async function withRetry<T>(
export async function ensureEnhancedColumns(): Promise<void>
export async function ensurePushTables(): Promise<void>
```

### `src/db/schema.ts` (485 lines)
```typescript
export const tstzrange = customType<
export const users = pgTable(
export const admins = pgTable(
export const instruments = pgTable(
export const reservationSeries = pgTable(
export const reservations = pgTable(
export const messages = pgTable("messages",
export const notifications = pgTable("notifications",
export const hardLimits = pgTable("hard_limits",
export const paymentSettings = pgTable("payment_settings",
export const notificationSettings = pgTable("notification_settings",
export const trustedStatusAuditLog = pgTable(
export const failedLoginAttempts = pgTable("failed_login_attempts",
export const sessions = pgTable("sessions",
export const passwordResetOtps = pgTable(
// ... +11 more signatures
```

### `src/db/seed-super-admin.ts` (125 lines)
```typescript
export async function seedSuperAdmin(): Promise<void>
```

## Contexts & Core

### `src/App.tsx` (1520 lines)
*No top-level exports or routes detected*

### `src/contexts/AuthContext.tsx` (403 lines)
```typescript
export interface UserProfile
export const AuthProvider: React.FC<
export const useAuth = ()
```

