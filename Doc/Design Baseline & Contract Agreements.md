# Design Baseline & Contract Agreements

> **Scope:** All modals, cards, and forms in the Instrument Reservation System.  
> **Applies to:** `MyReservations`, `AdminPortal`, `EditReservationModal`, `ReservationDetailModal`, `ReservationFormModal`, `SeriesBuilderModal`, and any future components that join the reservation UI family.  
> **Version:** 1.0 — locked baseline.

---

## 1. Design tokens (do not drift)

### 1.1 Color palette

| Role               | Token                                                   | Usage                            |
| ------------------ | ------------------------------------------------------- | -------------------------------- |
| Surface background | `stone-50`                                              | Modal shell                      |
| Card surface       | `white`                                                 | Section cards, list rows         |
| Card border        | `stone-200`                                             | All cards, dividers              |
| Card shadow        | `shadow-2xs`                                            | Idle cards (hover → `shadow-xs`) |
| Header background  | `stone-900`                                             | Modal header bar                 |
| Header text        | `white` / `stone-400` (subtitle)                        | Header                           |
| Primary action     | `amber-800` → hover `amber-900` → active `amber-950`    | Submit, primary buttons          |
| Primary soft       | `amber-50` / `amber-100` (hover) / `amber-200` (border) | Secondary amber buttons          |
| Destructive        | `red-600` → hover `red-700` → active `red-800`          | Cancel/delete actions            |
| Destructive soft   | `red-50` / `red-100` (hover) / `red-200` (border)       | Cancel icon buttons              |
| Success            | `emerald-700` (primary) / `emerald-50` / `emerald-200`  | Approve, payment confirmation    |
| Warning            | `amber-600` / `amber-50` / `amber-200`                  | Pending, conflicts               |
| Info/Outside       | `purple-700` / `purple-50` / `purple-200`               | Outside-church pricing           |
| Error text         | `red-900` on `red-50` border `red-200`                  | Error banners                    |
| Muted text         | `stone-500`                                             | Labels, secondary meta           |
| Subtle text        | `stone-400`                                             | Hint text, tertiary              |
| Strong text        | `stone-900`                                             | Titles, primary values           |

**Rule:** No new colors. No `blue`, `indigo`, `teal`, `cyan`. Amber = primary, Stone = neutral, Purple = outside-church, Emerald = success, Red = destructive.

### 1.2 Radii

| Element                      | Radius                       |
| ---------------------------- | ---------------------------- |
| Modal shell (desktop)        | `rounded-3xl`                |
| Modal shell (mobile)         | `rounded-none` (full-screen) |
| Section cards                | `rounded-2xl`                |
| Inputs / selects / textareas | `rounded-xl`                 |
| Icon buttons (header)        | `rounded-full`               |
| Icon buttons (inline)        | `rounded-lg`                 |
| Badges / pills               | `rounded-full`               |
| Square chips                 | `rounded-md` / `rounded-lg`  |

**Rule:** Inputs are always `rounded-xl`. Cards are always `rounded-2xl`. Header icon buttons are `rounded-full`. Never mix.

### 1.3 Spacing (compact baseline)

| Element                   | Mobile                             | Desktop             |
| ------------------------- | ---------------------------------- | ------------------- |
| Modal outer padding       | `p-0`                              | `sm:p-4`            |
| Header padding            | `px-4 py-3`                        | `sm:px-5 sm:py-3.5` |
| Body padding              | `p-3.5`                            | `sm:p-5`            |
| Body vertical rhythm      | `space-y-3`                        | `sm:space-y-3.5`    |
| Section card padding      | `p-3`                              | `sm:p-3.5`          |
| Section card inner rhythm | `space-y-2.5`                      | —                   |
| Section header underline  | `border-b border-stone-100 pb-1.5` | —                   |
| Footer padding            | `p-3`                              | `sm:px-5 sm:pb-4`   |
| Footer button gap         | `gap-2`                            | `sm:gap-2.5`        |
| Grid gap (2-col)          | `gap-2.5`                          | —                   |
| Grid gap (4-col pills)    | `gap-1.5`                          | —                   |

