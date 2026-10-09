import type { OrganizerMembership } from "../api/organizerAccessRepo";
import type { EntityMembership } from "../../workspaces/model";

/**
 * Effective Host access for the signed-in caller. Derived from three
 * independent sources:
 *
 *  - the coarse `app_metadata.role === "organizer"` claim,
 *  - active `organizer_members` rows (the membership path), and
 *  - managed entity listings (schools, venues, artists).
 *
 * Route guards, navigation, and page-level gates all read the same shape so
 * navigation can never disagree with authorization. The database (RLS plus
 * the RPCs) stays the source of truth for what each state may actually
 * change; this model only decides what we offer.
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
  /** Listings the caller manages (schools, venues, artists). */
  entityMemberships: EntityMembership[];
};

export function deriveHostCapabilities(input: {
  /** `app_metadata.role === "organizer"` — the legacy coarse claim. */
  isOrganizerRole: boolean;
  /** Active memberships from fetchMyOrganizers(). */
  memberships: OrganizerMembership[];
  /** Entity memberships from fetchMyEntityMemberships(). */
  entityMemberships?: EntityMembership[];
}): HostCapabilities {
  const { isOrganizerRole, memberships, entityMemberships = [] } = input;
  const hasOrganizerAccess = isOrganizerRole || memberships.length > 0;
  const hasHostAccess = hasOrganizerAccess || entityMemberships.length > 0;
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
    canManageOrganization: hasOrganizerAccess,
    entityMemberships,
  };
}
