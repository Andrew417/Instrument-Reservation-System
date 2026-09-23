Here's the updated documentation with the new features added:

---

## Booking Core

- **Booking modes** — per-instrument, Instant or Manual. Instant auto-confirms within limits; Manual always requires admin review regardless of limits.
- **Trusted user status** — Super Admin-granted flag; auto-approves regardless of instrument mode or hard limits. Conflict with an approved slot is never bypassed.
- **Admin reservations** — always auto-approved, logged under the admin's own account.
- **Fair usage (hard limits)** — active reservations, per-day count, max duration, same-type concurrency, series occurrence cap, submission rate limit. All admin-editable in Settings; Trusted/Admin bypass all. Most limits downgrade to Pending rather than block; submission rate limit blocks outright.
- **In-church vs outside-church usage type** — in-church is free; outside-church carries a per-day fee, snapshotted at submission (later fee changes don't retroactively apply).
- **Outside-church payment flow** — user submits and checks acknowledgment box; after admin review, admin contacts the user on WhatsApp to arrange confirmation and payment (no in-app payment or verification step).
- **Recurring series** — Weekly (interval + occurrence count) or Custom (manually picked dates), same time/duration across all occurrences. Real-time conflict detection against existing approved reservations, self-overlap within the series, and working-hours bounds. Submission blocked until all conflicts resolved.
- **Editing reservations** — users can edit instrument, date, time, duration. Editing an Approved reservation on a Manual-mode instrument resets it to Pending; the Edit form now shows an inline warning when this will happen (based on live instrument selection, skipped for Trusted/Admin).
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

- One-way admin-to-user messaging scoped to a specific reservation. Admin sends; user reads only (no reply, by design).
- New message fires a bell notification in addition to the unread badge on the user's Messages tab.
- **Reservation Detail Chat Tab** — full conversation view with message history, sender identification (admin/member), and timestamp formatting. Quick reply suggestions for users when a reservation is rejected.

---

## Admin Portal

- Dashboard: total instruments, pending requests, today's reservations, filterable full reservation list.
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

- In-app modal covering: Instant vs Manual booking modes, a plain-language fair-usage-limits summary (no per-limit breakdown — kept high-level to avoid overwhelming users), the always-enforced "approved slot can't be booked by anyone else" rule, and the outside-church fee/payment flow (confirm fee → WhatsApp call from admin).
- Specific hard-limit numbers and names are intentionally left out of this modal; limit-triggered Pending status is meant to be explained contextually (e.g. on Reservation Detail) rather than upfront.

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

## Key-Holder Handover Sheet Export

- **Purpose** — CSV/XLSX export for the person holding the instrument-room keys, showing exactly who to hand which instrument to and when.
- **Scope** — Approved reservations only. Recurring series are unrolled: each occurrence exports as its own independent row (no series grouping).
- **Range selector** — Day or Week (7-day) toggle, defaulting to today/current week, with forward/back navigation and a clickable date display for direct date-picker access.
- **Format selector** — XLSX (formatted) or CSV (raw), chosen at export time; same underlying data and column order in both.
- **Columns (fixed order):** Date (`YYYY-MM-DD`), Start Time, End Time (12-hour), Instrument, Type/Category, Service Name, Reserved By, Phone Number, Usage Type (In-church/Outside).
- **Sort order** — Chronological: date ascending, then start time ascending.
- **XLSX formatting** — Bold white header text on deep navy fill, frozen header row, alternating row banding, soft green/amber cell fill for Usage Type (In-church/Outside), thin grid borders, centered date/time columns, auto-sized columns.
- **CSV format** — Plain RFC 4180-escaped values with UTF-8 BOM for cross-platform compatibility; no styling (CSV has no formatting spec).
- **Empty range handling** — Generates a headers-only file rather than blocking export.
- **Filename convention** — `reservations_YYYY-MM-DD.ext` (Day) or `reservations_YYYY-MM-DD_to_YYYY-MM-DD.ext` (Week).
- **Entry point** — Single "Export Handover Sheet" button in the Admin Portal header, opening a modal with range/format toggle row, live table preview, row/column summary, and export action. No duplicate export surface on the Dashboard Overview tab.
- **RTL Support** — Full RTL layout support for Arabic language: reversed navigation arrows, date range order, and table text alignment. Day column and Date column merged for same-date rows. Bold section separators between different days for enhanced readability.

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