import { describe, expect, it, vi } from "vitest";
import { fetchAnalytics } from "./analyticsRepo";

// Mock supabase
vi.mock("../../../lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "../../../lib/supabase";

describe("fetchAnalytics", () => {
  it("fetches metrics and time series in a single batch", async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockImplementation((fn: string) => {
      if (fn === "admin_analytics_metrics") {
        return {
          data: {
            published_events: 86,
            published_events_prev: 80,
            published_events_delta: 6,
            new_users: 42,
            new_users_prev: 38,
            new_users_delta: 4,
            rsvps: 318,
            rsvps_prev: 300,
            rsvps_delta: 18,
            submissions: 29,
            submissions_prev: 25,
            submissions_delta: 4,
          },
          error: null,
        };
      }
      if (fn === "admin_analytics_timeseries") {
        return {
          data: {
            events_by_week: [{ label: "Aug 4", value: 12 }],
            submissions_by_week: [{ label: "Aug 4", value: 3 }],
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const result = await fetchAnalytics({
      range: { from: new Date("2026-07-15"), to: new Date("2026-08-14") },
      granularity: "weekly",
    });

    expect(result.metrics.published_events.current).toBe(86);
    expect(result.metrics.new_users.current).toBe(42);
    expect(result.series.events[0].label).toBe("Aug 4");
    expect(result.series.events[0].value).toBe(12);
  });

  it("throws on RPC error for metrics", async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(
      fetchAnalytics({
        range: { from: new Date("2026-07-15"), to: new Date("2026-08-14") },
        granularity: "weekly",
      })
    ).rejects.toThrow("Failed to load analytics metrics");
  });
});
