import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAnalytics, fetchAnalyticsTrends, fetchEntityPerformance, fetchEventEngagement } from "./analyticsRepo";
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

describe("insight failure boundaries", () => {
  it("keeps healthy sources available when one aggregate fails", async () => {
    rpc.mockResolvedValue({ data: { granularity: "daily", events: null,
      users: { current: 0, previous: null, total_accounts: 3, series: [] } }, error: null } as never);
    const result = await fetchAnalyticsTrends({ from: null, to: null }, "daily");
    expect(result.events).toBeNull();
    expect(result.users?.total_accounts).toBe(3);
    expect(result.users?.current).toBe(0);
  });
  it("sanitizes denied aggregation errors and rejects malformed top-level responses", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private auth detail" } } as never);
    await expect(fetchAnalyticsTrends({ from: null, to: null }, "monthly"))
      .rejects.toThrow("Unable to load insights. Please try again.");
    rpc.mockResolvedValue({ data: [], error: null } as never);
    await expect(fetchAnalyticsTrends({ from: null, to: null }, "monthly"))
      .rejects.toThrow("Unable to load insights. Please try again.");
  });
});

describe("event engagement query contract", () => {
  it("does not substitute an empty report when the authorized aggregation fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private event title" } } as never);
    await expect(fetchEventEngagement({ from: null, to: null }, "detail_views"))
      .rejects.toThrow("Unable to load event engagement. Please try again.");
  });
});

describe("entity intelligence failure boundaries", () => {
  const options = { organizerSort: "upcoming_events", venueSort: "upcoming_events", organizerOffset: 0, venueOffset: 0 } as const;
  it("sanitizes denied reports instead of exposing private details", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private invitation token" } } as never);
    await expect(fetchEntityPerformance({ from: null, to: null }, options))
      .rejects.toThrow("Unable to load entity intelligence. Please try again.");
  });
  it("keeps empty venue inventory available when organizers cannot aggregate", async () => {
    rpc.mockResolvedValue({ data: { organizers: null,
      venues: { total: 0, active: 0, created: 0, offset: 0, page_size: 25, rows: [] },
      quality: null, coverage: null, engagement_available: false }, error: null } as never);
    const result = await fetchEntityPerformance({ from: null, to: null }, options);
    expect(result.organizers).toBeNull();
    expect(result.venues?.total).toBe(0);
    expect(result.venues?.rows).toEqual([]);
  });
});
