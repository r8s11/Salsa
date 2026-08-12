import { describe, expect, it, vi } from "vitest";
import {
  applyUserFilters,
  applyUserSort,
  applyUserView,
  displayNameFor,
  identityLineFor,
  initialsFor,
  userViewCounts,
  rowActionItems,
  type AdminUserRow,
  type UserFilters,
} from "./usersQuery";

let nextId = 0;

function makeRow(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  nextId += 1;
  return {
    kind: "profile",
    id: `user-${nextId}`,
    user_id: `user-${nextId}`,
    email: `user${nextId}@example.com`,
    display_name: `User ${nextId}`,
    username: `user${nextId}`,
    avatar_url: null,
    role: "user",
    status: "active",
    status_reason: null,
    created_at: "2026-01-01T00:00:00.000Z",
    last_active_at: "2026-01-01T00:00:00.000Z",
    contributions: 0,
    pending_count: 0,
    email_confirmed_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const baseFilters: UserFilters = {
  q: "",
  role: [],
  status: [],
  kind: null,
  from: null,
  to: null,
};

describe("displayNameFor", () => {
  it("guest without a display name falls back to Guest Submitter", () => {
    const guest = makeRow({ kind: "guest", display_name: null });
    expect(displayNameFor(guest)).toBe("Guest Submitter");
  });

  it("guest with a display name uses it", () => {
    const guest = makeRow({ kind: "guest", display_name: "Vera Cruz" });
    expect(displayNameFor(guest)).toBe("Vera Cruz");
  });

  it("profile with a blank display name falls back to Unnamed account", () => {
    const profile = makeRow({ display_name: "   " });
    expect(displayNameFor(profile)).toBe("Unnamed account");
  });

  it("profile with a null display name falls back to Unnamed account", () => {
    const profile = makeRow({ display_name: null });
    expect(displayNameFor(profile)).toBe("Unnamed account");
  });

  it("profile with a trimmable display name is trimmed", () => {
    const profile = makeRow({ display_name: "  Roosevelt Segura  " });
    expect(displayNameFor(profile)).toBe("Roosevelt Segura");
  });
});

describe("identityLineFor", () => {
  it("guest rows always read No public profile", () => {
    const guest = makeRow({ kind: "guest", username: null });
    expect(identityLineFor(guest)).toBe("No public profile");
  });

  it("profile with a username shows @handle", () => {
    const profile = makeRow({ username: "mariasalsa" });
    expect(identityLineFor(profile)).toBe("@mariasalsa");
  });

  it("profile without a username shows No username set", () => {
    const profile = makeRow({ username: null });
    expect(identityLineFor(profile)).toBe("No username set");
  });
});

describe("initialsFor", () => {
  it("guest rows always return an empty string", () => {
    const guest = makeRow({ kind: "guest", display_name: "Vera Cruz" });
    expect(initialsFor(guest)).toBe("");
  });

  it("profile rows return the uppercased first letter of the display name", () => {
    const profile = makeRow({ display_name: "maria santos" });
    expect(initialsFor(profile)).toBe("M");
  });

  it("profile with no display name derives initials from the fallback", () => {
    const profile = makeRow({ display_name: null });
    expect(initialsFor(profile)).toBe("U");
  });
});

describe("applyUserView", () => {
  it("all includes every row", () => {
    const rows = [makeRow(), makeRow({ kind: "guest", role: null })];
    expect(applyUserView(rows, "all")).toEqual(rows);
  });

  it("registered excludes guest rows", () => {
    const profile = makeRow();
    const guest = makeRow({ kind: "guest", role: null });
    expect(applyUserView([profile, guest], "registered")).toEqual([profile]);
  });

  it("organizers matches role === organizer", () => {
    const organizer = makeRow({ role: "organizer" });
    const user = makeRow({ role: "user" });
    expect(applyUserView([organizer, user], "organizers")).toEqual([organizer]);
  });

  it("moderators matches role === moderator", () => {
    const moderator = makeRow({ role: "moderator" });
    const user = makeRow({ role: "user" });
    expect(applyUserView([moderator, user], "moderators")).toEqual([moderator]);
  });

  it("flagged matches status === flagged", () => {
    const flagged = makeRow({ status: "flagged" });
    const active = makeRow({ status: "active" });
    expect(applyUserView([flagged, active], "flagged")).toEqual([flagged]);
  });

  it("suspended matches status === suspended", () => {
    const suspended = makeRow({ status: "suspended" });
    const active = makeRow({ status: "active" });
    expect(applyUserView([suspended, active], "suspended")).toEqual([suspended]);
  });

  it("banned matches status === banned", () => {
    const banned = makeRow({ status: "banned" });
    const active = makeRow({ status: "active" });
    expect(applyUserView([banned, active], "banned")).toEqual([banned]);
  });

  it("guests matches kind === guest", () => {
    const guest = makeRow({ kind: "guest", role: null });
    const profile = makeRow();
    expect(applyUserView([guest, profile], "guests")).toEqual([guest]);
  });
});

describe("applyUserFilters", () => {
  it("q matches a substring of display_name, username, or email case-insensitively", () => {
    const maria = makeRow({
      display_name: "Maria Santos",
      username: "mariasalsa",
      email: "m@example.com",
    });
    const other = makeRow({
      display_name: "Someone Else",
      username: "someone",
      email: "s@example.com",
    });
    expect(applyUserFilters([maria, other], { ...baseFilters, q: "MARIA" })).toEqual([maria]);
    expect(applyUserFilters([maria, other], { ...baseFilters, q: "salsa" })).toEqual([maria]);
    expect(applyUserFilters([maria, other], { ...baseFilters, q: "m@example.com" })).toEqual([
      maria,
    ]);
  });

  it("whitespace-only q matches everything", () => {
    const rows = [makeRow(), makeRow()];
    expect(applyUserFilters(rows, { ...baseFilters, q: "   " })).toEqual(rows);
  });

  it("role is a membership check; empty array matches everything", () => {
    const organizer = makeRow({ role: "organizer" });
    const user = makeRow({ role: "user" });
    expect(applyUserFilters([organizer, user], { ...baseFilters, role: ["organizer"] })).toEqual([
      organizer,
    ]);
    expect(applyUserFilters([organizer, user], baseFilters)).toEqual([organizer, user]);
  });

  it("a guest row never matches a non-empty role filter", () => {
    const guest = makeRow({ kind: "guest", role: null });
    expect(applyUserFilters([guest], { ...baseFilters, role: ["user"] })).toEqual([]);
    expect(applyUserFilters([guest], baseFilters)).toEqual([guest]);
  });

  it("status is a membership check; empty array matches everything", () => {
    const flagged = makeRow({ status: "flagged" });
    const active = makeRow({ status: "active" });
    expect(applyUserFilters([flagged, active], { ...baseFilters, status: ["flagged"] })).toEqual([
      flagged,
    ]);
    expect(applyUserFilters([flagged, active], baseFilters)).toEqual([flagged, active]);
  });

  it("kind matches exactly when set", () => {
    const profile = makeRow();
    const guest = makeRow({ kind: "guest", role: null });
    expect(applyUserFilters([profile, guest], { ...baseFilters, kind: "guest" })).toEqual([guest]);
    expect(applyUserFilters([profile, guest], { ...baseFilters, kind: "profile" })).toEqual([
      profile,
    ]);
    expect(applyUserFilters([profile, guest], baseFilters)).toEqual([profile, guest]);
  });

  it("from/to bound the created_at calendar date inclusively", () => {
    const row = makeRow({ created_at: "2026-08-15T23:00:00.000Z" });
    expect(
      applyUserFilters([row], { ...baseFilters, from: "2026-08-15", to: "2026-08-15" })
    ).toEqual([row]);
    expect(
      applyUserFilters([row], { ...baseFilters, from: "2026-08-16", to: "2026-08-16" })
    ).toEqual([]);
    expect(
      applyUserFilters([row], { ...baseFilters, from: "2026-08-14", to: "2026-08-15" })
    ).toEqual([row]);
    expect(applyUserFilters([row], { ...baseFilters, from: "2026-08-16" })).toEqual([]);
    expect(applyUserFilters([row], { ...baseFilters, to: "2026-08-14" })).toEqual([]);
  });
});

describe("applyUserSort", () => {
  it("sorts by name case-insensitively", () => {
    const b = makeRow({ display_name: "banana" });
    const a = makeRow({ display_name: "Apple" });
    expect(applyUserSort([b, a], "name", "asc")).toEqual([a, b]);
    expect(applyUserSort([b, a], "name", "desc")).toEqual([b, a]);
  });

  it("sorts by joined (created_at)", () => {
    const earlier = makeRow({ created_at: "2026-01-01T00:00:00.000Z" });
    const later = makeRow({ created_at: "2026-06-01T00:00:00.000Z" });
    expect(applyUserSort([later, earlier], "joined", "asc")).toEqual([earlier, later]);
    expect(applyUserSort([earlier, later], "joined", "desc")).toEqual([later, earlier]);
  });

  it("sorts by active (last_active_at)", () => {
    const earlier = makeRow({ last_active_at: "2026-01-01T00:00:00.000Z" });
    const later = makeRow({ last_active_at: "2026-06-01T00:00:00.000Z" });
    expect(applyUserSort([later, earlier], "active", "asc")).toEqual([earlier, later]);
    expect(applyUserSort([earlier, later], "active", "desc")).toEqual([later, earlier]);
  });

  it("sorts by contributions numerically", () => {
    const few = makeRow({ contributions: 2 });
    const many = makeRow({ contributions: 10 });
    expect(applyUserSort([many, few], "contributions", "asc")).toEqual([few, many]);
    expect(applyUserSort([few, many], "contributions", "desc")).toEqual([many, few]);
  });

  it("is stable for equal keys", () => {
    const first = makeRow({ contributions: 5, created_at: "2026-01-01T00:00:00.000Z" });
    const second = makeRow({ contributions: 5, created_at: "2026-01-01T00:00:00.000Z" });
    const third = makeRow({ contributions: 5, created_at: "2026-01-01T00:00:00.000Z" });
    expect(applyUserSort([first, second, third], "contributions", "asc")).toEqual([
      first,
      second,
      third,
    ]);
    expect(applyUserSort([first, second, third], "joined", "desc")).toEqual([first, second, third]);
  });
});

describe("rowActionItems", () => {
  const currentUserId = "self-1";

  it("guest rows get only View Submissions", () => {
    const guest = makeRow({ kind: "guest", user_id: null, id: "guest:x@y.test" });
    const items = rowActionItems(guest, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual(["view-contributions"]);
    expect(items[0].label).toBe("View Submissions");
  });

  it("self row gets only View Contributions, regardless of status", () => {
    const self = makeRow({ user_id: currentUserId, status: "active" });
    const items = rowActionItems(self, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual(["view-contributions"]);
    expect(items[0].label).toBe("View Contributions");
  });

  it("the last remaining admin gets only View Contributions", () => {
    const soleAdmin = makeRow({ user_id: "other-1", role: "admin", status: "active" });
    const items = rowActionItems(soleAdmin, currentUserId, 1, vi.fn());
    expect(items.map((item) => item.id)).toEqual(["view-contributions"]);
  });

  it("active status offers Change Role, Flag, Suspend, Ban", () => {
    const active = makeRow({ user_id: "other-1", role: "user", status: "active" });
    const items = rowActionItems(active, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual([
      "view-contributions",
      "change-role",
      "flag",
      "suspend",
      "ban",
    ]);
  });

  it("flagged status offers Remove Flag instead of Flag", () => {
    const flagged = makeRow({ user_id: "other-1", status: "flagged" });
    const items = rowActionItems(flagged, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual([
      "view-contributions",
      "change-role",
      "unflag",
      "suspend",
      "ban",
    ]);
  });

  it("suspended status offers Restore and Ban only, no Change Role", () => {
    const suspended = makeRow({ user_id: "other-1", status: "suspended" });
    const items = rowActionItems(suspended, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual(["view-contributions", "restore", "ban"]);
  });

  it("banned status offers Restore only", () => {
    const banned = makeRow({ user_id: "other-1", status: "banned" });
    const items = rowActionItems(banned, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual(["view-contributions", "restore"]);
  });

  it("onAction receives the action id and the row when an item is selected", () => {
    const onAction = vi.fn();
    const active = makeRow({ user_id: "other-1", status: "active" });
    const items = rowActionItems(active, currentUserId, 2, onAction);
    items.find((item) => item.id === "flag")!.onSelect();
    expect(onAction).toHaveBeenCalledWith("flag", active);
  });
});
describe("userViewCounts", () => {
  it("counts each view over the unfiltered set", () => {
    const admin = makeRow({ role: "admin" });
    const organizer = makeRow({ role: "organizer" });
    const moderator = makeRow({ role: "moderator" });
    const flagged = makeRow({ status: "flagged" });
    const suspended = makeRow({ status: "suspended" });
    const banned = makeRow({ status: "banned" });
    const guest = makeRow({ kind: "guest", role: null });

    const rows = [admin, organizer, moderator, flagged, suspended, banned, guest];
    const counts = userViewCounts(rows);

    expect(counts.all).toBe(7);
    expect(counts.registered).toBe(6);
    expect(counts.organizers).toBe(1);
    expect(counts.moderators).toBe(1);
    expect(counts.flagged).toBe(1);
    expect(counts.suspended).toBe(1);
    expect(counts.banned).toBe(1);
    expect(counts.guests).toBe(1);
  });
});
