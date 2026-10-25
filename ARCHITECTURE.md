# Church Instrument Reservation Platform — System Architecture & Context Map

> **Vibe Coder Instructions:** Paste this entire document into your AI prompt context to give the model a complete understanding of the project's structure, schemas, business rules, and conventions without wasting tokens pasting raw source files.

---

## 1. Tech Stack & Environment
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4 (`@import "tailwindcss";`), Lucide React icons, Motion.
- **Backend:** Node.js, Express 4.x, TypeScript (`tsx server.ts`), PostgreSQL (pg Pool).
- **ORM & Migrations:** Drizzle ORM (`drizzle-orm`, `drizzle-kit`), declarative SQL migrations in `/drizzle/`.
- **Localization:** `i18next` + `react-i18next` (`/src/locales/ar.json`, `/src/locales/en.json`), default Arabic (`dir="rtl"`).
- **Timezone:** Strict Cairo Time (`Africa/Cairo`, UTC+2 / UTC+3 DST) via `/src/lib/date-utils.ts`.
- **Notifications:** Web Push API (VAPID, Service Worker `/public/sw.js`), Gmail SMTP (`nodemailer`).
- **Exports:** ExcelJS for key-holder sheets (XLSX/CSV/Print), Web Share API / WhatsApp Web URLs.

---

## 2. Directory Tree & File Purpose Index

