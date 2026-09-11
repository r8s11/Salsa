import { describe, expect, it } from "vitest";
import { deriveHostCapabilities } from "./hostCapabilities";
import type {
  OrganizerMemberRole,
  OrganizerMembership,
} from "../api/organizerAccessRepo";

function membership(
  memberRole: OrganizerMemberRole,
  organizerStatus = "active"
): OrganizerMembership {
  return {
    organizerId: `org-${memberRole}`,
    organizerName: "Boston Salsa Collective",
    organizerSlug: "boston-salsa",
    organizerStatus,
    memberRole,
    description: null,
    logoUrl: null,
    website: null,
    instagram: null,
    organizerType: null,
    primaryCity: null,
  };
}

describe("deriveHostCapabilities", () => {
  it("admits a membership-only host with no coarse organizer role", () => {
    expect(
      deriveHostCapabilities({ isOrganizerRole: false, memberships: [membership("owner")] })
    ).toEqual({
      hasHostAccess: true,
      canCreateEvents: true,
      canImportEvents: true,
      canManageOrganization: true,
    });
  });

  it("admits the legacy organizer role with no membership but withholds create/import", () => {
    // The create and import paths must resolve a concrete organizer_id from
    // an active owner/manager membership; the role claim cannot supply one.
    expect(deriveHostCapabilities({ isOrganizerRole: true, memberships: [] })).toEqual({
      hasHostAccess: true,
      canCreateEvents: false,
      canImportEvents: false,
      canManageOrganization: true,
    });
  });

  it("treats manager memberships as authoring memberships", () => {
    const capabilities = deriveHostCapabilities({
      isOrganizerRole: false,
      memberships: [membership("manager")],
    });

    expect(capabilities.canCreateEvents).toBe(true);
    expect(capabilities.canImportEvents).toBe(true);
  });

  it("gives an editor membership host access without authoring rights", () => {
    expect(
      deriveHostCapabilities({ isOrganizerRole: false, memberships: [membership("editor")] })
    ).toEqual({
      hasHostAccess: true,
      canCreateEvents: false,
      canImportEvents: false,
      canManageOrganization: true,
    });
  });

  it("ignores authoring rights on a non-active organizer", () => {
    const capabilities = deriveHostCapabilities({
      isOrganizerRole: false,
      memberships: [membership("owner", "suspended")],
    });

    expect(capabilities.hasHostAccess).toBe(true);
    expect(capabilities.canCreateEvents).toBe(false);
  });

  it("grants authoring rights when any one membership qualifies", () => {
    const capabilities = deriveHostCapabilities({
      isOrganizerRole: false,
      memberships: [membership("editor"), membership("owner")],
    });

    expect(capabilities.canCreateEvents).toBe(true);
  });

  it("denies everything without a role or a membership", () => {
    expect(deriveHostCapabilities({ isOrganizerRole: false, memberships: [] })).toEqual({
      hasHostAccess: false,
      canCreateEvents: false,
      canImportEvents: false,
      canManageOrganization: false,
    });
  });
});
