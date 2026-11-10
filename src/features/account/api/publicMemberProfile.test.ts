import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPublicMemberProfile, parsePublicMemberProfile } from "./publicMemberProfile";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

beforeEach(() => {
  mocks.rpc.mockReset();
});

describe("parsePublicMemberProfile", () => {
  it("maps the allowlisted payload and treats a missing activity key as hidden", () => {
    const member = parsePublicMemberProfile({
      username: "maria",
      display_name: "Maria",
      dance_styles: ["salsa", 3],
      member_since: "2026-01",
    });
    expect(member).toMatchObject({
      username: "maria",
      displayName: "Maria",
      danceStyles: ["salsa"],
      avatarUrl: null,
      activity: null,
    });
  });

  it("reads activity only when it carries a count", () => {
    expect(
      parsePublicMemberProfile({ username: "maria", activity: { events_hosted: 0 } })?.activity
    ).toEqual({ eventsHosted: 0 });
  });

  it("returns null for a null payload and throws on a malformed one", () => {
    expect(parsePublicMemberProfile(null)).toBeNull();
    expect(() => parsePublicMemberProfile([])).toThrow();
    expect(() => parsePublicMemberProfile({ display_name: "No username" })).toThrow();
  });
});

describe("fetchPublicMemberProfile", () => {
  it("surfaces RPC errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(fetchPublicMemberProfile("maria")).rejects.toThrow("boom");
  });
});