```
/
├── server.ts                             # Main server entry: Express + Vite middleware / dist static
├── scripts/
│   └── generate-ai-context.ts                # Auto-scans /src and generates AI_CONTEXT.md signature & route index
├── src/
│   ├── server-app.ts                         # Express app factory: middleware, /api/* routers, 404 & error handlers
│   ├── main.tsx                              # Client entry: React DOM root & strict render
│   ├── App.tsx                               # Master client layout: navigation header, modals host, view routing
│   │
│   ├── components/
│   │   ├── AdminPortal.tsx                   # Admin operations: tabs (Needs Attention, Overview, Approvals, Instruments, Users, Messages, SuperAdmin)
│   │   ├── AnalyticsTab.tsx                  # Graphical analytics & charts (Recharts) for admin overview
│   │   ├── AssignInstrumentModal.tsx         # Admin modal: candidate assignment & reassignment with smart sorting (Room Stock -> Musician -> Public)
│   │   ├── AuthScreen.tsx                    # Auth view: Login, Register, Forgot Password with Email OTP
│   │   ├── AvailabilityCalendar.tsx          # Master timetable: interactive slots, role-based visibility, out-of-service states, quick re-book host
│   │   ├── ConditionCheckModal.tsx           # Pre-handover equipment condition inspection: Inspector name upfront, status, quick tags, notes, photo evidence & sticky action bar
│   │   ├── EditReservationModal.tsx          # Member/Admin reservation edit modal (slot, time, instrument)
│   │   ├── ErrorBoundary.tsx                 # React error boundary preventing blank screen crashes
│   │   ├── HandoverSheetModal.tsx            # Key-holder handover export (XLSX, CSV, Print, WhatsApp broadcast)
│   │   ├── InstrumentDetailModal.tsx         # Instrument catalog view: specs, photo, pricing, booking trigger
│   │   ├── LanguageProfileDropdown.tsx       # Header dropdown: language toggle (AR/EN) & user profile links
│   │   ├── MusicianMinistryProfileModal.tsx  # Musician ministry stats, service badges, Psalm 150:4, WhatsApp card
│   │   ├── MyReservations.tsx                # Member portal: Active/Past bookings, responsive header, cancellation, type request status, payment receipt upload
│   │   ├── NotificationsModal.tsx            # Bell notification dropdown modal with inline approve/reject
│   │   ├── PolicyExplainerModal.tsx          # Senior-friendly 3-step Arabic guide ("كيف تحجز؟") with streamlined compact footer
│   │   ├── PushNotificationPrompt.tsx        # Native browser push notification permission & subscription prompt
│   │   ├── QuickRebookCard.tsx               # 1-Tap routine service re-booking card ("The WhatsApp Killer")
│   │   ├── ReservationDetailModal.tsx        # Unified reservation sheet: metadata, type request indicator, chat tab, condition checks, Instapay
│   │   ├── ReservationFiltersPopover.tsx     # Timetable filter popover: instrument type, date range, status
│   │   ├── ReservationFormModal.tsx          # Single-slot & Band Pack form: Direct booking vs Category Type Request switcher, 2-column grid, outside flat fee acknowledgment
│   │   ├── ReservationUsageTypeSelector.tsx  # In-church (free) vs Outside-church (paid) selector with fee notice
│   │   ├── SeriesBuilderModal.tsx            # Recurring weekly / custom date series builder with type request support & conflict skip
│   │   ├── UserDetailModal.tsx               # Admin user profile modal: active bookings, no-show counters, Super Admin Musician toggle, role actions
│   │   └── admin/                            # Modular sub-components extracted from AdminPortal
│   │       ├── useAdminPortalData.ts         # Controller hook: approvals filtering (pending/approved/rejected/all), live search, musician audit logs, pre-formatted reject/assign state
│   │       ├── AdminAccountsTab.tsx          # Super Admin: Admin accounts list, create, promote, demote, delete
│   │       ├── AdminConfirmModal.tsx         # Reusable confirm dialog (destructive/amber actions)
│   │       ├── BookOnBehalfModal.tsx         # Admin modal: book and auto-approve on behalf of church member
│   │       ├── CancelReasonModal.tsx         # Bulk cancellation modal with presets & custom reason
│   │       ├── DeleteInstrumentModal.tsx     # Permanent instrument deletion confirmation dialog
│   │       ├── HardLimitsTab.tsx             # Super Admin: System reservation limits editor with help explainers
│   │       ├── InstrumentFormModal.tsx       # Add/Edit instrument modal with visibility level selector & out-of-service toggle
│   │       ├── NewAdminModal.tsx             # Provision administrator account modal with password toggle
│   │       ├── NotificationSettingsTab.tsx   # Super Admin: Push notification subscriptions & email mutes
│   │       ├── PaymentSettingsTab.tsx        # Super Admin: Instapay number & payment link settings
│   │       ├── PromoteUserModal.tsx          # Promote member to Admin/Super Admin or toggle Church Musician status modal
│   │       ├── RejectReasonModal.tsx         # Rejection dialog with single vs. series scope toggle and pre-formatted slot metadata
│   │       ├── RetireInstrumentModal.tsx     # Mark instrument Not Available (archive from booking)
│   │       └── TrustedStatusTab.tsx          # Super Admin: Dual sub-tab audit logs for Trusted Status and Musician Status with multi-column sorting
│   │
│   ├── server/
│   │   ├── admin.ts                          # /api/admin: stats, users, approvals with status filter, instruments CRUD, limits, payment, push prefs
│   │   ├── auth.ts                           # /api/auth: login, register, logout, OTP reset, me
│   │   ├── instruments.ts                    # /api/instruments: public/catalog listings and availability slots
│   │   ├── notifications.ts                  # /api/notifications: in-app notification list, mark read, unread counts
│   │   ├── push.ts                           # /api/push: VAPID public key, subscribe/unsubscribe, test notifications
│   │   ├── reservations.ts                   # /api/reservations: submit, edit, cancel, band pack, quick rebook, chat
│   │   └── session-manager.ts                # Server-side DB sessions with inactivity sliding-window expiry
│   │
│   ├── services/
│   │   └── reservation-logic.ts              # Core engine: conflict detection, limits check, status transitions, notifications
│   │
│   ├── lib/
│   │   ├── auth-helpers.ts                   # Client session storage, token retrieval, adminFetch API wrapper
│   │   ├── date-utils.ts                     # Cairo timezone math: getCairoParts, formatCairoDateTime, slot overlaps
│   │   ├── email.ts / mailer.ts              # Gmail SMTP transport: approval, rejection, chat & OTP email dispatch
│   │   ├── handover-export.ts                # ExcelJS generation & styling for key-holder handover sheets
│   │   ├── handover-templates.ts             # WhatsApp message formatter with directional Unicode isolation
│   │   ├── hard-limits.ts                    # Client limit parsing and payload normalization
│   │   ├── i18n.ts                           # i18next configuration, RTL/LTR body direction controller
│   │   ├── push-client.ts                    # Browser PushManager subscription & service worker registration
│   │   ├── push-service.ts                   # Web-push server payload delivery with dead subscription cleanup
│   │   ├── push-vapid.ts                     # VAPID keys loader and WebPush initialization
│   │   ├── reservant-colors.ts               # Dynamic deterministic color hashing for calendar reservation blocks
│   │   └── status-colors.ts                  # Status badges (pending, approved, rejected, cancelled, ongoing)
│   │
│   ├── db/
│   │   ├── index.ts                          # PostgreSQL pg.Pool connection, Drizzle instance & withRetry<T> transaction wrapper
│   │   ├── schema.ts                         # Master PostgreSQL schema: tables, enums, relations, check constraints
│   │   └── seed-super-admin.ts               # Idempotent super admin seed script
│   │
│   └── locales/
│       ├── ar.json                           # Comprehensive Arabic translations
│       └── en.json                           # English translations
```

---

## 3. Data Flow Architecture

