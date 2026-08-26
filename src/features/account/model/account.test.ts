import { describe, expect, it } from "vitest";
import {
  resolveIdentity,
  initialsFor,
  memberSinceLabel,
  statusMessageFor,
  ROLE_LABEL,
  SAFE_NAME_FALLBACK,
} from "./account";

describe("resolveIdentity", () => {
  it("prefers display_name and shows @username underneath", () => {
    const identity = resolveIdentity({ display_name: "Maria Santos", username: "mariasalsa" });
    expect(identity).toEqual({
      name: "Maria Santos",
      usernameLine: "@mariasalsa",
      usernameMissing: false,
    });
  });

  it("flags a missing username when only display_name exists", () => {
    const identity = resolveIdentity({ display_name: "Maria Santos", username: null });
    expect(identity).toEqual({ name: "Maria Santos", usernameLine: null, usernameMissing: true });
  });

  it("falls back to @username as the name when display_name is empty", () => {
    const identity = resolveIdentity({ display_name: null, username: "mariasalsa" });
    expect(identity).toEqual({ name: "@mariasalsa", usernameLine: null, usernameMissing: false });
  });

  it("falls back to a safe generic name when both are empty, never the email", () => {
    const identity = resolveIdentity({ display_name: "", username: "" });
    expect(identity).toEqual({ name: SAFE_NAME_FALLBACK, usernameLine: null, usernameMissing: true });
  });

  it("trims whitespace-only display_name and username", () => {
    const identity = resolveIdentity({ display_name: "   ", username: "   " });
    expect(identity.name).toBe(SAFE_NAME_FALLBACK);
    expect(identity.usernameMissing).toBe(true);
  });
});

describe("initialsFor", () => {
  it("takes the first letter of the resolved name", () => {
    expect(initialsFor({ name: "Maria Santos", usernameLine: null, usernameMissing: false })).toBe("M");
  });

  it("skips a leading @ when the name is a username fallback", () => {
    expect(initialsFor({ name: "@mariasalsa", usernameLine: null, usernameMissing: false })).toBe("M");
  });
});

describe("memberSinceLabel", () => {
  it("formats a timestamp as a friendly month/year", () => {
    expect(memberSinceLabel("2026-03-15T00:00:00Z")).toBe("March 2026");
  });
});

describe("statusMessageFor", () => {
  it("returns null for active accounts", () => {
    expect(statusMessageFor("active")).toBeNull();
  });

  it("returns a contextual message for suspended accounts without exposing status_reason", () => {
    const message = statusMessageFor("suspended");
    expect(message?.title).toBe("Account suspended");
    expect(message?.body).not.toMatch(/reason/i);
  });

  it("returns a distinct message for flagged and banned accounts", () => {
    expect(statusMessageFor("flagged")?.title).toBe("Account flagged for review");
    expect(statusMessageFor("banned")?.title).toBe("Account banned");
  });
});

describe("ROLE_LABEL", () => {
  it("covers every production role with no fabricated values", () => {
    expect(ROLE_LABEL).toEqual({
      user: "User",
      moderator: "Moderator",
      organizer: "Organizer",
      admin: "Admin",
    });
  });
});
