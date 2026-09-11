import { supabase } from "../../../lib/supabase";
import type {
  HostAttendee,
  HostCheckIn,
  HostAttendeeInput,
  CheckInInput,
  ReverseCheckInInput,
} from "../model/attendance";

/* ── Row shape from Supabase ── */

interface AttendeeRow {
  id: string;
  event_id: string;
  profile_id: string | null;
  display_name: string;
  email: string | null;
  category: string;
  source: string;
  party_size: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CheckInRow {
  id: string;
  attendee_id: string;
  event_id: string;
  checked_in_at: string;
  checked_in_by: string;
  method: string;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  created_at: string;
}

function projectAttendee(row: AttendeeRow): HostAttendee {
  return {
    id: row.id,
    eventId: row.event_id,
    profileId: row.profile_id,
    displayName: row.display_name,
    email: row.email,
    category: row.category as HostAttendee["category"],
    source: row.source as HostAttendee["source"],
    partySize: row.party_size,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function projectCheckIn(row: CheckInRow): HostCheckIn {
  return {
    id: row.id,
    attendeeId: row.attendee_id,
    eventId: row.event_id,
    checkedInAt: row.checked_in_at,
    checkedInBy: row.checked_in_by,
    method: row.method as HostCheckIn["method"],
    reversedAt: row.reversed_at,
    reversedBy: row.reversed_by,
    reversalReason: row.reversal_reason,
    createdAt: row.created_at,
  };
}

/* ── Read ── */

export async function fetchEventAttendees(eventId: string): Promise<HostAttendee[]> {
  const { data, error } = await supabase
    .from("event_attendees")
    .select("*")
    .eq("event_id", eventId)
    .order("category")
    .order("display_name");
  if (error) throw new Error(error.message);
  return ((data as unknown as AttendeeRow[] | null) ?? []).map(projectAttendee);
}

export async function fetchEventCheckIns(eventId: string): Promise<HostCheckIn[]> {
  const { data, error } = await supabase
    .from("event_check_ins")
    .select("*")
    .eq("event_id", eventId)
    .order("checked_in_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as unknown as CheckInRow[] | null) ?? []).map(projectCheckIn);
}

/* ── Mutate ── */

export async function addEventAttendee(
  eventId: string,
  input: HostAttendeeInput
): Promise<HostAttendee> {
  const { data, error } = await supabase
    .from("event_attendees")
    .insert({
      event_id: eventId,
      display_name: input.displayName.trim(),
      email: input.email?.trim() || null,
      category: input.category,
      party_size: input.partySize ?? 1,
      notes: input.notes?.trim() || null,
      profile_id: input.profileId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return projectAttendee(data as unknown as AttendeeRow);
}

export async function updateEventAttendee(
  attendeeId: string,
  updates: Partial<Pick<HostAttendeeInput, "displayName" | "email" | "category" | "partySize" | "notes">>
): Promise<HostAttendee> {
  const patch: Record<string, unknown> = {};
  if (updates.displayName !== undefined) patch.display_name = updates.displayName.trim();
  if (updates.email !== undefined) patch.email = updates.email?.trim() || null;
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.partySize !== undefined) patch.party_size = updates.partySize;
  if (updates.notes !== undefined) patch.notes = updates.notes?.trim() || null;

  const { data, error } = await supabase
    .from("event_attendees")
    .update(patch)
    .eq("id", attendeeId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return projectAttendee(data as unknown as AttendeeRow);
}

export async function deleteEventAttendee(attendeeId: string): Promise<void> {
  const { error } = await supabase
    .from("event_attendees")
    .delete()
    .eq("id", attendeeId);
  if (error) throw new Error(error.message);
}

export async function checkInAttendee(
  eventId: string,
  input: CheckInInput
): Promise<HostCheckIn> {
  const { data, error } = await supabase
    .from("event_check_ins")
    .insert({
      event_id: eventId,
      attendee_id: input.attendeeId,
      method: input.method ?? "manual",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return projectCheckIn(data as unknown as CheckInRow);
}

export async function reverseCheckIn(input: ReverseCheckInInput): Promise<HostCheckIn> {
  const { data, error } = await supabase
    .from("event_check_ins")
    .update({
      reversed_at: new Date().toISOString(),
      reversal_reason: input.reversalReason?.trim() || null,
    })
    .eq("id", input.checkInId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return projectCheckIn(data as unknown as CheckInRow);
}
