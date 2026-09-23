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
            event_views: 512,
            event_views_prev: 470,
            event_views_delta: 42,
            rsvp_clicks: 97,
            rsvp_clicks_prev: 88,
            rsvp_clicks_delta: 9,
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
            views_by_week: [{ label: "Aug 4", value: 40 }],
            rsvp_clicks_by_week: [{ label: "Aug 4", value: 7 }],
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
    expect(result.metrics.event_views.current).toBe(512);
    expect(result.metrics.rsvp_clicks.current).toBe(97);
    expect(result.series.events[0].label).toBe("Aug 4");
    expect(result.series.events[0].value).toBe(12);
    expect(result.series.views[0].value).toBe(40);
    expect(result.series.rsvpClicks[0].value).toBe(7);
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
