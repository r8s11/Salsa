import type { UserRole } from "./usersQuery";

export type OrganizerMemberRole = "owner" | "manager" | "editor";

export interface UserOrganizerMembership {
  organizer_id: string;
  organizer_name: string;
  organizer_slug: string | null;
  organizer_status: string;
  member_role: OrganizerMemberRole;
  member_status: "active" | "removed";
  event_count: number;
}

export interface OrganizerTeamMember {
  user_id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  account_status: string;
  member_role: OrganizerMemberRole;
  member_status: "active" | "removed";
}

export interface OrganizerTeam {
  organizer_id: string;
  organizer_name: string;
  organizer_status: string;
  members: OrganizerTeamMember[];
}

export interface AssignOrganizerMemberInput {
  userId: string;
  role: OrganizerMemberRole;
  /** Existing organizer. Exactly one of organizerId / newOrganizer is set. */
  organizerId?: string;
  newOrganizer?: { name: string; primary_city?: string };
}

export interface AssignOrganizerMemberResult {
  organizer_id: string;
  user_id: string;
  member_role: OrganizerMemberRole;
  outcome: "created" | "reactivated" | "role_changed" | "unchanged";
  previous_role: OrganizerMemberRole | null;
  organizer_created: boolean;
  user_platform_role: UserRole;
}

export const MEMBER_ROLES: OrganizerMemberRole[] = ["owner", "manager", "editor"];

export const MEMBER_ROLE_LABEL: Record<OrganizerMemberRole, string> = {
  owner: "Owner",
  manager: "Manager",
  editor: "Editor",
};

export const MEMBER_ROLE_ACCESS: Record<OrganizerMemberRole, string> = {
  owner: "Can create, edit, publish and delete this organizer's events.",
  manager: "Can create, edit, publish and delete this organizer's events.",
  editor: "Can view this organizer's events but cannot edit, publish or delete them.",
};

export type OrganizerAccessState =
  "configured" | "membership_missing" | "organizer_inactive" | "not_applicable";

export const ORGANIZER_ACCESS_LABEL: Record<
  Exclude<OrganizerAccessState, "not_applicable">,
  string
> = {
  configured: "Organizer access configured",
  membership_missing: "Organizer role assigned, membership missing",
  organizer_inactive: "Organizer inactive",
};

/** Access summary of one user from their platform role and memberships. */
export function organizerAccessState(
  role: UserRole | null,
  memberships: UserOrganizerMembership[]
): OrganizerAccessState {
  const active = memberships.filter((m) => m.member_status === "active");
  if (active.some((m) => m.organizer_status === "active")) return "configured";
  if (active.length > 0) return "organizer_inactive";
  return role === "organizer" ? "membership_missing" : "not_applicable";
}

export function activeMembershipCount(memberships: UserOrganizerMembership[]): number {
  return memberships.filter((m) => m.member_status === "active").length;
}

export function managedEventCount(memberships: UserOrganizerMembership[]): number {
  return memberships
    .filter((m) => m.member_status === "active" && m.organizer_status === "active")
    .reduce((total, m) => total + Number(m.event_count), 0);
}

export const INSUFFICIENT_PERMISSION_MESSAGE =
  "Insufficient permission. Only administrators can manage organizer access.";

/** Turns database errors into messages that say what to do next. */
export function organizerAccessErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/administrator role required|permission denied/i.test(message)) {
    return INSUFFICIENT_PERMISSION_MESSAGE;
  }
  return message || "Something went wrong. Try again.";
}
