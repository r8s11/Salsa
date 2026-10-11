import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAnalytics } from "./analyticsRepo";
import { supabase } from "../../../lib/supabase";

vi.mock("../../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
const rpc = vi.mocked(supabase.rpc);
beforeEach(() => vi.clearAllMocks());

describe("analytics failure boundaries", () => {
  it("does not leak database details or substitute zero on denied access", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied: private submitter@example.com" } } as never);
    await expect(fetchAnalytics({ from: null, to: null })).rejects.toThrow(
      "Unable to load analytics. Please try again."
    );
  });
  it("treats missing RPC output as failure, not an empty platform", async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never);
    await expect(fetchAnalytics({ from: null, to: null })).rejects.toThrow("Unable to load analytics");
  });
  it("keeps a failed metric unavailable without discarding healthy metrics", async () => {
    rpc.mockResolvedValue({ data: { total_events: 3, upcoming_events: 0, registered_users: null,
      pending_submissions: 1, active_organizers: 0, events_by_city: [], as_of: "2026-10-11T12:00:00Z" }, error: null } as never);
    const result = await fetchAnalytics({ from: null, to: null });
    expect(result.metrics.registered_users).toBeNull();
    expect(result.metrics.total_events).toBe(3);
    expect(result.metrics.upcoming_events).toBe(0);
    expect(result.cities).toEqual([]);
  });
});
