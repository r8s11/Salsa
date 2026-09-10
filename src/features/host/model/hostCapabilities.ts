import type { OrganizerMembership } from "../api/organizerAccessRepo";

/**
 * Effective Host access for the signed-in caller. Derived from two
 * independent sources that both exist in production today:
 *
 *  - the coarse `app_metadata.role === "organizer"` claim, and
 *  - active `organizer_members` rows (the membership path).
 *
 * Route guards, navigation, and page-level gates all read the same shape so
 * navigation can never disagree with authorization. The database (RLS plus
 * the organizer RPCs) stays the source of truth for what each state may
 * actually change; this model only decides what we offer.
 */
export type HostCapabilities = {
  /** May enter the Host workspace at all. */
  hasHostAccess: boolean;
  /** Holds an active owner/manager membership somewhere. */
  canCreateEvents: boolean;
  /** Same membership requirement the CSV import path enforces. */
  canImportEvents: boolean;
  /** May reach the organization surface (read-only for editors). */
  canManageOrganization: boolean;
};

export function deriveHostCapabilities(input: {
  /** `app_metadata.role === "organizer"` — the legacy coarse claim. */
  isOrganizerRole: boolean;
  /** Active memberships from fetchMyOrganizers(). */
  memberships: OrganizerMembership[];
}): HostCapabilities {
  const { isOrganizerRole, memberships } = input;
  // Matches RequireOrganizer: either signal admits the workspace. Membership
  // rows are already filtered to status = "active" by fetchMyOrganizers.
  const hasHostAccess = isOrganizerRole || memberships.length > 0;
  // Creating and importing need a concrete active owner/manager membership —
  // the coarse role alone cannot satisfy the organizer_id these paths write,
  // which is exactly the filter HostCreateEventPage / HostEventImportPage
  // apply and the "active owner or manager" predicate the RPCs enforce.
  const canManage = memberships.some(
    (membership) =>
      membership.organizerStatus === "active" &&
      (membership.memberRole === "owner" || membership.memberRole === "manager")
  );

  return {
    hasHostAccess,
    canCreateEvents: canManage,
    canImportEvents: canManage,
    canManageOrganization: hasHostAccess,
  };
}
