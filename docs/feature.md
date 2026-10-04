# Church Instruments Reservation Platform — Comprehensive Feature Documentation

---

## ⚡ 1-Tap Quick Re-Book ("The WhatsApp Killer" & Routine Service Booking)

- **Purpose** — Enables church musicians and choir members to re-book their routine weekly church services in 3 seconds with a single tap, eliminating repetitive form-filling and providing a faster, smoother experience than typing a message in a WhatsApp group.
- **Ultra-Compact, Mobile-First Ergonomics**:
  - **Minimal Vertical Footprint** — Streamlined card profile (< 100px vertical height) placed prominently at the top of the Home Screen / Calendar view, keeping the master timetable fully visible.
  - **Zero Content Repetition** — Each data point (Instrument, Musician, Service, Date, Time, Status) is displayed exactly once in a clean, uncluttered layout designed for effortless scanning by members of all ages.
  - **Single-Row Date & Time** — Date and service hours are unified into a single line (`📅 Fri, Oct 9, 2026 · ⏰ 6:00 PM – 8:00 PM (2h) · 🟢 Slot Available`).
  - **Compact 1-Tap CTA** — Thumb-friendly `h-9` confirm button (`[ ⚡ Confirm in 1 Tap ]`) with instant tactile feedback.
- **Service Switcher (Best Mobile UX)**:
  - Embedded native `<select>` dropdown directly on the `Service:` line. On mobile devices, this triggers the native wheel / bottom-sheet picker without taking up any extra vertical rows or cluttering the interface with redundant pill buttons.
  - Smoothly toggles between personal routine patterns and standard church service presets (Youth Meeting, Sunday Liturgy, Choir Rehearsal).
  - Automatically filters out single-character test placeholders (e.g. "g") to keep the service list pristine.
- **Intelligent Routine Detection & Cairo Timezone Engine**:
  - **Endpoint**: `GET /api/reservations/quick-rebook-suggestion`
  - Analyzes the musician's reservation history to identify recurring weekly patterns (instrument, day of week, Cairo wall-clock hours, duration).
  - Dynamically calculates the exact upcoming date for the target day of the week in Cairo timezone (handling UTC and DST boundaries).
  - Performs live availability checking to verify the slot is free and flags if the user already has an existing confirmed booking for that date.
- **Flexibility & Customization**:
  - **"Change Details" (`[تعديل التفاصيل]`) Button** — Instantly opens the full reservation form modal pre-filled with the routine instrument, service, date, time, and duration for adjustments before booking.
  - **Non-Intrusive Dismiss & Restore** — Users can hide the card via `[✕]`; a subtle `⚡ Re-book Regular Service` restore button remains available to reopen it anytime without reloading.
- **1-Click WhatsApp Group Sharing**:
  - Upon 1-tap confirmation, the card transitions into a compact celebration receipt.
  - Includes a `[ Share to WhatsApp Group ]` button that formats a complete, bilingual church reservation notice ready to send to the choir or ministry team chat.
- **Full Bilingual & RTL Support** — Seamlessly localized in Arabic and English with proper RTL alignment, Western Arabic numerals, and culturally natural church service terminology.

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

## 🎸 "Band / Service Pack" (Multi-Instrument Co-Booking with Musician Assignment)

- **Purpose** — Allows worship leaders and musicians to book a complete bundle of instruments (e.g. Drums + Keyboard + Guitar) for the same rehearsal or service in one single submission, preventing partial-booking frustration.
- **Musician Name Requirement** — Every instrument row in the pack explicitly specifies the assigned musician's name (e.g., Korg Keyboard #1 → Fady Adel, Pearl Drums #1 → Mina Nabil).
- **Atomic Conflict Prevention** — Validates availability across all selected instruments. If any instrument has an approved conflict, blocks submission with a clear explanation naming the conflicted instrument.
- **Combined Outside Fee** — For outside-church bookings, automatically sums up rental fees across all selected instruments with a single unified Instapay acknowledgment.
- **Linked Sessions** — All instruments in the pack share a unique `band_pack_id`. In "My Reservations" and "Reservation Detail", a `[🎸 طاقم باند / Band Pack]` badge and a roster view display all sibling instruments and their musicians.

---

## 📸 Pre-Handover Condition & Damage Check (Musician Peace of Mind)

- **Purpose** — Protects church members from being held liable for pre-existing scratches, broken strings, missing cables, or worn drum heads that occurred before their pickup.
- **Status Logging** — Musicians can record:
  - 🟢 **Pristine & Ready to Play** (سليمة وممتازة 100%)
  - 🟡 **Minor Existing Wear / Pre-existing Issues** (ملاحظات أو عيوب سابقة بسيطة)
- **Condition Tags** — Quick multi-select tags for common issues: all cables present, pre-existing scratches/dents, broken/missing string, sticky key/loose knob, missing sustain pedal/stand, audio jack noise, damaged drum skin/cymbal, clean & well-stored.
- **Photo Evidence & Notes** — Allows taking or uploading a photo proof of the instrument condition, adding notes, and recording the verifier name with a Cairo timestamp.
- **Transparent Record** — Displayed in both the musician's portal and Admin Reservation Detail screen, creating a shared, verified record of asset care.

---

## 🌟 Musician Ministry Profile (Service Celebration & Recognition)

- **Purpose** — Celebrates church members' musical service and worship dedication, shifting the platform from administrative policing to uplifting spiritual encouragement.
- **Key Metrics** — Total worship & rehearsal hours served, total church services/rehearsals attended, stewardship & reliability score (0 no-shows), documented condition checks, and band pack participations.
- **Scripture Blessing** — Rooted in Psalm 150:4: «سَبِّحُوا الرَّبَّ... سَبِّحُوهُ بِأَوْتَارٍ وَمِزْمَارٍ» ("Praise Him with stringed instruments and flutes").
- **Ministry Honors & Badges** — Unlockable recognition milestones:
  - 🌟 **خادم أمين وموثوق (Faithful & Reliable Servant)**: 100% attendance without no-shows.
  - 🎵 **عازف تسبيح مكرّس (Dedicated Musician)**: 6+ hours served in church praise.
  - 🛡️ **حارس أمانة الآلات (Asset Caretaker)**: Documented pre-handover checks.
  - 🎸 **روح الفريق والباند (Band Collaborator)**: Participated in Band Pack group rehearsals.
- **Service & Instrument Distribution** — Visual progress bars for most played instruments and service categories (Youth Meeting, Sunday Liturgy, Choir Rehearsal, Prayer & Praise).
- **1-Click WhatsApp Ministry Card Sharing** — 1-click sharing of an encouraging ministry blessing message to the church choir or band WhatsApp group.

---

## 🛡️ Reliability & API Boundary Hardening

- **Express/Vite API Boundary Protection** — Dedicated `app.all("/api/*")` 404 handler and global `/api/*` error handling middleware in Express, guaranteeing that all API calls receive standard JSON error responses and never fall through to the Vite SPA HTML fallback (`<!doctype html>`).
- **Calendar Data Resiliency** — Client calendar fetching (`AvailabilityCalendar.tsx`) enforces `Accept: application/json` headers, URL encodes dates, and validates response `Content-Type` before parsing JSON.
- **Unprivileged Runtime DB Protection** — Application startup eliminates raw unprivileged `ALTER TABLE` statements in favor of non-DDL verification on `information_schema.columns`. All DDL schema changes are managed via declarative migrations.
- **Isolated Startup Error Boundaries** — Super admin seeding and database verification run in independent try-catch boundaries, ensuring server port binding is never blocked.
