import { describe, expect, it, vi } from "vitest";
import { fetchOwnProfile } from "./accountRepo";

const { maybeSingle, eq, select, from } = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  eq: vi.fn(),
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
