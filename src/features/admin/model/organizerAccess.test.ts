import { describe, expect, it } from "vitest";
import {
  INSUFFICIENT_PERMISSION_MESSAGE,
  managedEventCount,
  organizerAccessErrorMessage,
  organizerAccessState,
  type UserOrganizerMembership,
} from "./organizerAccess";

const membership = (over: Partial<UserOrganizerMembership> = {}): UserOrganizerMembership => ({
  organizer_id: "o1",
  organizer_name: "Rob — Boston",
  organizer_slug: "rob-boston",
  organizer_status: "active",
  member_role: "owner",
  member_status: "active",
  event_count: 2,
  ...over,
});

describe("organizerAccessState", () => {
  it("is missing when an organizer-role user has no membership", () => {
    expect(organizerAccessState("organizer", [])).toBe("membership_missing");
  });
  it("ignores removed memberships", () => {
    expect(organizerAccessState("organizer", [membership({ member_status: "removed" })])).toBe(
      "membership_missing"
    );
  });
  it("is configured with an active membership on an active organizer", () => {
    expect(organizerAccessState("organizer", [membership()])).toBe("configured");
  });
  it("is inactive when every active membership is on a non-active organizer", () => {
    expect(organizerAccessState("organizer", [membership({ organizer_status: "archived" })])).toBe(
      "organizer_inactive"
    );
  });
  it("has nothing to say for users without the role or memberships", () => {
    expect(organizerAccessState("user", [])).toBe("not_applicable");
  });
});

describe("managedEventCount", () => {
  it("counts events of active memberships on active organizers only", () => {
    expect(
      managedEventCount([
        membership({ event_count: 2 }),
        membership({ organizer_id: "o2", event_count: 5, organizer_status: "archived" }),
        membership({ organizer_id: "o3", event_count: 7, member_status: "removed" }),
      ])
    ).toBe(2);
  });
});

describe("organizerAccessErrorMessage", () => {
  it("replaces permission errors with an actionable message", () => {
    expect(organizerAccessErrorMessage(new Error("Administrator role required"))).toBe(
      INSUFFICIENT_PERMISSION_MESSAGE
    );
    expect(organizerAccessErrorMessage(new Error("permission denied for table x"))).toBe(
      INSUFFICIENT_PERMISSION_MESSAGE
    );
  });
  it("passes through the database's own guidance", () => {
    expect(
      organizerAccessErrorMessage(new Error("Organizer is archived and cannot receive events."))
    ).toBe("Organizer is archived and cannot receive events.");
  });
});
