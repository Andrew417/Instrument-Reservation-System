Here's the updated documentation with the new features added:

---

## Booking Core

- **Booking modes** — per-instrument, Instant or Manual. Instant auto-confirms within limits; Manual always requires admin review regardless of limits.
- **Trusted user status** — Super Admin-granted flag; auto-approves regardless of instrument mode or hard limits. Conflict with an approved slot is never bypassed.
- **Admin reservations** — always auto-approved, logged under the admin's own account.
- **Fair usage (hard limits)** — active reservations, per-day count, max duration, same-type concurrency, series occurrence cap, submission rate limit. All admin-editable in Settings; Trusted/Admin bypass all. Most limits downgrade to Pending rather than block; submission rate limit blocks outright.
- **In-church vs outside-church usage type** — in-church is free; outside-church carries a per-day fee, snapshotted at submission (later fee changes don't retroactively apply). Outside-church requests always require admin review and default to Pending status regardless of instrument mode.
- **Outside-church payment flow** — user submits and checks acknowledgment box; after admin review/approval, user can upload an Instapay transfer receipt screenshot via the Reservation Detail modal (with admin ability to view/remove screenshot) or arrange payment via church administration.
- **Recurring series** — Weekly (interval + occurrence count) or Custom (manually picked dates), same time/duration across all occurrences. Real-time conflict detection against existing approved reservations, self-overlap within the series, and working-hours bounds. Includes one-click **"Skip Conflicting Dates"** button to automatically discard conflicting occurrences and switch to custom pattern mode for immediate submission.
- **Editing reservations** — users can edit instrument, date, time, duration. Editing an Approved reservation on a Manual-mode instrument resets it to Pending; editing any outside-church reservation strictly forces status back to Pending for admin re-evaluation. The Edit form shows inline warnings for these resets (skipped for Trusted/Admin).
- **Cancellation** — users cancel their own Pending/Approved reservations (single or entire series); admins cancel immediately, with an optional structured reason.
- **Reservation Detail Modal** — unified view showing reservation purpose, status, requester info (with fallback to admin name for admin-created reservations), instrument specifications, date/time slot, usage type & fee. Includes Conversation & Administration Notes tab with full chat history and inline messaging.

---

## Admin Cancellation Reasons

- Admin-initiated cancellations (single or bulk) can attach a reason: preset dropdown + optional custom "Other" text. Optional — cancellation works without one.
- Only applies to admin-initiated Cancelled status, not Auto-Rejected or user-initiated cancellations.
- Surfaced via bell notification and an amber notice on the Reservation Detail screen.

---

## Rejection Reasons (Admin)

- Quick-select preset reasons for rejecting a pending request, tightened to plain single-cause phrasing:
    - "Time slot already booked"
    - "Reserved for church use"
    - "Instrument under maintenance"
    - "Exceeds booking limits"

---

## Messaging

- **Two-way in-system conversation** — Admin and user can communicate in a conversation thread scoped to a specific reservation.
- **Bi-directional email dispatch (via Gmail SMTP)**:
    - Admin message → automated email sent to the reservation owner's email address with reservation slot context and link to portal.
    - Member reply → automated email sent to all approved administrator emails with sender name, instrument, slot, and quick link to admin portal.
- **On-site bell notifications** — Messages fire on-site bell notifications in addition to the unread badge on the Messages tab.
- **Reservation Detail Chat Tab** — Full conversation view with message history, sender identification (admin/member), timestamps, and quick reply suggestions when a reservation is rejected.

---

## Admin Portal

- Dashboard: total instruments, pending requests, today's reservations, filterable full reservation list.
- **Collapsible Desktop Navigation Sidebar** — Sidebar can be collapsed to an icon rail (`w-20`) or expanded (`w-72`), with user preference saved in local storage. Includes quick-search filtering of admin sections, high-contrast active indicator bars, and full RTL layout support.
- Recurring series shown as a grouped card with Approve All / Reject All, plus individual occurrence actions.
- Bulk reservation actions (cancel/delete selected) with a reason picker for bulk cancellations.
- User management: view, deactivate, reactivate, delete users; grant/revoke Trusted status (Super Admin only, audit-logged).
- Instrument removal: force-remove cancels all future Approved and Pending reservations for that instrument, notifies affected users.
- Role management: promote/demote/delete admins (Super Admin only); Super Admin account protected.
- **Admin Accounts Management** — Super Admin can view all admin accounts, create new admins, demote admins to regular members, or delete admin accounts (protected accounts cannot be deleted).
- **Hard Limits Configuration** — Super Admin can configure all fair usage limits (active reservations, per-day count, max duration, same-type concurrency, series occurrence cap, submission rate limit) with inline help tooltips explaining each limit.
- **Payment Settings** — Super Admin can configure Instapay phone number and direct payment link displayed for outside-church reservations.
- **Notification Settings** — Super Admin can mute/unmute account approval emails and reservation request emails independently.
- **Trusted Status Audit Log** — Super Admin can view a full audit trail of trusted status grants and revocations with timestamps and admin attribution.

---

## Policy Explainer (User-Facing)

- In-app modal designed specifically for older members and users unfamiliar with technology, always presented in simple, welcoming Arabic (`dir="rtl"`).
- Automatically opens as a pop-up after authentication/login on each session to guide users immediately, and remains accessible anytime from the top header ("دليل الحجز (كيف تحجز؟)").
- Plain 3-step visual guide:
    1. **اختر الآلة والموعد من الجدول** — Pick the instrument and desired slot from the calendar or tap "حجز جديد".
    2. **اكتب اسم الخدمة ثم اضغط "تأكيد"** — Enter service name, duration in hours, and confirm.
    3. **استلم الآلة في موعدك المحدد** — Notice of approval/review, and peaceful handover at church on service day.
- Covers key reassurance points: approved slots are reserved exclusively, services inside church are 100% free, and in-app chat/WhatsApp is available for help.
- Includes a collapsible section for advanced details (fair usage policy, outside church Instapay/cash arrangements) without cluttering the primary user journey.

---

## Auth & Accounts

- Phone number is the unique identifier; one account per number; name fixed at registration.
- Login rate limiting: 15-minute lockout after 5 failed attempts.
- Forgot password via SMS OTP (max 3 requests/hour, 15-minute lockout after 5 failed OTP attempts) — implemented via Gmail SMTP/Nodemailer.
- Super Admin hardcoded, idempotent, bcrypt-hashed seeding.

---

## Notifications

- Notification back button — navigates back from a notification-opened reservation detail to the notifications list.
- Inline admin approve/reject actions directly from the notifications list.
- Series-level pending notifications on recurring series creation.
- **Unread badge** — clear visual indicator of unread notifications count.

---

## Bulk Reservation Actions

- Bulk cancel and bulk delete for selected reservations, including the reason picker for bulk cancellations.
- **Bulk Delete (Super Admin only)** — permanently removes selected reservations from the database with cascading cleanup of associated messages and notifications.

---

## Key-Holder Handover Sheet Export & WhatsApp Sharing

- **Purpose** — XLSX, CSV, or PDF/Print export and direct WhatsApp sharing for the person holding the instrument-room keys, showing who to hand which instrument to and when.
- **Scope** — Approved reservations only. Recurring series are unrolled: each occurrence exports as its own independent row (no series grouping).
- **Range selector** — Day or Week (7-day) toggle, defaulting to today/current week, with forward/back navigation and a clickable date display for direct date-picker access.
- **Format selector** — XLSX (formatted spreadsheet), CSV (raw), or PDF (printable clean sheet), chosen at export time; same underlying data across all.
- **Columns (11 fixed columns):** Date (`YYYY-MM-DD`), Start Time, End Time (12-hour), Instrument, Type/Category, Service Name, Musician Name, Reserved By, Phone Number, Usage Type (In-church/Outside), Notes.
- **Direct WhatsApp Sharing**:
    - Generates a cleanly structured, Arabic-first WhatsApp message grouped by date.
    - Uses phone directional isolation (`\u2066phone\u2069`) for clean RTL rendering.
    - Uses Web Share API on mobile/touch devices; opens WhatsApp Web (`wa.me`) on desktop with automatic clipboard fallback.
- **Print / PDF Sheet** — Formatted printable view with clean typography and date section headers (`window.print()` / PDF download).
- **Sort order** — Chronological: date ascending, then start time ascending.
- **XLSX formatting** — Bold white header text on deep navy fill, frozen header row, alternating row banding, soft green/amber cell fill for Usage Type (In-church/Outside), thin grid borders, centered date/time columns, auto-sized columns.
- **CSV format** — Plain RFC 4180-escaped values with UTF-8 BOM for cross-platform compatibility.
- **Empty range handling** — Generates a headers-only file rather than blocking export.
- **Filename convention** — `reservations_YYYY-MM-DD.ext` (Day) or `reservations_YYYY-MM-DD_to_YYYY-MM-DD.ext` (Week).
- **Entry point** — Single "Export Handover Sheet" button in the Admin Portal header, opening a modal with range/format toggle row, live table preview, row/column summary, and export/share actions.
- **RTL Support** — Full RTL layout support for Arabic language: reversed navigation arrows, date range order, and table text alignment. Day column and Date column merged for same-date rows. Bold section separators between different days for enhanced readability. Mobile scroll indicator fade on table edges.

---

## Internationalization (i18n)

- **Full Arabic/English bilingual support** — All UI text, notifications, and system messages are translatable.
- **RTL/LTR automatic switching** — Layout automatically adapts to the selected language direction.
- **Persistent language preference** — User's language choice is saved locally and persists across sessions.
- **Arabic naming conventions** — Consistent Arabic terminology throughout the app (حجز, بروفة, حفلة, كورال, اجتماع صلاة, ترانيم, ادمن).

---

## Reservation Detail Enhancement

- **Admin name fallback** — When a reservation is created by an admin (no user_id), the admin's name and phone number are displayed instead of "Unknown Member" / "N/A" using COALESCE fallback in the API query.
- **Merged Day/Date columns** — In the handover sheet export, multiple reservations on the same day now show merged cells for Day and Date columns (XLSX format only).
- **Bold day separators** — Bold border lines visually separate different days in the exported handover sheet.

---

## API Consolidation

- **Unified GET /reservations endpoint** — Single endpoint handling list view, single reservation, and handover sheet based on query parameters.
- **Standardized series routes** — All series actions now use `/api/admin/reservations/series/:seriesId/...` pattern for consistency.
- **Removed duplicate admin routes** — Cleaned up legacy `/api/reservations/admin/...` routes; all admin actions now use `/api/admin/...` canonical paths.
- **TypeScript type safety** — Full type checking passes (`npm run lint`), ensuring route consistency and type correctness.
## Admin Dashboard — Tabbed Views

- **Needs Attention tab (default)** — pending requests nearing their slot time (e.g. within 24h) surfaced separately from the general pending count; slots with competing manual-mode pending requests flagged as conflict risk; pending recurring series awaiting Approve All/Reject All shown as a distinct count; requests unreviewed past a configurable staleness threshold flagged.
- **Overview tab** — reservation volume trend (this week vs last), breakdown by instrument type.
- Split rationale: action items and trend insight are different usage modes — action items always visible by default, trend view opted into separately.

## Member Registration Approval

- New member registrations require admin approval before the account can log in and reserve (`approval_status`: pending/active/rejected).
- Dashboard summary card links directly to a filtered New Member Registrations view.
- Not present in original spec (registration was previously instant) — formalizing as an intentional addition.

## No-Show Tracking

- Per-user no-show counter, incremented when an approved reservation passes its end time without visible fulfillment (exact trigger/marking mechanism TBD).
- Surfaced on Member Profile standing summary; feeds into future limit/trust decisions if needed.
- Not present in original spec — formalizing as an intentional addition.

## Member Profile Modal (Compact Redesign)

- Name + account-status badge on one header row (badge right-aligned), contact info and member-since date condensed below.
- Trusted-status row: icon + label + Super Admin toggle, no separate label wrapper.
- Fair-usage stat cards (no-shows, active reservations, today's bookings, hourly submissions): number + max only, no repeated caption text.
- Bypassed-limits state shown inline on the stat cards themselves (e.g. struck-through max) rather than a separate banner, for Trusted/Admin profiles — *(pending decision, not yet implemented)*.
- Deep-linkable via `?userId=`, wrapped in an error boundary so malformed timestamp data can't blank the page.

## Timestamp Parsing Hardening

- `date-utils.ts` functions (`getCairoParts`, `getCairoDateString`, `getCairoTimeString`, `formatCairoDateTime`) accept Date, ISO string, SQL timestamp string, number, or null/undefined without throwing.
- Prevents unhandled `RangeError` during render when backend returns SQL-formatted timestamps.