**Rule:** Desktop gets **at most** one step more space than mobile. Never `p-6` + `space-y-5` on the body — that's the "old big" look.

### 1.4 Typography

| Element               | Class                                        |
| --------------------- | -------------------------------------------- |
| Modal title           | `text-[13px] sm:text-sm font-bold`           |
| Modal subtitle        | `text-[10px] sm:text-[11px]`                 |
| Section header        | `text-[11px] sm:text-xs font-bold`           |
| Section header icon   | `w-3.5 h-3.5`                                |
| Label                 | `text-[11px] sm:text-xs font-bold`           |
| Input text            | `text-xs sm:text-[13px] font-medium`         |
| Body text             | `text-[11px] sm:text-xs`                     |
| Meta / hint           | `text-[10px]`                                |
| Badge text            | `text-[9px]` (square) / `text-[10px]` (pill) |
| Button text           | `text-[11px] sm:text-xs font-bold`           |
| Footer primary button | `text-[11px] sm:text-xs font-bold`           |
| Mono (IDs, times)     | `font-mono` with same size                   |

**Rule:** No `text-sm` body text on desktop forms. Desktop body is `text-[13px]` max. `text-base` is reserved for titles and receipts only.

### 1.5 Icon sizes

| Context                              | Size                                    |
| ------------------------------------ | --------------------------------------- |
| Section header icon                  | `w-3.5 h-3.5`                           |
| Inline button icon                   | `w-3.5 h-3.5`                           |
| Header modal icon (inside amber box) | `w-4.5 h-4.5`                           |
| Header modal icon box                | `w-9 h-9`                               |
| Avatar / instrument photo (hero)     | `w-12 h-12` (form) / `w-10 h-10` (card) |
| Small avatar / badge icon            | `w-3 h-3`                               |
| Full-width collapse chevron          | `w-3.5 h-3.5`                           |

**Rule:** No `w-5 h-5` icons except inside `w-10 h-10` amber boxes on receipt hero cards.

### 1.6 Input sizing

All form controls (`<input>`, `<select>`, `<textarea>`):

```
px-2.5 py-1.5  text-xs sm:text-[13px]  font-medium
bg-stone-50  border border-stone-300  rounded-xl
focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800
transition
```

- Selects add `appearance-none pr-8 cursor-pointer` + chevron `w-3 h-3`.
- Textareas add `resize-none overflow-hidden` (auto-grow) or `resize-none` (fixed).
- Height: ~32px desktop, ~30px mobile.

**Rule:** No `px-3 py-2` (too tall). No `rounded-2xl` inputs. No `text-sm` on desktop inputs.

### 1.7 Buttons

#### Primary
```
bg-amber-800 hover:bg-amber-900 active:bg-amber-950
text-white text-[11px] sm:text-xs font-bold
py-2 sm:py-2.5 px-4 sm:px-5 rounded-2xl
shadow-md active:scale-[0.99]
```

#### Secondary (stone)
```
bg-stone-100 hover:bg-stone-200 active:bg-stone-300
text-stone-700 text-[11px] sm:text-xs font-bold
py-2 sm:py-2.5 px-3.5 sm:px-4 rounded-2xl
```

#### Destructive
```
bg-red-600 hover:bg-red-700 active:bg-red-800
text-white text-[11px] sm:text-xs font-bold
py-2 sm:py-2.5 px-4 rounded-2xl
```

#### Icon button (header)
```
w-9 h-9 sm:w-10 sm:h-10 rounded-full
bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700
```

#### Icon button (inline small)
```
w-6 h-6 sm:w-7 sm:h-7 rounded-lg
border text-[10px]
```

**Disabled state (always the same):**
```
bg-stone-300 cursor-not-allowed text-stone-500 shadow-none
```

---

## 2. Structural agreements

### 2.1 Modal shell (every modal)

