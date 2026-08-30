import { describe, expect, it, vi } from "vitest";
import { fetchOwnProfile, updateOwnProfile } from "./accountRepo";

const { maybeSingle, single, eq, update: updateOp, select, from } = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
  supabase: { from },
}));

describe("fetchOwnProfile", () => {
  it("selects the caller's own profile row by id", async () => {
    from.mockReturnValue({ select });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({
      data: { id: "user-1", display_name: "Maria", username: null, avatar_url: null,
        status: "active", status_reason: null, created_at: "2026-01-01T00:00:00Z" },
      error: null,
    });

    const result = await fetchOwnProfile("user-1");

    expect(from).toHaveBeenCalledWith("profiles");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(result?.display_name).toBe("Maria");
  });

  it("returns null when no profile row exists", async () => {
    from.mockReturnValue({ select });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await fetchOwnProfile("user-2");
    expect(result).toBeNull();
  });

  it("throws when supabase returns an error", async () => {
    from.mockReturnValue({ select });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({ data: null, error: { message: "RLS denied" } });

    await expect(fetchOwnProfile("user-3")).rejects.toThrow("RLS denied");
  });
});

describe("updateOwnProfile", () => {
  it("updates the caller's own profile row by id and returns the refreshed row", async () => {
    const updatedRow = { id: "user-1", display_name: "Maria L.", username: "maria99",
      avatar_url: "https://cdn.test/me.png", status: "active", status_reason: null,
      created_at: "2026-01-01T00:00:00Z" };
    from.mockReturnValue({ update: updateOp });
    updateOp.mockReturnValue({ eq });
    eq.mockReturnValue({ select });
    select.mockReturnValue({ single });
    single.mockResolvedValue({ data: updatedRow, error: null });

    const result = await updateOwnProfile("user-1", {
      display_name: "Maria L.",
      username: "maria99",
      avatar_url: "https://cdn.test/me.png",
    });

    expect(from).toHaveBeenCalledWith("profiles");
    expect(updateOp).toHaveBeenCalledWith({
      display_name: "Maria L.",
      username: "maria99",
      avatar_url: "https://cdn.test/me.png",
    });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(result).toEqual(updatedRow);
  });

  it("only sends the supplied fields so unrelated columns are preserved", async () => {
    from.mockReturnValue({ update: updateOp });
    updateOp.mockReturnValue({ eq });
    eq.mockReturnValue({ select });
    select.mockReturnValue({ single });
    single.mockResolvedValue({ data: {}, error: null });

    await updateOwnProfile("user-2", { display_name: "Renamed" });

    expect(updateOp).toHaveBeenCalledWith({ display_name: "Renamed" });
  });

  it("throws when supabase returns an error", async () => {
    from.mockReturnValue({ update: updateOp });
    updateOp.mockReturnValue({ eq });
    eq.mockReturnValue({ select });
    select.mockReturnValue({ single });
    single.mockResolvedValue({ data: null, error: { message: "RLS denied" } });

    await expect(updateOwnProfile("user-3", { display_name: "x" })).rejects.toThrow("RLS denied");
  });
});
