# Church Instrument Reservation System — Project Description

---

## Overview

A mobile-first web platform for managing the reservation of musical instruments owned by a church. Members and performers can browse available instruments, view real-time availability, and submit reservation requests. The system supports two usage types: in-church (free) and outside-church (paid with Instapay). Reservations are managed by admins who can approve or reject requests per instrument, with per-instrument booking mode control.

Two separate portals exist:

- **User Portal** — for registered church members and performers
- **Admin Portal** — for admins and the Super Admin

---

## Actors

### User

A church member or performer who reserves instruments. Identified by name and phone number. Registers once; logs in with phone number and password on subsequent visits. May optionally hold **Trusted** status (see below).

### Admin

A privileged operator who manages the instrument catalog, reviews reservation requests, and controls system-wide settings. Logs in with phone number and password. Created and managed by the Super Admin. Admins can also make reservations under their own account — always auto-approved regardless of instrument mode or hard limits.

### Super Admin

A single hardcoded account created at system setup. Has all admin capabilities plus exclusive ability to:

- Add and remove admin accounts
- Edit system-wide hard limits
- Configure payment settings
- Grant and revoke **Trusted** status on user accounts

---

## Trusted User Status

A per-user privilege flag, independent of instrument mode, granted or revoked only by the Super Admin.

- **Booking effect:** a Trusted user's reservations are always auto-approved, regardless of whether the instrument is set to Manual or Instant mode, and regardless of hard limits (active count, per-day count, duration, concurrent-type, series occurrence cap, submission rate limit).
- **Not bypassed:** conflict with an existing approved reservation for the same slot. No user, including Trusted and Admin, can book an already-approved slot.
- **Recurring series:** Trusted users still go through the conflict scan and self-overlap check (see Recurring Reservations) — only the mode/limit checks are skipped. A series conflicting with an approved reservation, or conflicting with itself, is still blocked at submission.
- **Notifications:** Trusted auto-approvals trigger the same "reservation approved" bell notification as a standard approval.
- **Scope:** Trusted is a booking privilege only. It grants no admin portal access, no instrument/reservation management, no messaging capability.
- **Deactivation:** the Trusted flag persists through deactivation and reactivation — deactivating a user blocks new reservations regardless of role; reactivating restores prior state, including Trusted status.
- **Audit trail:** every grant/revoke of Trusted status is logged (admin, target user, timestamp, action).

Internal field name suggestion: `is_trusted_user` (not `instant_role`, since it bypasses limits, not just approval mode).

### Updated Booking Logic

| User Type             | Instant Instrument | Manual Instrument |
| --------------------- | ------------------ | ----------------- |
| Regular, under limits | Auto-approved      | Pending           |
| Regular, over limits  | Pending            | Pending           |
| Trusted               | Auto-approved      | Auto-approved     |
| Admin                 | Auto-approved      | Auto-approved     |

**Evaluation order for every submission (all user types except Admin/Trusted):**

1. Does the requested slot conflict with an existing **approved** reservation? → if yes, blocked outright, no exceptions.
2. If no conflict: is the user Trusted? → auto-approved.
3. If not Trusted: check instrument mode + hard limits per the table above.

---

## Instruments

Each instrument is a unique, individually bookable unit with:

- Unique ID and name (e.g. "Drum #1", "Keyboard #2")
- Type / category (e.g. Drums, Keyboard)
- Photo (optional — default placeholder shown if none uploaded)
- Description
- Outside-church fee per day (set per individual unit; 0 or empty = free/in-church only)
- Booking mode: **Manual** or **Instant** (set per instrument by admin)

Multiple units of the same type exist and are each independently reservable.

**Mode changes mid-flight:** changing an instrument's booking mode only affects future submissions. Existing Pending requests keep evaluating under the mode they were submitted under until an admin acts on them or the user edits the reservation (an edit re-triggers current rules per the Editing table below).

---

## Reservation Types

