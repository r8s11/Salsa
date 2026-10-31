import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchActiveLocations } from "./metrosRepo";

const { from, select } = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn() }));
vi.mock("../../../lib/supabase", () => ({ supabase: { from } }));

beforeEach(() => {
  from.mockReset().mockReturnValue({ select });
  select.mockReset();
});

describe("fetchActiveLocations", () => {
  it("fetches one aggregate public projection and preserves null parent inventory", async () => {
    select.mockResolvedValue({
      data: [
        { city: "new-york-city", sublocation: "queens", neighborhood: null, upcoming_event_count: 2 },
        { city: "boston", sublocation: null, neighborhood: "allston", upcoming_event_count: 1 },
      ],
      error: null,
    });
    await expect(fetchActiveLocations()).resolves.toEqual([
      { city: "new-york-city", subLocation: "queens", neighborhood: null, upcomingEventCount: 2 },
      { city: "boston", subLocation: null, neighborhood: "allston", upcomingEventCount: 1 },
    ]);
    expect(from).toHaveBeenCalledExactlyOnceWith("public_active_locations");
    expect(select).toHaveBeenCalledExactlyOnceWith("city, sublocation, neighborhood, upcoming_event_count");
  });

  it("returns verified empty inventory only on a successful empty response", async () => {
    select.mockResolvedValue({ data: [], error: null });
    await expect(fetchActiveLocations()).resolves.toEqual([]);
  });

  it("propagates lookup failure rather than disguising it as zero", async () => {
    select.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(fetchActiveLocations()).rejects.toThrow("offline");
  });
});
