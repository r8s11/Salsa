import { supabase } from "../../../lib/supabase";
import type {
  AssignOrganizerMemberInput,
  AssignOrganizerMemberResult,
  OrganizerTeam,
  UserOrganizerMembership,
} from "../model/organizerAccess";

export async function fetchUserOrganizerMemberships(
  userId: string
): Promise<UserOrganizerMembership[]> {
  const { data, error } = await supabase.rpc("admin_user_organizer_memberships", {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as UserOrganizerMembership[];
}

export async function fetchOrganizerTeam(organizerId: string): Promise<OrganizerTeam> {
  const { data, error } = await supabase.rpc("admin_organizer_team", {
    p_organizer_id: organizerId,
  });
  if (error) throw new Error(error.message);
  return data as OrganizerTeam;
}

/** One transaction: optionally creates the organizer, then adds the membership. */
export async function assignOrganizerMember(
  input: AssignOrganizerMemberInput
): Promise<AssignOrganizerMemberResult> {
  const { data, error } = await supabase.rpc("admin_assign_organizer_member", {
    p_user_id: input.userId,
    p_organizer_id: input.organizerId ?? null,
    p_member_role: input.role,
    p_new_organizer: input.newOrganizer ?? null,
  });
  if (error) throw new Error(error.message);
  return data as AssignOrganizerMemberResult;
}

export async function setEventOrganizer(
  eventId: string,
  organizerId: string,
  confirmChange: boolean
): Promise<{ changed: boolean; previous_organizer_id: string | null }> {
  const { data, error } = await supabase.rpc("admin_set_event_organizer", {
    p_event_id: eventId,
    p_organizer_id: organizerId,
    p_confirm_change: confirmChange,
  });
  if (error) throw new Error(error.message);
  return data as { changed: boolean; previous_organizer_id: string | null };
}
