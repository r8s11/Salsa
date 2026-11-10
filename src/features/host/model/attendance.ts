/**
 * Phase 5 — Host attendance types.
 *
 * Mirrors the event_attendees and event_check_ins table shapes.
 * No PII beyond what the door worker needs at the door.
 */

export type AttendeeCategory =
  "registered" | "guest" | "comp" | "staff" | "performer" | "instructor" | "walk_in";

export type AttendeeSource = "host" | "door" | "future_registration" | "system";

export type CheckInMethod = "manual" | "door" | "future_qr" | "future_self_check_in";

export interface HostAttendee {
  id: string;
  eventId: string;
  profileId: string | null;
  displayName: string;
  email: string | null;
  category: AttendeeCategory;
  source: AttendeeSource;
  partySize: number;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HostCheckIn {
  id: string;
  attendeeId: string;
  eventId: string;
  checkedInAt: string;
  checkedInBy: string;
  method: CheckInMethod;
  reversedAt: string | null;
  reversedBy: string | null;
  reversalReason: string | null;
  createdAt: string;
}

export interface HostAttendeeInput {
  displayName: string;
  email?: string | null;
  category: AttendeeCategory;
  partySize?: number;
  notes?: string | null;
  profileId?: string | null;
}

export interface CheckInInput {
  attendeeId: string;
  method?: CheckInMethod;
}

export interface ReverseCheckInInput {
  checkInId: string;
  reversalReason?: string | null;
}

/* ── Shared form rules (add form on the roster, edit page) ── */

export const ATTENDEE_CATEGORY_OPTIONS: { value: AttendeeCategory; label: string }[] = [
  { value: "guest", label: "Guest" },
  { value: "comp", label: "Comp" },
  { value: "staff", label: "Staff" },
  { value: "performer", label: "Performer" },
  { value: "instructor", label: "Instructor" },
  { value: "registered", label: "Registered" },
  { value: "walk_in", label: "Walk-in" },
];

export const ATTENDEE_LIMITS = {
  nameMax: 120,
  emailMax: 300,
  notesMax: 500,
  partySizeMin: 1,
  partySizeMax: 20,
} as const;

export function clampPartySize(value: number): number {
  return Math.max(
    ATTENDEE_LIMITS.partySizeMin,
    Math.min(ATTENDEE_LIMITS.partySizeMax, Number(value) || ATTENDEE_LIMITS.partySizeMin)
  );
}

export function formatAttendeeCategory(c: AttendeeCategory): string {
  return c.charAt(0).toUpperCase() + c.slice(1).replace("_", " ");
}

/* ── Check-in counts ── */

export interface AttendanceCounts {
  /** Roster rows. */
  rosterEntries: number;
  /** Roster rows with an active (non-reversed) check-in. */
  checkedInEntries: number;
  /** Sum of party sizes across the roster. */
  headcount: number;
  /** Sum of party sizes across rows with an active check-in. */
  checkedInHeadcount: number;
}

export function summarizeAttendance(
  attendees: readonly HostAttendee[],
  checkIns: readonly HostCheckIn[]
): AttendanceCounts {
  const active = new Set(checkIns.filter((c) => !c.reversedAt).map((c) => c.attendeeId));
  const counts: AttendanceCounts = {
    rosterEntries: attendees.length,
    checkedInEntries: 0,
    headcount: 0,
    checkedInHeadcount: 0,
  };
  for (const a of attendees) {
    counts.headcount += a.partySize;
    if (active.has(a.id)) {
      counts.checkedInEntries += 1;
      counts.checkedInHeadcount += a.partySize;
    }
  }
  return counts;
}
