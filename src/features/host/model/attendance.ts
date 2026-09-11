/**
 * Phase 5 — Host attendance types.
 *
 * Mirrors the event_attendees and event_check_ins table shapes.
 * No PII beyond what the door worker needs at the door.
 */

export type AttendeeCategory =
  | "registered"
  | "guest"
  | "comp"
  | "staff"
  | "performer"
  | "instructor"
  | "walk_in";

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
