# Church Instrument Reservation Platform — Complete Features Reference

> **Documentation Purpose:** This document serves as the comprehensive, authoritative feature catalog for the platform. It is structured with zero fluff and maximum technical precision, allowing vibe coders and AI models to understand all business workflows, user journeys, admin controls, and edge cases.

---

## 1. Authentication & Role-Based Access Control (RBAC)

### 1.1 Account Registration & Approval Workflow
- **Unique Identifier:** Egyptian mobile phone number (`01xxxxxxxxx`) and unique email address.
- **Approval Gate:** Newly registered members start in `approval_status = 'pending'`. They cannot log in or reserve instruments until an Admin or Super Admin approves their registration via the Admin Portal.
- **Email Notifications on Registration:**
  - Upon registration, automated emails are dispatched to church administrators alerting them of the new registration.
  - Can be muted/unmuted globally in Super Admin Notification Settings.
  - Upon approval by admin, the member receives an automated confirmation email welcoming them.

### 1.2 Security & Rate Limiting
- **Password Storage:** Salted and hashed using `bcryptjs` (cost factor 10).
- **Login Lockout:** 5 consecutive failed login attempts trigger an automatic 15-minute lockout via the `failed_login_attempts` table.
- **Password Reset Flow (Email OTP):**
  - Member enters registered email -> system generates 6-digit cryptographic OTP.
  - OTP hashed and stored in `password_reset_otps` table with 10-minute expiry.
  - Rate-limited to max 3 OTP requests per rolling hour and 5 verification attempts before a 15-minute cooldown.
  - Dispatched via Gmail SMTP with church-branded email styling.
- **Server-Side Session Store:** Custom database-backed `sessions` table supporting sliding-window activity expiry (`lastActiveAt` updated on requests).

### 1.3 Role Hierarchy & Permissions
| Role | Capabilities | Unique Privileges |
|---|---|---|
| **Member (User)** | Browse catalog, check calendar, submit single/series/band bookings, chat on reservations, condition checks, view ministry profile. | Standard fair usage rules apply. Can submit category Type Requests for enabled categories. |
| **Musician User** | Independent flag (`is_musician`). Books visible instruments directly without category requests. | **Direct Access:** Can see and directly book `musician`-tier instruments on the calendar. Standard fair usage applies unless also Trusted. |
| **Trusted User** | Independent flag (`is_trusted`). All member capabilities. | **Auto-approval bypass:** Direct reservations are instantly approved on both Manual and Instant instruments and bypass all limits 1–6 (slot conflicts still apply). |
| **Admin** | All member capabilities + review requests, edit/cancel reservations, manage instruments, assign instruments to type requests, chat with members, export handover sheets, view dashboard. | Can book on behalf of members (admin recorded as creator in audit log); self-bookings auto-approve. Account actions protected by transactional retry logic (`withRetry`). |
| **Super Admin** | Full admin powers + promote/demote/delete admins, configure global hard limits, set Instapay payment info, grant/revoke Trusted status and Musician status with interactive sortable audit logs. | Idempotently seeded at startup; protected from deletion or demotion. Sole role permitted to grant/revoke Musician status. |

### 1.4 Trusted & Musician Status Audit Logs & Interactive Sorting
- **Audit Tracking:**
  - Trusted status changes are logged in `trusted_status_audit_log` with `target_user_id`, `granted_by_admin_id`, `action` (`granted` | `revoked`), and timestamp.
  - Musician status changes are logged in `musician_status_audit_log` with `target_user_id`, `granted_by_admin_id`, `action` (`granted` | `revoked`), and timestamp.
- **Interactive Multi-Column Sorting:** In the Super Admin portal, audit logs can be sorted ascending or descending by:
  - Date & Time (`created_at`)
  - Action (`action`)
  - Target Member Name (`target_user_name`)
  - Authorized Admin Name (`granted_by_admin_name`)
  - Note / Reason (`reason`)
- **Directional Indicators:** Interactive column headers display dynamic sort icons (`ArrowUpDown`, `ArrowUp`, `ArrowDown`) with screen-reader friendly aria-labels (`admin.trustedStatus.sortBy`).
- **Sub-Tab Switcher:** The Trusted Status tab features a sub-tab toggle allowing Super Admins to switch seamlessly between Trusted Status and Musician Status audit logs.

---

## 2. Instrument Inventory, Visibility Levels & Type Requests