```
[User / Admin UI Action]
        │
        ▼
[Component State / Modal] (e.g. ReservationFormModal / QuickRebookCard)
        │
        ▼
[HTTP Client Fetch] (passes Bearer Session Token in Authorization header)
        │
        ▼
[Express Server (/api/*)] (routes in src/server/*.ts with sessionAuth middleware)
        │
        ▼
[Business Services] (src/services/reservation-logic.ts)
  ├── 1. Conflict Scan: Check PostgreSQL tstzrange overlaps against APPROVED slots
  ├── 2. Role / Trust Check: Trusted Users & Admins bypass booking mode & limits
  ├── 3. Mode Evaluation: Instant instrument -> Approved | Manual instrument -> Pending
  ├── 4. Limits Evaluation: Soft limits (1-4) -> Downgrade to Pending | Hard limits (5-6) -> Reject
  └── 5. Side Effects: Web Push dispatch + Gmail SMTP emails + In-app bell notifications
        │
        ▼
[Drizzle ORM & PostgreSQL DB] (Atomic transactions & queries)
```

---

## 4. Key Database Tables & Enums (`src/db/schema.ts`)

| Table | Primary Purpose | Critical Columns & Enums |
|---|---|---|
| `users` | Church members / musicians | `id`, `name`, `email`, `phoneNumber`, `passwordHash`, `isTrusted` (bool), `isMusician` (bool), `approvalStatus` (`pending`\|`approved`\|`rejected`), `isActive` |
| `admins` | Church administrators | `id`, `name`, `email`, `phoneNumber`, `passwordHash`, `isSuperAdmin` (bool), `role` (`admin`), `approvalStatus` |
| `instruments` | Individual physical musical gear | `id`, `name`, `type` (e.g. Drums, Keyboard), `photoUrl`, `outsideFeePerDay`, `bookingMode` (`manual`\|`instant`), `visibilityLevel` (`public`\|`musician`\|`room_stock`), `isOutOfService` (bool), `isRemoved` |
| `instrument_type_settings` | Category requests & flat fee config | `type` (PK), `canBeRequested` (bool), `flatFeeOutside` (numeric), `updatedAt` |
| `reservations` | Individual booked slots & type requests | `id`, `seriesId`, `userId`, `adminId`, `instrumentId` (nullable for unassigned type requests), `isTypeRequest` (bool), `requestedType` (text), `serviceName`, `musicianName`, `timeRange` (`tstzrange`), `reservationType` (`in_church`\|`outside_church`), `feeSnapshot`, `status` (`pending`\|`approved`\|`rejected`\|`auto_rejected`\|`cancelled`\|`ongoing`\|`completed`\|`expired`), `rejectionReason`, `cancellationReason`, `bandPackId`, `conditionStatus`, `paymentScreenshotUrl`, `isNoShow` |
| `reservation_series` | Recurring series header | `id`, `userId`, `adminId`, `instrumentId`, `isTypeRequest` (bool), `requestedType` (text), `patternType` (`weekly`\|`custom`), `serviceLocation`, `note` |
| `messages` | Reservation-scoped chat | `id`, `reservationId`, `userId`, `adminId`, `senderRole` (`user`\|`admin`), `senderName`, `content`, `isRead` |
| `notifications` | In-app notification bell | `id`, `userId`, `adminId`, `reservationId`, `type`, `message`, `isRead` |
| `hard_limits` | System fair usage configuration (1 row) | `maxActiveReservations` (5), `maxReservationsPerDay` (5), `maxDurationHours` (5), `maxConcurrentPerType` (2), `maxSeriesOccurrences` (8), `maxSubmissionsPerHour` (10), `bypassHardLimits` (bool) |
| `payment_settings` | Instapay configuration (1 row) | `instapayNumber`, `instapayLink` |
| `push_subscriptions` | Web Push endpoints | `id`, `userId`, `adminId`, `endpoint`, `p256dh`, `auth`, `language` |
| `sessions` | Server-managed auth sessions | `id`, `token`, `userId`, `adminId`, `role` (`user`\|`admin`\|`super_admin`), `lastActiveAt`, `expiresAt` |
| `trusted_status_audit_log` | Super admin audit log for trusted status | `id`, `targetUserId`, `grantedByAdminId`, `action` (`granted`\|`revoked`), `created_at` |
| `musician_status_audit_log` | Super admin audit log for musician status | `id`, `targetUserId`, `grantedByAdminId`, `action` (`granted`\|`revoked`), `created_at` |

---

## 5. Core Business Rules & Invariants

1. **Working Hours & Timezone:** Strictly **9:00 AM – 10:00 PM** Africa/Cairo time. No booking can start before 9 AM or end after 10 PM.
2. **Conflict Invariant:** No user (including Admins and Trusted users) can ever book or overlap an already **Approved** reservation on the same physical instrument.
3. **Instrument Visibility Levels & Access:**
   - `public`: Everyone sees and books directly.
   - `musician`: Visible and bookable directly by Musicians and Admins only. Regular users cannot see them anywhere (filtered at DB query level).
   - `room_stock`: Visible to Admins only. Nobody books directly; admins assign them to type requests.
   - `out_of_service`: Unavailable/broken; cannot be booked or assigned to anyone. Disabled across calendar and forms.