| Type                | Location          | Cost                                   |
| ------------------- | ----------------- | -------------------------------------- |
| In-church use       | Inside the church | Free                                   |
| Outside performance | External venue    | Paid (per-day rate set per instrument) |

The outside-church fee is displayed on the calendar view before the user opens the reservation form. When submitting an outside-church reservation, the user must check an acknowledgment checkbox confirming they agree to pay the specified fee.

**Fee snapshot:** the fee is locked onto the reservation record at submission time (not a live reference to the instrument's current fee). If an admin later changes the instrument's fee, it only applies to new submissions — it never retroactively changes what an already-submitted reservation owes.

---

## Working Hours

Reservations are strictly limited to **9:00 AM – 10:00 PM**. No reservation can start before 9AM or end after 10PM.

---

## Billing Days (Outside-Church Reservations)

The billing unit is the **church working day (9AM–10PM)**, not the calendar day.

- One continuous session = **1 billing day**
- A new reservation starting from 9AM the next day = **2 billing days** (counted as a separate reservation)

---

## Hard Limits (Fairness Rules)

Applied per user to prevent monopolizing instruments and to prevent spam/abuse. All limits are **admin-editable at any time from Settings** — the values below are defaults, not fixed rules. Only the Super Admin can edit them. Trusted and Admin accounts bypass all of these.

| Limit                                | Field name                 | Default | Scope                                                                                                                                                                                                                                                                               |
| ------------------------------------ | -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Max active reservations              | `max_active_reservations`  | 5       | Per user, global. Counts Pending + Approved combined. A recurring series counts as **1** toward this total, regardless of occurrence count.                                                                                                                                         |
| Max reservations per day             | `max_reservations_per_day` | 5       | Per user, global                                                                                                                                                                                                                                                                    |
| Max duration per single reservation  | `max_duration_hours`       | 5       | Per reservation                                                                                                                                                                                                                                                                     |
| Max concurrent same-type instruments | `max_concurrent_per_type`  | 2       | Per user, per instrument type. Applies at any time, overlapping or not. A recurring series counts **each occurrence individually** toward this limit — unlike `max_active_reservations`, this limit tracks real concurrent holds, and a series genuinely creates one hold per date. |
| Max occurrences per recurring series | `max_series_occurrences`   | 8       | Per series submission                                                                                                                                                                                                                                                               |
| Submission rate limit                | `max_submissions_per_hour` | 10      | Per user, rolling 1-hour window, across all reservation submissions                                                                                                                                                                                                                 |

Exceeding the active/day/duration/concurrent-type limits does **not** block submission — it downgrades the request to **Pending** regardless of instrument mode. The user is shown a warning message explaining the reason.

Exceeding the submission rate limit or the series occurrence cap **does** block submission outright — these exist to prevent spam and unbounded writes, not to gate approval status.

Admin and Trusted user reservations bypass all hard limits.

---

## Recurring Reservations

Users can book an instrument on a repeating schedule.

### Supported Patterns

- **Weekly** — repeats every X weeks on the same day and time (e.g. every Saturday 6PM–8PM)
- **Custom** — user manually picks a set of specific dates, all at the same time and duration

A single series submission cannot exceed `max_series_occurrences` (default 8, bypassed by Trusted/Admin). The UI blocks adding further occurrences once the cap is reached.

### Conflict Handling

A user **cannot submit** a recurring series if:

- **Any single occurrence conflicts with an existing approved reservation** for the same instrument, or
- **Any two occurrences within the series conflict with each other** (self-overlap — e.g. a custom date pattern or duration that causes two occurrences to touch).

The system scans all occurrences (against existing approved reservations, and against each other) in real time as the user builds the pattern. If any conflict exists, a warning panel appears listing each conflicting date and time. Submission is blocked until all conflicts are resolved. This applies to every user type, including Trusted and Admin.

### Approval (Instant-Mode Instruments)

Each occurrence in a series is evaluated independently against the conflict and limit rules (per the Evaluation Order above). A series may end up with mixed statuses — some occurrences auto-approved, others Pending — if, for example, occurrence-by-occurrence limit checks push a regular user over `max_concurrent_per_type` partway through the series. Admin sees the series as a grouped card reflecting each occurrence's actual status.

### Cancellation

- User can cancel the **entire series** at once
- User can cancel **individual occurrences** within the series
- Both options available from the My Reservations page and Reservation Detail screen

---

## Outside-Church Payment Flow

1. User submits outside reservation (no payment required at submission time)
2. Admin approves or rejects the reservation normally (independent of payment)
3. After approval — user uploads Instapay transaction screenshot from the Reservation Detail screen
4. Screenshot is stored for admin reference only (no formal verification status required)
5. Instapay number or payment link is configured once by the Super Admin in Settings and shown to users on the Reservation Detail screen after approval

---

## Editing a Reservation

Users can edit a pending or approved reservation to change: instrument, date, start time, duration, service name, musician name, and notes.

| Original Status                                     | After Edit                           |
| --------------------------------------------------- | ------------------------------------ |
| Pending                                             | Stays Pending                        |
| Approved + In-Church + Instant mode instrument      | Auto-approved again (if no conflict) |
| Approved + In-Church + Manual mode instrument       | Resets to Pending                    |
| Approved + Outside-Church (any mode, regular user)  | Resets to Pending (requires review)  |
| Approved + user over hard limits                    | Resets to Pending                    |
| Approved + Trusted or Admin user                    | Auto-approved again (if no conflict) |

Admin edits to their own reservations always re-trigger auto-approval. Any edit to an outside-church reservation by a regular user always resets to Pending for admin re-evaluation of fees and logistics.

---

## Cancellation

- Users can cancel their own upcoming (Pending or Approved) reservations
- Cancellation is immediate — slot opens instantly for others
- Admins can cancel their own reservations immediately with no approval needed
- If recurring: user chooses "Cancel this occurrence only" or "Cancel entire series"

---

## Conflict Rules

- A reservation is valid only if its time slot does not overlap any existing **approved** reservation for the same instrument unit. This is enforced at the database level via an exclusion constraint on `(instrument_id, time_range)` for rows where `status = 'approved'` — overlap is never possible to persist, regardless of application-level race conditions.
- In **manual mode**, multiple pending requests for the same slot can coexist — Pending rows are not subject to the exclusion constraint.
- When admin approves one request, all other pending requests overlapping that slot are **automatically rejected** — including individual occurrences from other users' recurring series. Auto-rejection is evaluated at the slot level, not the series level.
- Auto-rejection reason shown to affected users: _"Another reservation was approved for this time slot"_
- In **instant mode**, a new request is blocked at submission if it overlaps an approved reservation. This block applies to every user type — Trusted and Admin included.

---

## Reservation Statuses

| Status        | Description                                                         |
| ------------- | ------------------------------------------------------------------- |
| Pending       | Submitted, awaiting admin action (manual mode, or over hard limits) |
| Approved      | Confirmed, slot is locked                                           |
| Rejected      | Declined by admin — reason shown to user                            |
| Auto-Rejected | Rejected by system due to conflict — reason shown to user           |
| Cancelled     | Withdrawn by user                                                   |
| Ongoing       | Currently active                                                    |
| Completed     | Past the end time                                                   |

---

## Admin — Recurring Series Management

- Admin sees a recurring series as a **grouped card** with "Approve All / Reject All" actions
- Admin can also approve or reject **individual occurrences** within a series
- After approval, admin can still reject any approved future occurrence individually or the entire series
- Series-level rejection applies to **future occurrences only** — past, ongoing, and completed occurrences are untouched

---

## Availability Calendar (User View)

The main user-facing page is a **resource timeline calendar** — all instruments visible side by side.

### Layout

- Top: date picker strip (horizontally scrollable day chips + jump-to-date button)
- Below: horizontally scrollable grid of instrument columns
- Columns grouped by instrument type with a spanning type label header
- Each column: instrument name, outside fee badge (if applicable), booking mode chip
- Rows: 30-minute intervals, 9:00 AM – 10:00 PM
- Blocked slot (approved reservation): colored fill — no user details shown
- Free slot: white/empty — tappable

### Interaction

- Tap a free slot → Reservation Form opens pre-filled with instrument and time
- Tap an instrument column header → Instrument Detail screen
- Instrument Detail shows a single-instrument calendar with Daily / Weekly / Monthly view toggle

---

## Notifications (On-Site Bell)

Users receive on-site notifications for:

- Reservation approved (including Trusted/Instant auto-approvals)
- Reservation rejected (with reason)
- Reservation auto-rejected due to conflict
- Reservation cancelled due to instrument removal by admin
- New message from admin on a reservation

---

## In-System Messaging & Email Dispatch
 
- Admin and user can communicate via two-way messages scoped to a specific reservation
- Both admins and members can send messages from the Reservation Detail modal ("Conversation & Admin Notes" tab)
- **Email Notifications (via Gmail SMTP)**:
    - When an administrator posts a message, an email is dispatched to the member's email address with reservation details, slot info, and a direct portal link.
    - When a member replies, an email is dispatched to all approved administrator accounts with the reply content, musician name, slot info, and a direct link to the Admin Portal.
- User sees messages in the Reservation Detail screen under the conversation thread
- User's Messages tab shows all reservations with messages, with unread count badge
- A new message also fires an on-site bell notification, in addition to the Messages tab unread badge

---

## Admin — Instrument Removal

If an admin removes an instrument with existing future reservations (Approved or Pending):

- Admin must confirm a **force-remove** action
- All future reservations for that instrument — Approved and Pending alike — are automatically cancelled, since a Pending request can never be approved once the instrument no longer exists
- Affected users receive an on-site notification

---

## Admin Dashboard

- Total instruments count
- Pending requests count
- Today's reservations
- Full reservation list with filters: instrument, status, date range, user name
- Quick filter tabs: Today / Pending / All

---

## User Management (Admin)

- Admins can view all registered users (name, phone, status, member since, Trusted status)
- Admins can **deactivate** a user:
    - User can still log in but cannot make new reservations
    - All pending and approved reservations are immediately cancelled
    - Affected slots freed instantly
    - Trusted status, if held, is retained (not cleared) while deactivated
- Admins can **reactivate** a user:
    - User starts fresh — no cancelled reservations restored
    - Trusted status, if previously held, is restored
- Admins can **delete** a user:
    - All user data permanently erased (no anonymization)
- Admins can **make a reservation on behalf of their own account** from a user's profile page (always auto-approved)

---

## User Registration & Login

| Action   | Fields                       |
| -------- | ---------------------------- |
| Register | Name, Phone Number, Password |
| Login    | Phone Number, Password       |

Phone number is the unique identifier. One account per phone number. Name is set at registration and fixed.

**Login rate limiting:** account is locked for 15 minutes after 5 consecutive failed password attempts, mirroring the OTP lockout rule below.

---

## Forgot Password (OTP Flow)

1. User enters phone number → OTP sent via SMS
2. User enters 6-digit OTP (countdown timer; resend available after expiry)
3. User sets new password

**Security rules:**

- Max 3 OTP requests per phone per hour
- Account locked for 15 minutes after 5 failed OTP attempts

Same flow used for both user and admin portals.

---

## Admin Account Management (Super Admin Only)

- Super Admin account is hardcoded at system setup
- Super Admin can add and remove admin accounts (name, phone number, password)
- Super Admin can grant or revoke Trusted status on any user account (logged: admin, user, timestamp, action)
- All admins share equal permissions (instrument management, reservation management, messaging) except:
    - Admin account management — Super Admin only
    - Trusted status management — Super Admin only
    - Hard limits editing — Super Admin only
    - Payment settings (Instapay number / payment link) — Super Admin only

**Admin account removal:** reservations the removed admin made under their own account are preserved as historical records (not cancelled). Any reservations still Pending review at removal time are not auto-actioned — they remain in the queue for other admins to review.

---

## Session Management

- Sessions expire after inactivity — user redirected to login screen
- Bottom tab bar hidden when session expires
- Concurrent sessions on multiple devices allowed

---

## Resolved Design Decisions

| Topic                                | Decision                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Forgot password                      | SMS OTP flow (3 steps)                                                                                       |
| Login brute-force protection         | 15-min lockout after 5 failed password attempts (mirrors OTP lockout)                                        |
| Notification delivery                | On-site bell + automated transactional emails (Gmail SMTP) for chat messages, pending requests & approvals  |
| Admin-to-user contact                | Two-way in-system messaging scoped to reservation with automated bi-directional email dispatch & bell alerts |
| Recurring series in manual mode      | Admin sees series as grouped card; approves/rejects all or individually                                      |
| Booking mode scope                   | Per-instrument (not global) — but overridden entirely by Trusted status when present                         |
| Calendar on mobile                   | Horizontal scroll; instrument detail has Daily/Weekly/Monthly toggle                                         |
| Admin reservation                    | Always auto-approved; logged under admin's own account                                                       |
| Trusted user status                  | Super Admin–granted per-user flag; auto-approves regardless of mode/limits; conflict rule still applies      |
| Trusted + recurring series           | Still subject to conflict + self-overlap checks; only mode/limit checks are skipped                          |
| Trusted + deactivation               | Flag persists through deactivate/reactivate                                                                  |
| Hard limits behavior                 | Soft cap for active/day/duration/concurrent-type — over limit downgrades to Pending, not blocked             |
| Hard limits editability              | All hard limits (including rate limit and series cap) admin-editable in Settings at any time                 |
| Instant mode vs. over-limit order    | Conflict check always evaluated first; limit/mode checks only apply if no conflict exists                    |
| Recurring conflict rule              | Any conflict with approved slot or self-overlap blocks submission; "Skip Conflicting Dates" discards conflicts|
| Series occurrence cap                | Hard block at submission — default 8, admin-editable, bypassed by Trusted/Admin                              |
| Submission rate limit                | Hard block at submission — default 10/hour per user, admin-editable, bypassed by Trusted/Admin               |
| Cancel → rebook cooldown             | None — covered by the submission rate limit                                                                  |
| Same-type concurrency rule           | Max 2 of same instrument type active at once, any time; recurring series counts each occurrence individually |
| Active-reservations count for series | A recurring series counts as 1 toward `max_active_reservations`, regardless of occurrence count              |
| Series rejection scope               | Future occurrences only                                                                                      |
| Instrument mode change mid-flight    | Applies to future submissions only; existing Pending requests keep prior mode until acted on or edited       |
| Instrument fee change mid-flight     | Fee is snapshotted at submission; later fee changes apply only to new submissions                            |
| Force-remove instrument              | Cancels both Approved and Pending future reservations                                                        |
| Admin account removal                | Own past/future reservations preserved as history; pending queue items untouched                             |
| Deleted user data                    | Permanently erased — no anonymization                                                                        |
| Deactivated user sessions            | Can still log in; cannot make new reservations                                                               |
| Reactivated user                     | Starts fresh — no reservations restored; Trusted status restored if previously held                          |
| Payment method                       | Instapay screenshot uploaded by user post-approval or direct church administration arrangement               |
| Payment config                       | Instapay number/link set once in Settings by Super Admin                                                     |
| OTP security                         | Max 3 requests/hour; 15-min lockout after 5 failures                                                         |
| Approved-row uniqueness              | Enforced via DB exclusion constraint on `(instrument_id, time_range)` — Pending rows exempt                  |
