import { describe, expect, it } from "vitest";
import { RECENTLY_APPROVED_WINDOW_MS, isRecentlyApproved } from "./recentlyApproved";

const now = Date.parse("2026-09-01T12:00:00Z");

function event(overrides: Partial<Parameters<typeof isRecentlyApproved>[0]> = {}) {
  return {
    createdAt: "2026-08-31T12:00:00Z",
    sourceType: "moderator" as const,
    ...overrides,
  };
}

describe("isRecentlyApproved", () => {
  it("accepts moderator-approved events inside the 72-hour window", () => {
    expect(isRecentlyApproved(event(), now)).toBe(true);
    expect(isRecentlyApproved(event({ createdAt: "2026-08-29T12:00:01Z" }), now)).toBe(true);
  });

  it("expires an event at exactly 72 hours", () => {
    const createdAt = new Date(now - RECENTLY_APPROVED_WINDOW_MS).toISOString();

    expect(isRecentlyApproved(event({ createdAt }), now)).toBe(false);
  });

  it("requires moderator provenance", () => {
    expect(isRecentlyApproved(event({ sourceType: "admin" }), now)).toBe(false);
    expect(isRecentlyApproved(event({ sourceType: "user_submission" }), now)).toBe(false);
  });

  it("rejects invalid and future approval timestamps", () => {
    expect(isRecentlyApproved(event({ createdAt: "not-a-date" }), now)).toBe(false);
    expect(isRecentlyApproved(event({ createdAt: "2026-09-01T12:00:01Z" }), now)).toBe(false);
  });
});