4. **Musician Status (`is_musician`):** Independent boolean flag, separate from `is_trusted`. Only Super Admins can grant or revoke it (via User Profile or Promote modal). Each change is recorded in `musician_status_audit_log`. Musicians book visible instruments directly and do not use type requests.
5. **Category Type Requests:**
   - Regular users can request by category (e.g. "any Keyboard") for enabled types in `instrument_type_settings`.
   - Outside church flat fee is locked at submission time and acknowledged by user.
   - **Always starts in `pending` status** (even for Trusted users), does not occupy calendar slots until assigned.
   - Pending type requests count towards active reservations limits.
   - **Auto-Expiration:** Unassigned type requests whose start time passes are automatically rejected with `"Not assigned before the start time"` and the requester is notified.
6. **Smart Instrument Assignment Engine:**
   - Candidates are prioritized: **1. Room Stock &rarr; 2. Musician &rarr; 3. Public**.
   - Conflicting and Out of Service instruments are disabled with clear reasons.
   - Recurring series: admin can assign one instrument for all occurrences, or approve fitting dates and reject conflicting dates with an explicit reason.
   - Approved reservations can be reassigned to another candidate.
   - Editing date, time, or duration on an approved type request resets its status to `pending` and clears `instrument_id = null`.
7. **Trusted Status (`is_trusted`):** Granted exclusively by Super Admin. Automatically auto-approves reservations on Manual instruments and bypasses limits 1-6. Does NOT bypass approved slot conflicts. Audited in sortable log (`TrustedStatusTab.tsx`).
8. **Instant vs Manual Modes:**
   - *Instant Mode:* Regular user submissions auto-approve if within all limits.
   - *Manual Mode:* Regular user submissions always start in `pending` awaiting admin approval.
9. **Outside Church Use:** Always requires admin review (`pending`), snapshots daily fee upon submission, and enables Instapay screenshot upload.
10. **Hard Limits Structure:**
    - *Soft Caps (1–4):* (Active count, Day count, Max duration, Concurrent same-type) -> Exceeding downgrades status to `pending`, never blocks submission.
    - *Hard Caps (5–6):* (Series occurrence cap, hourly rate limit) -> Exceeding blocks submission with user-facing validation error.
11. **🎸 Band Pack:** Multi-instrument co-booking sharing a `band_pack_id`. Validated atomically (if 1 instrument conflicts, entire pack fails submission). Requires musician name per instrument.
12. **⚡ Quick Re-Book:** Analyzes past 90-day booking history for routine day-of-week/time patterns; presents 1-tap confirmation with Cairo date calculation.
13. **🔑 Key-Holder Handover Sheet:** Chronologically sorted list of approved bookings with Day/Week selector, exported to styled XLSX, CSV, or formatted WhatsApp message using `\u2066` directional Unicode marks for phone numbers.
14. **📸 Pre-Handover Condition Inspection:** Structured flow capturing inspector name upfront, instrument summary, condition status, quick tags, notes, photo evidence, and tamper-evident Cairo timestamp.
15. **🚨 Floating Alert Overlay System:** Form validation and policy limits render as an elevated fixed alert banner (`z-[220]`) with actionable recovery instructions, screen-reader alert attributes, and dismiss button.
16. **🛡️ Transactional Resilience (`withRetry`):** Backend user approval, rejection, and session revocation are wrapped in `withRetry<T>` to guarantee zero orphaned sessions and protect against transient database connection drops.

---

## 6. Development Conventions

- **Auth in Client:** Always use `adminFetch(url, options)` from `src/lib/auth-helpers.ts` which automatically attaches `Authorization: Bearer <token>` and handles 401 redirection.
- **Dates & Times:** Never use `new Date().toISOString()` directly for slot comparisons. Always use helper functions from `src/lib/date-utils.ts` (`getCairoParts`, `cairoDateTimeToDate`, `getCairoDateString`) to prevent local client timezone divergence.
- **Localization:** Wrap all user-facing text with `t('key')` from `useTranslation()`. Ensure bilingual parity in `src/locales/ar.json` and `en.json`.
- **API Boundaries:** All API routes must return JSON (`{ success: true, ... }` or `{ success: false, error: "..." }`). Never let `/api/*` fall through to Vite SPA index.html.
- **AI Context Synchronization:** Keep `AI_CONTEXT.md` up to date by running `npx tsx scripts/generate-ai-context.ts` whenever exports, routes, or signatures change.