```tsx
<div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4">
  <div className="bg-stone-50 sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
    {/* header */}
    {/* body */}
    {/* footer */}
  </div>
</div>
```

**Contract:**
- **Width is `sm:max-w-xl` for all form modals.** Never `max-w-2xl`. Never switches widths between views.
- Mobile: full-screen, no rounded corners, no border.
- Desktop: `rounded-3xl`, `border`, `max-h-[90vh]`.
- Bottom safe-area padding always present.
- Backdrop: `bg-stone-900/60 backdrop-blur-xs`.

### 2.2 Header bar (every modal)

```tsx
<div className="shrink-0 bg-stone-900 text-white px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between border-b border-stone-800">
  <div className="flex items-center gap-3 min-w-0">
    <div className="w-9 h-9 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
      {/* icon */}
    </div>
    <div className="min-w-0">
      <h2 className="text-[13px] sm:text-sm font-bold text-white leading-tight truncate">{title}</h2>
      <p className="text-[10px] sm:text-[11px] text-stone-400 truncate mt-0.5">{subtitle}</p>
    </div>
  </div>
  <button className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 flex items-center justify-center">
    <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
  </button>
</div>
```

**Contract:** Header is always `stone-900` background. Icon is always amber `w-9 h-9 rounded-2xl`. Title is `text-[13px] sm:text-sm`. Subtitle is `text-[10px] sm:text-[11px] text-stone-400`. Close is a round stone icon button.

### 2.3 Section card (every form / list section)

```tsx
<div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
  <div className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
    <Icon className="w-3.5 h-3.5 text-amber-800" />
    <span>{sectionTitle}</span>
  </div>
  {/* fields */}
</div>
```

**Contract:**
- Background is always `white`, not `stone-50`. Exception: receipt summary cards use `bg-stone-50`.
- Padding is `p-3 sm:p-3.5`.
- Border is `border-stone-200`.
- Shadow is `shadow-2xs`.
- Every section header uses a `w-3.5 h-3.5` amber icon + `border-b border-stone-100 pb-1.5` divider.
- Body rhythm is `space-y-2.5`.

### 2.4 Footer (every modal)

```tsx
<div className="shrink-0 flex items-center gap-2 sm:gap-2.5 p-3 sm:px-5 sm:pb-4 border-t border-stone-200 bg-white shadow-xs">
  <button className="py-2 sm:py-2.5 px-3.5 sm:px-4 bg-stone-100 ... rounded-2xl ...">{cancel}</button>
  <button className="flex-1 py-2 sm:py-2.5 px-4 sm:px-5 bg-amber-800 ... rounded-2xl ...">{submit}</button>
</div>
```

**Contract:**
- Cancel button is always stone (`bg-stone-100`), not transparent.
- Submit button is always `bg-amber-800`, disabled → `bg-stone-300 text-stone-500 shadow-none`.
- Buttons are `py-2 sm:py-2.5`, never `py-3`.
- Icons in footer buttons are `w-3.5 h-3.5`.

### 2.5 Receipt / confirmation view

```tsx
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-3.5 bg-white">
  {/* status hero card — emerald (all approved) or amber (pending) */}
  {/* receipt summary — bg-stone-50 p-3.5 sm:p-4 space-y-2.5 */}
  {/* per-occurrence breakdown */}
</div>
```

**Contract:** Same body padding as form view. Status hero is `p-3.5 sm:p-4`, icon `w-9 h-9`, title `text-sm sm:text-[15px]`. Summary grid is `bg-stone-50 border-stone-200 rounded-2xl p-3.5 sm:p-4`.

### 2.6 Confirmation overlay (cancel / reject / destructive)

```tsx
<div className="fixed inset-0 z-[130] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
  <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-md w-full shadow-xl space-y-4">
    {/* icon + title row */}
    {/* body */}
    {/* actions: stone cancel + red confirm */}
  </div>
</div>
```

