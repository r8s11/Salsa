# Host Phase 5 — Attendance and Check-In Data Foundation

Schema, RLS, and authorization foundation for future Host attendance,
guest-list, and check-in features. **No application code and no UI ships in
this phase.**

Nothing in this directory has been executed against production. Every file was
applied and exercised only against a disposable local Supabase stack.

---

## Manual execution order

Run in this exact order. Each file is safe to review independently.

| # | File | Required | Destructive |
|---|------|----------|-------------|
| 1 | `001_create_host_attendance_helpers.sql` | Yes | No |
| 2 | `002_create_event_attendees.sql` | Yes | No |
| 3 | `003_create_event_check_ins.sql` | Yes | No |
| 4 | `004_add_host_attendance_integrity.sql` | Yes | No |
| 5 | `005_add_host_attendance_indexes.sql` | Yes | No |
| 6 | `006_add_host_attendance_rls.sql` | Yes | No |
| 7 | `007_add_host_attendance_grants.sql` | Yes | No |
| — | `900_optional_rollback_host_attendance.sql` | No | **YES** |

Ordering rationale:

- `001` first: `006` policies reference `can_manage_event_attendance()`.
- `007` (grants) last: the tables are unreachable through the Data API until
  their policies exist, so there is no window where they are exposed
  unprotected.
- `900` is never part of a deploy. It drops both tables and destroys all
  attendance history.

`002` and `003` are **create-once** files. They use `create table if not
exists`, so re-running them is a no-op — but that also means their CHECK
constraints only land at creation time. If either table already exists with a
different shape, stop and reconcile deliberately rather than assuming a re-run
applied the constraints.

Files `001`, `004`, `005`, `006`, `007` are fully idempotent and were verified
by applying the whole set twice in a row with `ON_ERROR_STOP=1`.

---

## Data model

```
events (existing)
  └── event_attendees            unified roster, one row per person
        └── event_check_ins      append-only arrival history
```

`event_attendees` is a single unified roster rather than separate registration
and guest-list tables, because door mode needs one roster query, check-in needs
one foreign-key target, attendance is one aggregate, and public
self-registration does not exist in this product yet. The `source` column keeps
future registrations distinguishable without reshaping the roster.

`event_check_ins` stores `event_id` denormalized **and constrains it** via a
composite foreign key `(attendee_id, event_id)` referencing
`event_attendees(id, event_id)`. Denormalization without that constraint would
be a bug; with it, a cross-event check-in is structurally impossible.

### Category vs source

These are deliberately different axes and must not be conflated.

- `category` — who the person is to the event: `registered`, `guest`, `comp`,
  `staff`, `performer`, `instructor`, `walk_in`.
- `source` — how the entry was created: `host`, `door`, `future_registration`,
  `system`.

A future public registration is `category = 'registered'` with
`source = 'future_registration'`.

### Lifecycle

**Attendee:** created by an authorized Host (or at the door) → optionally
edited (name, notes, party size, category) → deleted **only** while it has no
check-in history. Once any check-in exists, the roster entry is permanent.
`event_id` and `created_by` are immutable for the row's whole life.

**Check-in:** recorded (`checked_in_at`, `checked_in_by`, `method`) → optionally
reversed (`reversed_at`, `reversed_by`, `reversal_reason`). Reversal is a state
change, never a delete, and it is one-way: a reversal cannot be cleared to hide
that it happened. Re-admitting someone means recording a **new** check-in row,
which the partial unique index permits precisely because the previous one is
reversed.

---

## Authorization

All attendance policies route through one predicate:

```sql
public.can_manage_event_attendance(p_event_id uuid)
```

which grants access when **either**:

- the caller is an Organizer (`app_metadata.role = 'organizer'`), owns the event
  (`events.submitter_id = auth.uid()`), the event is `approved`, and the
  caller's account is active; **or**
- the caller is an Admin (`is_admin()`, the existing repo-wide convention).

Moderators are deliberately excluded — no current product permission gives them
event-night operational access.

A plain registered user who merely submitted an approved event does **not**
qualify, because the organizer role is required. This was verified locally.

### Future: multiple door workers

