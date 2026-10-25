import { describe, expect, it } from "vitest";
import { deriveHostCapabilities } from "./hostCapabilities";
import type { OrganizerMemberRole, OrganizerMembership } from "../api/organizerAccessRepo";
import type { EntityMembership } from "../../workspaces/model";

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

function entityMembership(overrides: Partial<EntityMembership> = {}): EntityMembership {
  return {
    kind: "school",
    id: "school-1",
    name: "Salsa Academy",
    slug: "salsa-academy",
    status: "active",
    city: "Boston",
    image_url: null,
    member_role: "owner",
    ...overrides,
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
      entityMemberships: [],
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
      entityMemberships: [],
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
      entityMemberships: [],
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
      entityMemberships: [],
    });
  });

  it("admits an entity member to Host access while withholder event authoring and org management", () => {
    const schoolMember = entityMembership({ kind: "school", id: "sch-1", member_role: "owner" });
    expect(
      deriveHostCapabilities({
        isOrganizerRole: false,
        memberships: [],
        entityMemberships: [schoolMember],
      })
    ).toEqual({
      hasHostAccess: true,
      canCreateEvents: false,
      canImportEvents: false,
      canManageOrganization: false,
      entityMemberships: [schoolMember],
    });
  });

  it("combines organizer and entity memberships", () => {
    const venueMember = entityMembership({ kind: "venue", id: "ven-1", member_role: "manager" });
    expect(
      deriveHostCapabilities({
        isOrganizerRole: false,
        memberships: [membership("owner")],
        entityMemberships: [venueMember],
      })
    ).toEqual({
      hasHostAccess: true,
      canCreateEvents: true,
      canImportEvents: true,
      canManageOrganization: true,
      entityMemberships: [venueMember],
    });
  });
});