**Contract:** Centered, never full-screen on desktop. Container is `rounded-2xl`, `p-6`, `max-w-md` or `max-w-sm`. Confirm is always red for destructive.

---

## 3. Behavioral contracts

### 3.1 Completed reservation — locked everywhere

**A completed reservation (`status === "completed"`) MUST NOT be editable by any path.**

| Entry point                                                | Required guard                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `MyReservations` single card Edit button                   | `!isPast && !isCancelled && res.status !== "completed"`                                                |
| `MyReservations` series header Edit button                 | already gated via `.some(occ => !["cancelled","rejected","completed","expired"].includes(occ.status))` |
| `MyReservations` series per-occurrence Edit pencil         | `!isOccPast && !isOccCancelled && occ.status !== "completed"`                                          |
| `ReservationDetailModal` header Edit button                | `(!isPast                                                                                              |  | isAdminViewer) && (!isCancelled    |  | isAdminViewer) && !isCompleted`               |
| `ReservationDetailModal` series per-occurrence Edit pencil | `(!isPastOcc                                                                                           |  | isAdminViewer) && (!isCancelledOcc |  | isAdminViewer) && occ.status !== "completed"` |
| `ReservationDetailModal` "Edit Entire Series" link         | `(!isPast                                                                                              |  | isAdminViewer) && (!isCancelled    |  | isAdminViewer) && !isCompleted`               |
| `ReservationDetailModal` cancel buttons                    | `canCancelNow = !isPast && !isCancelled && !isCompleted`                                               |
| `ReservationDetailModal` full-day transform                | `isAdminViewer && !isFullDay && !isPast && !isCancelled && !isCompleted`                               |
| `ReservationDetailModal` condition-check "Update"          | `conditionCheckWindowOpen && !isCompleted`                                                             |
| `EditReservationModal` (defense in depth)                  | if `reservation.status === "completed"` → render locked notice instead of form                         |
| **Server** `editReservation()`                             | `if (existing.status === "completed") throw new Error("Completed reservations cannot be edited.")`     |
| **Server** `editReservationSeries()`                       | skip/filter occurrences whose `status === "completed"`                                                 |

**Rule:** The client hides the buttons AND the server rejects the request. No path allows editing a completed reservation.

### 3.2 Admin badge

**Every "admin booked" indicator uses `Shield` + `t("common.adminBooked")`, primary color, no pill, no logo.**

```tsx
<div className="text-[11px] text-amber-800 font-semibold flex items-start gap-1 min-w-0">
  <Shield className="w-3 h-3 shrink-0 mt-0.5" />
  <span className="break-words min-w-0">{t("common.adminBooked")}</span>
</div>
```

**Contract:** No `<img src="/logo.png" />` anywhere. No admin name in the badge. No pill/background. Just the shield + label. Applies to:
- Single reservation card
- Series card
- `ReservationDetailModal` summary card
- `EditReservationModal` (if it ever shows one)
- `AdminPortal` review cards (replaces the amber name pill)

### 3.3 Time-under-date in occurrence rows

Occurrence rows in series lists (both `MyReservations` expanded panel and `ReservationDetailModal` series breakdown) show:

```
bold date
small stone-500 time range
```

**Contract:** Never inline date+time on the same line in occurrence rows. The parent series header may show a compact `date (time)` on one line — that's the card-level summary, not the per-occurrence row.

### 3.4 Date shifting (EditReservationModal)

**Only "Change weekday" is offered.** No "Keep dates", no "Shift by ± days".

- `shiftType` defaults to `"weekday"`.
- Weekday picker is a 7-column grid.
- Preview shows **dates only** (no times) — matches the fact that only the date shifts.
- Preview rows: `#N oldDate → newDate`, past-shifted rows are rose-highlighted.

**Contract:** If date shifting changes, it must remain a **date-only** operation. Times stay identical across all occurrences.

### 3.5 Single-edit form layout (EditReservationModal, non-series)

Order **must** be:

1. Instrument selector
2. Purpose & Musician (grouped in one card)
3. Date + time-range preview (2-col grid)
4. Start time + duration (2-col grid)
5. Usage type (in-church / outside-church)
6. Fee acknowledgment (only if outside-church)

**Contract:** No other order allowed. The user must see the instrument, purpose, and date/time in the first viewport without scrolling on desktop.

### 3.6 Edit button placement (ReservationDetailModal)

| Position                               | Purpose                                     |
| -------------------------------------- | ------------------------------------------- |
| Header (top-right, next to Close)      | Edit entire reservation (single occurrence) |
| Series breakdown per-occurrence pencil | Edit that occurrence only                   |
| Series breakdown footer link           | Edit entire series                          |

**Contract:** No other Edit entry points. Header Edit is hidden for `completed`. Per-occurrence pencil is hidden for `completed` occurrences. Series link is hidden for `completed` root reservation.

### 3.7 Weekday pattern badge

Series cards show the pattern badge in `MyReservations`. **Weekly patterns render as amber (`bg-amber-100 text-amber-900 border border-amber-300`).** Non-weekly patterns render as neutral stone.

```tsx
className={`... ${String(sg.patternType).toLowerCase() === "weekly" ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-stone-100 text-stone-700"}`}
```

### 3.8 Season / pattern badge text

- MyReservations: `Weekly · N dates` (via `patternSuffix` + `sessionsSeriesBadge` translation keys — but count is now shown in the collapse toggle, not a separate badge).
- Receipt: `Weekly (N dates)` — count comes from `admin.review.datesCount` which injects its own `{{count}}`. Never render `{totalCount}` **and** the translation's `{{count}}` — that produces "4 4 dates".

**Contract:** Pick one source of truth for the count in the receipt pattern line.

---

## 4. i18n contract

### 4.1 Required keys

The following keys **must exist** in both `en.json` and `ar.json` (defaults provided fallback):

| Key                                  | Default (en)                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `editReservation.lockedTitle`        | "Reservation Completed"                                                                                                      |
| `editReservation.lockedSubtitle`     | "This reservation can no longer be edited."                                                                                  |
| `editReservation.lockedBody`         | "Completed reservations are locked for record integrity. If you need to make changes, please contact church administration." |
| `editReservation.errCompletedLocked` | "Completed reservations cannot be edited."                                                                                   |
| `common.adminBooked`                 | "Admin Booked"                                                                                                               |
| `myReservations.editSession`         | "Edit Session"                                                                                                               |
| `myReservations.editSessionTooltip`  | "Edit this session"                                                                                                          |
| `myReservations.editSelected`        | "Edit"                                                                                                                       |
| `myReservations.cancelSelected`      | "Cancel"                                                                                                                     |
| `admin.review.datesCount`            | `"{{count}} dates"`                                                                                                          |
| `admin.review.datesCount_plural`     | `"{{count}} dates"`                                                                                                          |

### 4.2 RTL rules

- Modals set `dir={isAr ? "rtl" : "ltr"}` on the inner container, not the backdrop.
- Chevron direction: `-rotate-90` (RTL) / `rotate-90` (LTR) on `<ChevronRight>` selects.
- Arrow direction: `rotate-180` on `<ArrowRight>` in RTL.
- Toggle translations: `translate-x-5 rtl:-translate-x-5` on slide toggles.

---

## 5. Motion & transition contract

| Element        | Class                                        |
| -------------- | -------------------------------------------- |
| Modal appear   | `animate-in fade-in zoom-in-95 duration-150` |
| Section expand | `animate-in fade-in duration-150`            |
| Inline notice  | `animate-in fade-in`                         |
| Hover state    | `transition` (default 150ms)                 |
| Active press   | `active:scale-[0.98]` on touch buttons       |
| Spinner        | `animate-spin`                               |

**Contract:** No bounce, no slide-in from bottom except bottom sheets. Every animation stays under 200ms.

---

## 6. Accessibility contract

- Every icon-only button has `aria-label` or `title`.
- Modal backdrop has `role="dialog"` + `aria-modal="true"`.
- Escape closes the outermost open layer (modal → cancel prompt → more menu → screenshot confirm → instrument details → close modal).
- Focus returns to the triggering element after close (handled by parent).
- Disabled submit buttons remain focusable and readable (`text-stone-500` on `bg-stone-300`).
- Contrast: `text-stone-700` on `bg-stone-50` for form labels, `text-stone-900` on `white` for values.
- Touch targets: minimum 32px mobile, 40px for primary/secondary footer buttons.

---

## 7. File ownership map

| Concern                                     | File                                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Modal shell, header, footer                 | `EditReservationModal.tsx`, `ReservationFormModal.tsx`, `SeriesBuilderModal.tsx`, `ReservationDetailModal.tsx` |
| Reservation list cards (single + series)    | `MyReservations.tsx`                                                                                           |
| Admin review cards, stat cards, dashboard   | `AdminPortal.tsx`                                                                                              |
| Series builder flow                         | `SeriesBuilderModal.tsx`                                                                                       |
| Detail view, chat, condition check, payment | `ReservationDetailModal.tsx`                                                                                   |
| Status colors                               | `src/lib/status-colors.ts`                                                                                     |
| Date utils                                  | `src/lib/date-utils.ts`                                                                                        |
| Baseline tokens (source of truth)           | **This document**                                                                                              |

---

## 8. Forbidden patterns

❌ `<img src="/logo.png" />` in any admin badge  
❌ `sm:max-w-2xl` on form modals  
❌ `p-6` + `space-y-5` on modal bodies  
❌ `text-sm` on desktop inputs  
❌ `rounded-2xl` inputs  
❌ `px-3 py-2` inputs (too tall)  
❌ `py-3` footer buttons  
❌ `max-w-2xl` ↔ `max-w-xl` width jump between form and receipt  
❌ Sizing a `w-5 h-5` icon inside a `w-9 h-9` amber box  
❌ Mixing `bg-stone-50` section cards with `bg-white` section cards in the same modal  
❌ Showing an Edit button (any form) on a `completed` reservation  
❌ Allowing `PUT /api/reservations/:id` on a `completed` reservation  
❌ Both `{totalCount}` and `t("admin.review.datesCount", {count})` in the same string  
❌ Any `blue` / `indigo` / `teal` / `cyan` color  
❌ Off-palette amber (must be `amber-50/100/200/600/700/800/900/950` only)  
❌ Inline date+time in occurrence rows (must be stacked)  
❌ "Keep dates" or "Shift by ± days" options in date shifting

---

## 9. Acceptance checklist (per PR)

Before merging any change to a modal or card, verify:

- [ ] Modal is `sm:max-w-xl` (forms) or `sm:max-w-md` (confirmation overlays)
- [ ] Header uses `stone-900` + amber `w-9 h-9 rounded-2xl` icon
- [ ] Section cards use `bg-white rounded-2xl p-3 sm:p-3.5 shadow-2xs`
- [ ] Every section header has amber `w-3.5 h-3.5` icon + `border-b border-stone-100 pb-1.5`
- [ ] Inputs use `px-2.5 py-1.5 text-xs sm:text-[13px] rounded-xl`
- [ ] Footer buttons use `py-2 sm:py-2.5` and `text-[11px] sm:text-xs`
- [ ] Completed reservations have no Edit entry point anywhere
- [ ] Admin badge is `Shield` + `t("common.adminBooked")`, no logo, no name
- [ ] Occurrence rows stack date over time
- [ ] No `/logo.png` in the diff
- [ ] No `sm:max-w-2xl` in the diff
- [ ] No `text-sm` body text on desktop
- [ ] Escape closes every nested layer in order
- [ ] Arabic (`dir="rtl"`) renders correctly with mirrored chevrons and arrows
- [ ] `en.json` and `ar.json` both updated for any new string

---

*This baseline supersedes all previous design agreements. Any deviation requires a documented exception in the PR description.*