### 2.1 Instrument Units & Visibility Levels
- Instruments represent individual physical assets (e.g., *Drum Kit #1*, *Yamaha Motif Keyboard #2*, *Bass Guitar #1*).
- **Visibility Levels:**
  - **`public`**: Visible and bookable by all registered users.
  - **`musician`**: Visible and directly bookable by Musicians and Admins only. Completely hidden from regular users (enforced via server-side queries).
  - **`room_stock`**: Visible to Admins only. Cannot be booked directly; reserved for administrator assignment to type requests.
  - **`out_of_service`**: Broken or unavailable instruments. Clearly badged across admin and calendar views; slot booking and type assignment are strictly disabled.

### 2.2 Category Type Requests (Regular Members)
- **Concept:** Regular members can choose to submit a request for an instrument category/type (e.g., "any Keyboard") instead of selecting a specific physical unit.
- **Category Configuration (`instrument_type_settings`):**
  - **`can_be_requested`**: Admin-controlled boolean toggle per category (default `false`).
  - **`flat_fee_outside`**: Fixed rental fee in EGP locked at submission time for outside-church usage.
- **Behavioral Invariants:**
  - Type requests **always start in `pending` status** (even for Trusted users).
  - Type requests do **not** block calendar slots and do not appear on public schedules until assigned.
  - Counts toward the user's active reservations limit (recurring series counts as 1).
  - **Auto-Expiration:** If an unassigned type request reaches its scheduled start time, the system automatically rejects it with the reason `"Not assigned before the start time"` and sends a notification.

### 2.3 Admin Assignment & Reassignment Engine
- **Review Queue:** Type requests in the Review tab display a dedicated **"Assign Instrument"** action and show the count of matching available units.
- **Candidate Smart Prioritization:**
  1. **Room Stock** (Allocated first to protect bookable inventory)
  2. **Musician Instruments**
  3. **Public Instruments**
- **Disqualification Rules:** Instruments booked during that time or marked Out of Service are disabled with clear conflict notices.
- **Series Assignment:** Admins can assign one instrument for all dates in a recurring series, or approve fitting dates and reject conflicting dates with an explicit reason.
- **Reassignment:** Approved reservations have a "Reassign" action to move them safely to another candidate instrument.
- **Edit Reset:** Editing date, time, or duration on an approved type request resets its status to `pending` and clears `instrument_id = null`.

### 2.4 Booking Modes: Instant vs. Manual
- **Instant Mode:** Submissions from regular members on public instruments within fair-usage limits are **automatically approved** immediately upon submission.
- **Manual Mode:** Submissions from regular members enter `pending` status, requiring an administrator to explicitly review and approve/reject.
- **Mid-flight Mode Changes:** Modifying an instrument's mode only affects future submissions. Existing pending requests retain their submission-time evaluation.

### 2.5 Instrument Removal & Cascade Handling
- If an admin deletes/retires an active instrument with future bookings, the system performs a safe force-removal:
  - Cancels all future `pending` and `approved` reservations for that instrument.
  - Attaches cancellation reason: *"Instrument retired or under maintenance"*.
  - Dispatches Web Push and in-app notifications to all impacted members.

---

## 3. Core Booking Engine & Fair Usage

### 3.1 Working Hours & Timezone Rules
- **Strict Working Bounds:** **9:00 AM to 10:00 PM** local Cairo time (`Africa/Cairo`).
- No reservation can start before 09:00 or end after 22:00.
- Durations are enforced in increments of 0.5 or 1 hour.

### 3.2 In-Church (Free) vs. Outside-Church (Paid)
- **In-Church Usage:** 100% free of charge for liturgical services, rehearsals, choir practices, and youth meetings.
- **Outside-Church Usage:**
  - Carries a per-day rental fee configured per instrument.
  - **Fee Snapshot:** The fee is locked at submission time onto `fee_snapshot`. Subsequent admin price adjustments do not retroactively modify existing bookings.
  - **Mandatory Review:** Outside-church bookings **always default to `pending`**, requiring admin verification regardless of whether the instrument is in Instant mode.
  - **Payment Flow:** User acknowledges the fee at submission. Once approved, user uploads an Instapay transfer receipt screenshot via the Reservation Detail modal. Admins can view, verify, and remove the receipt.

### 3.3 Conflict Invariant
- At no point can two approved reservations overlap on the same physical instrument.
- Evaluated via PostgreSQL `tstzrange` overlaps (`&&`).
- **No user—including Admins and Super Admins—can override an approved slot conflict.**

### 3.4 Fair Usage System (Hard Limits 1–6)
All 6 limits are configured live in Settings by the Super Admin:
1. **Max Active Reservations (`max_active_reservations`, default 5):** Pending + Approved combined count. Recurring series counts as 1. *(Soft Cap -> Downgrades to Pending)*.
2. **Max Reservations Per Day (`max_reservations_per_day`, default 5):** Same calendar date globally. *(Soft Cap -> Downgrades to Pending)*.
3. **Max Duration Per Reservation (`max_duration_hours`, default 5):** Single slot length cap. *(Soft Cap -> Downgrades to Pending)*.
4. **Max Concurrent Same-Type Instruments (`max_concurrent_per_type`, default 2):** Simultaneous active bookings for the same instrument category (e.g., 2 sets of Drums). *(Soft Cap -> Downgrades to Pending)*.
5. **Max Occurrences Per Series (`max_series_occurrences`, default 8):** Maximum dates allowed in a single recurring series submission. *(Hard Cap -> Blocks submission outright)*.
6. **Submission Rate Limit (`max_submissions_per_hour`, default 10):** Rolling 1-hour submission window. *(Hard Cap -> Blocks submission outright)*.
- **Global Limit Bypass:** Super Admin can toggle `bypass_hard_limits` in settings to temporarily suspend all limits system-wide for all users during busy seasons (e.g. Christmas / Easter praise festivals).

### 3.5 Floating Error Alert Overlay & Dynamic Form Ergonomics
- **Fixed Floating Alert Overlay (`z-[220]`):** When a reservation submission violates limits or encounters an error, the error banner floats as a prominent alert overlay at the top of the viewport instead of taking static layout space inside the scroll container.
  - **Screen Reader Accessibility:** Uses `role="alert"` and `aria-live="assertive"` for instantaneous assistive technology announcements.
  - **Actionable Next Steps:** Shows violation title, clear explanation, and a highlighted "What to do:" recovery guide (`getLimitMessage(error).nextStep`).
  - **Dismissible:** Includes an explicit dismiss button (`X`) so users can acknowledge and dismiss the notice.
  - **Directional Alignment:** Automatically positioned top-right on LTR and top-left on RTL (`sm:right-5 sm:left-auto` vs. `sm:left-5 sm:right-auto`), centered on mobile.
- **Auto-Expanding Notes Textarea:** The special notes field in `ReservationFormModal` automatically expands as the user types (`noteRef` + `scrollHeight`), eliminating cramped fixed text boxes.
- **Compact 2-Column Slot Grid:** Date and Time selectors are arranged in a 2-column layout (`grid-cols-2`) for rapid touch selection on mobile and desktop.
- **High-Visibility Recurring Toggle:** Styled with distinctive brand color backgrounds (`bg-brand-50`, `border-brand-300`, `ring-brand-300`) and an active ring focus indicator on the submit action when recurring mode is selected.

---

## 4. Recurring Series Booking

### 4.1 Series Patterns
- **Weekly Pattern:** Selects a day of the week, start time, duration, and recurrence count (e.g., Every Friday for 4 weeks).
- **Custom Pattern:** Manually pick multiple non-consecutive dates on the calendar sharing the same time and service name.

### 4.2 Conflict Prevention & 1-Click Skip
- The series builder runs a real-time conflict simulation across all requested dates.
- If conflicts exist with existing approved bookings, the UI highlights conflicting dates in red.
- **"Skip Conflicting Dates" Button:** 1-click action that automatically prunes the conflicting occurrences and converts the request into a clean Custom pattern, enabling immediate submission without manual date deletion.

### 4.3 Series Admin Management & Structured Rejection
- **Grouped Series Cards:** The Admin Portal groups recurring occurrences into an expandable card displaying dates, times, and progress.
- **Batch Actions:** Supports **Approve All** and **Reject All** batch operations as well as granular review per single occurrence.
- **Single vs. Series Rejection Modal (`RejectReasonModal`):**
  - Displays pre-formatted reservation metadata (Instrument Name, Member Name, Formatted Cairo Date via `formatDisplayDate`, and 12-hour Time Window via `formatHhmmTo12Hour`).
  - Toggle between rejecting just this specific date (`isSeriesReject: false`) vs. rejecting the entire remaining series (`isSeriesReject: true`).
  - Rejection reason selection with preset buttons and custom text.
  - Dispatches to `/api/admin/series/:seriesId/reject` or `/api/admin/reservations/:id/reject` with transactional audit logging.

---

## 5. 🎸 Band / Service Pack (Multi-Instrument Co-Booking)

### 5.1 Purpose & Motivation
Worship leaders often need a coordinated set of gear (e.g. Drums + Keyboard + Acoustic Guitar + Bass) for a rehearsal. Booking instruments individually creates a high risk of partial booking if one instrument gets taken mid-process.

### 5.2 Key Mechanics
- **Single Atomic Submission:** User selects multiple instruments, assigns a specific musician name to each instrument row, sets a shared service time, and submits once.
- **Atomic Conflict Verification:** If any single instrument has an approved conflict during that time slot, the **entire pack is rejected at submission**, preventing broken half-bands.
- **Combined Outside Fee:** Automatically aggregates the rental fee across all included instruments with a unified Instapay payment acknowledgment.
- **Linked Sessions:** Each row shares a common `band_pack_id`.
- **Roster View:** In "My Reservations" and "Reservation Detail", a `[🎸 Band Pack]` badge and full roster list show all sibling instruments and assigned musicians.

---

## 6. ⚡ 1-Tap Quick Re-Book ("The WhatsApp Killer")

### 6.1 Purpose & Ergonomics
Replaces informal WhatsApp booking chats with a 3-second, 1-tap mobile experience for musicians booking regular weekly services.
- **Vertical Footprint:** Under 100px vertical height; placed right above the calendar timetable.
- **Zero Duplication:** Every data point (Instrument, Musician, Service, Date, Time, Availability) appears exactly once.

### 6.2 Intelligent Routine Engine
- **Endpoint:** `GET /api/reservations/quick-rebook-suggestion`.
- Evaluates the user's past 90-day reservation history to detect recurring weekly habits (e.g. Fady books Keyboard #1 every Friday at 6:00 PM for Youth Meeting).
- Dynamically shifts the date forward to the exact upcoming weekday in Cairo timezone.
- Checks live availability; if the slot is occupied, flags it or suggests an alternative.

### 6.3 Features & Customization
- **Embedded Service Switcher:** Mobile-native inline `<select>` to toggle between regular services (Youth Meeting, Liturgy, Choir).
- **"Change Details" (`[تعديل التفاصيل]`):** Opens the full booking form pre-populated with the routine data for quick tweaks.
- **1-Click WhatsApp Group Sharing:** Upon confirmation, transforms into a clean receipt card with a `[Share to WhatsApp Group]` button containing a formatted bilingual notice.

---

## 7. 📸 Pre-Handover Condition & Damage Check

### 7.1 Musician Protection & Asset Stewardship
Protects members from being blamed for pre-existing scratches, worn drumheads, broken strings, or missing power cables.

### 7.2 Inspection Logging Flow
The condition verification modal follows a structured, step-by-step layout designed for rapid on-site inspection before taking custody of the instrument:
1. **Section 1: Inspector Identification (اسم الخادم أو العازف الفاحص):** Verified By name input with User icon placed prominently at the top, pre-populated with the logged-in member's name.
2. **Instrument Info Summary Card:** Shows the instrument name, category, and booked service timing.
3. **Section 2: Two-Choice Status Selector (كيف ترى حالة الآلة عند الاستلام؟):**
   - 🟢 **Pristine & Ready to Play** (سليمة وممتازة 100%)
   - 🟡 **Minor Pre-existing Issues** (ملاحظات أو عيوب سابقة بسيطة)
4. **Section 3: Quick Tag Chips (اختيارات سريعة للملحقات والحالة):** Interactive toggle chips for instant categorization (e.g., *All cables present*, *Pre-existing scratches*, *Broken string*, *Noisy audio jack*, *Damaged drum head*, *Missing sustain pedal*, *Adapter checked*).
5. **Section 4: Remarks & Notes (ملاحظات إضافية بالكلمات):** Free-form text area for specific physical observations.
6. **Section 5: Photo Evidence (صورة توثيقية للآلة أو التلف السابق):** Camera capture or file upload with instant preview and remove capability.
- **Sticky Bottom Action Bar:** Compact, mobile-friendly footer with "Cancel" and "Save & Verify Condition" (حفظ وتوثيق الفحص رسمياً) buttons.
- **Tamper-Evident Record:** Permanently logs inspector's name and Cairo timestamp. Displayed in both member and admin reservation detail sheets.

---

## 8. 🌟 Musician Ministry Profile (Service Celebration)

### 8.1 Spiritual Motivation
Transforms the platform from an administrative policing tool into an uplifting spiritual encouragement system for church musicians.
- Centered on Psalm 150:4: *«سَبِّحُوا الرَّبَّ... سَبِّحُوهُ بِأَوْتَارٍ وَمِزْمَارٍ»* ("Praise Him with strings and pipes").

### 8.2 Ministry Metrics & Badges
- **Metrics Tracked:** Total worship & practice hours served, total services attended, stewardship reliability score (0 no-shows), verified condition checks, and band pack collaborations.
- **Honor Badges:**
  - 🌟 **خادم أمين وموثوق (Faithful & Reliable Servant):** 100% attendance with zero no-shows.
  - 🎵 **عازف تسبيح مكرّس (Dedicated Musician):** 6+ hours served in church praise.
  - 🛡️ **حارس أمانة الآلات (Asset Caretaker):** Documented pre-handover equipment inspections.
  - 🎸 **روح الفريق والباند (Band Collaborator):** Co-booked with fellow musicians in Band Packs.
- **Instrument & Service Distribution:** Visual progress breakdown of favorite instruments and church services.
- **1-Click WhatsApp Ministry Card:** Generates an inspiring blessing message to share with the church music group.

---

## 9. 🔑 Key-Holder Handover Sheet & WhatsApp Broadcast

### 9.1 Handover Coordination Tool
Specifically designed for the church sexton / key-holder holding the instrument room keys. Displays exactly who receives which instrument and when.

### 9.2 Export & Broadcast Features
- **Scope:** Approved reservations only; recurring series unrolled into individual rows.
- **Time Range Selector:** Day or Week (7-day) toggle with forward/back arrows and date picker.
- **Formats Supported:**
  1. **XLSX (Formatted Excel):** Deep navy header, auto-fit columns, soft green/amber status highlights, merged date cells for same-day rows.
  2. **CSV (Raw Data):** Standard RFC 4180 with UTF-8 BOM for cross-platform Excel compatibility.
  3. **Print / PDF Sheet:** Clean typography formatted for direct printing (`window.print()`).
- **Direct WhatsApp Sharing:**
  - Formats clean, date-grouped Arabic WhatsApp message.
  - Uses Unicode directional isolation (`\u2066phoneNumber\u2069`) to prevent phone number distortion in mixed Arabic/English text.
  - Invokes native Web Share API on mobile devices and `wa.me` links on desktop.

---

## 10. 💬 Two-Way In-System Messaging & Gmail SMTP

### 10.1 Scoped Conversation Threads
- Every reservation has a dedicated conversation thread in the Reservation Detail modal.
- Admins and members can communicate directly regarding setup requirements, pickup logistics, or cable needs.

### 10.2 Bi-directional Email Dispatch (via Gmail SMTP)
- **Admin sends message:** Member receives an automated email with reservation slot context and a direct link to the portal.
- **Member sends reply:** Automated email dispatched to all active church administrators with member name, instrument, and quick-reply link.
- In-app unread badges update in real-time on both the Messages tab and top navigation bell.

---

## 11. 🔔 Multi-Device Web Push Notifications

### 11.1 Infrastructure
- Standard Web Push API powered by `web-push` npm package and standard VAPID public/private keys stored in `.vapid.json`.
- Service worker registered at `/public/sw.js`.

### 11.2 Trigger Events
- **For Members:**
  - Reservation approved or rejected.
  - Admin message received.
  - Reservation cancelled with admin reason.
- **For Admins:**
  - New member registration awaiting approval.
  - New reservation request submitted.
  - Member replies to a message.
- **Per-Admin Push Preferences:** Admins can independently toggle whether they receive pushes for new registrations, new requests, or member messages.

---

## 12. 📋 Admin Portal & Management System

### 12.1 Collapsible Sidebar Navigation
- Smoothly collapses to an icon rail (`w-20`) or expands (`w-72`), persisted in browser localStorage.
- Real-time search filter to locate specific admin tools quickly.
- Full RTL layout support with high-contrast active indicator bars.

### 12.2 Portal Tabs
1. **Needs Attention Tab (Default):** Highlights urgent items:
   - Pending requests starting within 24 hours.
   - Competing manual-mode requests for the same time slot (conflict risk).
   - Pending recurring series awaiting batch review.
   - Stale requests awaiting review past the threshold.
2. **Overview & Analytics Tab:** Reservation volume trends (this week vs. last week), instrument utilization distribution using Recharts.
3. **Approvals / Review Tab:**
   - Dedicated filter buttons by status: **Pending (قيد الانتظار)**, **Approved (مقبولة)**, **Rejected (مرفوضة)**, and **All (الكل)**.
   - Real-time search query across member name, phone, or email.
   - Direct inline approval and rejection modal triggers with count badges (`counts: { pending, approved, rejected, total }`).
   - Powered by resilient database transactions via `withRetry` ensuring zero partial updates during concurrent review.
4. **Instruments Tab:** Add, edit, photo upload, toggle Instant/Manual mode, set outside fees, and retire instruments.
5. **Users Tab:** Member directory, account approval/rejection with automatic session revocation on rejection, active booking counts, no-show counts, deactivation/reactivation, and Super Admin Trusted toggle.
6. **Messaging Tab:** Unified inbox of all reservation chat threads with unread indicators and quick replies.
7. **Super Admin Controls:**
   - *Admin Accounts:* Create, demote, or delete admin accounts.
   - *Hard Limits Configuration:* Adjust all 6 limits with inline documentation tooltips.
   - *Payment Settings:* Configure Instapay account details and payment URLs.
   - *Notification Settings:* Mute/unmute registration and reservation emails.
   - *Trusted Status Audit Log:* Interactive multi-column sortable audit trail (`created_at`, `action`, `target_user_name`, `granted_by_admin_name`, `reason`).

### 12.3 Structured Rejection & Cancellation Presets
- **Rejection Presets:** *"Time slot already booked"*, *"Reserved for church use"*, *"Instrument under maintenance"*, *"Exceeds booking limits"*, plus custom note. Includes single occurrence vs. entire series toggle.
- **Cancellation Presets:** Presets + custom reason surfaced to the member via an amber alert banner on the reservation detail screen.

---

## 13. 📖 Policy Explainer ("كيف تحجز؟")

- Specially crafted for older church members and users unfamiliar with complex apps.
- Presented in welcoming, warm Egyptian Arabic (`dir="rtl"`).
- Automatically pops up on first login, and accessible anytime via the top header.
- **3 Simple Steps:**
  1. **اختر الآلة والموعد من الجدول** — Pick the instrument and desired slot.
  2. **اكتب اسم الخدمة ثم اضغط "تأكيد"** — Enter service name and confirm.
  3. **استلم الآلة في موعدك المحدد** — Notice of approval and smooth pickup at church.
- Collapsible section for advanced rules (fair usage limits and outside-church Instapay guidelines).
- **Streamlined Footer:** Compact dismiss button ("فهمت، ابدأ الاستخدام") with helpful reminder note to revisit the guide anytime from the header button.

---

## 14. 🌐 Internationalization (i18n) & Timezone Engine

- **Bilingual Arabic / English:** Powered by `react-i18next`. Arabic is the primary default.
- **Directional Switching:** Seamlessly toggles `dir="rtl"` and `dir="ltr"` on the document root with persistent storage in localStorage.
- **Culturally Natural Church Terminology:** All terminology strictly adheres to Coptic/Egyptian church traditions (خدمة, قداس, اجتماع شباب, ترانيم, كورال, بروفة, ادمن).
- **Cairo Timezone Resiliency:** All dates, working hours, and slot boundaries are evaluated strictly in Cairo wall-clock time (`Africa/Cairo`) using robust timestamp parsing in `date-utils.ts` to prevent timezone skew across mobile clients.

---

## 15. 🛡️ Database Resilience & Transaction Retry Patterns

- **`withRetry` Database Wrapper (`src/db/index.ts`):** Critical backend operations (account approval, account rejection, active session termination, and status updates) are wrapped in `withRetry<T>`.
- **Transient Glitch Protection:** Automatically retries queries on transient pool timeouts, connection disconnects, or deadlocks with exponential backoff before failing gracefully.
- **Zero Orphaned Sessions:** When an admin rejects a user account, active sessions in `sessions` are purged atomically within a retry block, preventing unauthorized API calls immediately.