`public.events` has **no** `organizer_id` column today; ownership is
`submitter_id` only. A `public.organizers` + `public.organizer_members` model
(roles `owner`/`manager`/`editor`, status `active`/`removed`) already exists but
is Admin-managed and unlinked to events.

When multi-worker door access is built, the change is confined to
`can_manage_event_attendance()`: add a branch accepting an active
`organizer_members` row once `events` gains an `organizer_id`. No table, index,
or policy needs to change. That containment is the main reason the predicate is
a function instead of inline policy SQL.

---

## Future TypeScript contract (documentation only — not implemented)

Phase 6 owns the application layer. These shapes are recorded here so the
schema and the future client agree.

```ts
export type HostAttendeeCategory =
  | "registered" | "guest" | "comp" | "staff"
  | "performer" | "instructor" | "walk_in";

export type HostAttendeeSource =
  | "host" | "door" | "future_registration" | "system";

export type HostCheckInMethod =
  | "manual" | "door" | "future_qr" | "future_self_check_in";

export interface HostAttendee {
  id: string;
  event_id: string;
  profile_id: string | null;
  display_name: string;
  email: string | null;
  category: HostAttendeeCategory;
  source: HostAttendeeSource;
  party_size: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface HostCheckIn {
  id: string;
  attendee_id: string;
  event_id: string;
  checked_in_at: string;
  checked_in_by: string;
  method: HostCheckInMethod;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  created_at: string;
}

/** Derived, not stored. Computed from the roster + active check-ins. */
export interface HostAttendanceSummary {
  eventId: string;
  rosterCount: number;
  expectedHeadcount: number;   // sum(party_size)
  checkedInCount: number;      // attendees with an active check-in
  byCategory: Record<HostAttendeeCategory, number>;
}
```

Future repository operations (Phase 6):

```ts
fetchHostAttendees(eventId: string): Promise<HostAttendee[]>;
addHostAttendee(eventId: string, input: NewHostAttendee): Promise<HostAttendee>;
updateHostAttendee(attendeeId: string, input: HostAttendeeEdit): Promise<void>;
removeHostAttendee(attendeeId: string): Promise<void>;   // only when never checked in
checkInAttendee(attendeeId: string): Promise<HostCheckIn>;
reverseCheckIn(checkInId: string, reason?: string): Promise<void>;
fetchHostAttendanceSummary(eventId: string): Promise<HostAttendanceSummary>;
```

Client-side notes for Phase 6:

- `created_by` / `checked_in_by` must be sent as the current user id. RLS
  rejects anything else, so do not attempt to omit them or pass a server
  default.
- Treat SQLSTATE `23505` on
  `event_check_ins_one_active_per_attendee_idx` as "already checked in", not as
  an error to surface raw. This is the double-tap / two-door-worker race.
- Treat `23503` on `event_check_ins_attendee_event_fkey` as a client bug
  (mismatched attendee/event pair), not a user-facing condition.
- `HostAttendanceSummary` is derived. Do not add stored counter columns; they
  would drift from the check-in history that is the source of truth.

---

## Not in scope for this phase

Capacity, waitlists, public self-registration, QR tokens, payments, tasks,
timeline, and any UI. `events.capacity` does not exist and was deliberately not
added.

How the model extends later without reshaping:

- **Capacity** — `events.capacity`, compared against
  `sum(party_size)` for admitted vs registered counts.
- **Waitlist** — either a `waitlist` category plus an ordering column, or a
  dedicated `event_registrations` table for booking/payment state that
  references the same roster.
- **QR check-in** — `method = 'future_qr'` is already an accepted value; token
  storage would be a separate table, never a column on the check-in row.

---

## Privacy and retention

Attendance is private operational data. `anon` holds no privilege and no policy
on either table, so it is unreachable from public event pages, anonymous Data
API calls, and unauthenticated Realtime.

Personal data is deliberately minimal: `display_name` is the only required
personal field. `email` is optional and never required for door entry. No phone
numbers, no payment details, no auth tokens, no profile snapshots. Unregistered
guests never get a fabricated profile row — `profile_id` stays null.

Retention is **documented, not automated**: attendance rows live as long as
their event row, and are removed with it (`on delete cascade`). If a retention
window is wanted later, the natural implementation is a scheduled job deleting
attendance for events older than N months. No such job is created here.
