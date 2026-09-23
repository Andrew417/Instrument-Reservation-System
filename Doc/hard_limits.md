All limits are admin-editable in Settings. Trusted and Admin users bypass all of them. Defaults shown below.

---

### 1. Max Active Reservations (`max_active_reservations`, default 5)

Counts a user's Pending + Approved reservations combined, globally. A recurring series counts as **1**, no matter how many occurrences.

- **Under limit:** User has 4 active reservations, submits a 5th → evaluated normally against mode/other limits.
- **At/over limit:** User has 5 active reservations, submits a 6th → forced to Pending, even on an Instant instrument.

---

### 2. Max Reservations Per Day (`max_reservations_per_day`, default 5)

Counts a user's reservations on one calendar day, globally.

- **Under limit:** User has 3 reservations on Nov 5, submits a 4th for Nov 5 → evaluated normally.
- **At/over limit:** User has 5 reservations on Nov 5, submits a 6th for the same day → forced to Pending.

---

### 3. Max Duration Per Reservation (`max_duration_hours`, default 5)

Applies to a single reservation's length.

- **Under limit:** User requests a 3-hour slot → evaluated normally.
- **Over limit:** User requests a 6-hour slot → forced to Pending.

---

### 4. Max Concurrent Same-Type Instruments (`max_concurrent_per_type`, default 2)

Counts a user's Pending + Approved reservations for the same instrument _type_ (e.g. Drums), regardless of overlap in time. A series counts **each occurrence individually** (unlike limit #1).

- **Under limit:** User holds 1 active Drums reservation, submits a 2nd Drums request → evaluated normally.
- **At/over limit:** User holds 2 active Drums reservations, submits a 3rd → forced to Pending, even on an Instant Drums instrument.

---

### 5. Max Occurrences Per Series (`max_series_occurrences`, default 8)

Caps how many dates a single recurring series submission can contain.

- **Under limit:** User builds a series with 6 occurrences → submission allowed.
- **Over limit:** User builds a series with 10 occurrences → **submission blocked outright**, not downgraded — user must remove occurrences to proceed.

---

### 6. Submission Rate Limit (`max_submissions_per_hour`, default 10)

Counts all reservation submissions (single or series) by a user in a rolling 1-hour window.

- **Under limit:** User has submitted 6 reservations in the last hour, submits a 7th → allowed.
- **At/over limit:** User has submitted 10 reservations in the last hour, submits an 11th → **submission blocked outright**, must wait for the window to roll forward.

---

## Soft vs. Hard Caps

- Limits **1–4** (active, per-day, duration, concurrent-type) are **soft caps**: exceeding them never blocks submission — it just forces the result to Pending for admin review.
- Limits **5–6** (series occurrences, rate limit) are **hard caps**: exceeding them blocks submission entirely, since they exist to prevent spam/abuse rather than gate approval.