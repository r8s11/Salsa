import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider, useLocation, type RouteObject } from "react-router-dom";
import type { AnalyticsEngagement, AnalyticsInsights, AnalyticsMetrics, CityCount } from "../model/analyticsQuery";
import { useAdminAnalytics } from "../hooks/useAdminAnalytics";
import AdminAnalyticsPage from "./AdminAnalyticsPage";

vi.mock("../hooks/useAdminAnalytics");

const metrics: AnalyticsMetrics = {
  total_events: 124,
  upcoming_events: 18,
  registered_users: 932,
  pending_submissions: 7,
  active_organizers: 11,
};
const cities: CityCount[] = [
  { slug: "boston", city: "Boston", count: 12 },
  { slug: "new-york-city", city: "New York", count: 6 },
];
const insights: AnalyticsInsights = {
  granularity: "daily",
  asOf: "2026-10-11T14:30:00.000Z",
  events: {
    series: [
      { period: "2026-10-10", created: 3, approved: 2, pending_draft: 1 },
      { period: "2026-10-11", created: 2, approved: 1, pending_draft: 1 },
    ],
    current: 5,
    previous: 4,
  },
  users: {
    series: [
      { period: "2026-10-10", count: 2 },
      { period: "2026-10-11", count: 1 },
    ],
    current: 3,
    previous: 0,
    total_accounts: 932,
  },
  submissions: {
    received: 10,
    approved: 4,
    rejected: 2,
    pending: 3,
    needs_information: 1,
    withdrawn: 0,
    series: [
      { period: "2026-10-10", count: 6 },
      { period: "2026-10-11", count: 4 },
    ],
  },
  geography: {
    active_metros: 2,
    scheduled: [
      { period: "2026-10-10", slug: "boston", city: "Boston", count: 4 },
      { period: "2026-10-11", slug: "new-york-city", city: "New York", count: 2 },
    ],
    emerging: [
      { slug: "new-york-city", city: "New York", first_created_at: "2026-10-08T16:00:00.000Z", upcoming: 2 },
    ],
    inventory_history_available: false,
  },
  styles: {
    upcoming_total: 4,
    distribution: [
      { slug: "bachata", style: "Bachata", count: 3 },
      { slug: "salsa", style: "Salsa", count: 2 },
      { slug: null, style: "Unspecified", count: 1 },
    ],
    scheduled: [
      { period: "2026-10-10", slug: "bachata", style: "Bachata", count: 2 },
      { period: "2026-10-11", slug: "salsa", style: "Salsa", count: 1 },
    ],
  },
};
const engagement: AnalyticsEngagement = {
  asOf: "2026-10-11T14:30:00.000Z",
  firstRecordedAt: "2026-10-10T15:00:00.000Z",
  summary: { detail_views: 8, rsvp_clicks: 2, ticket_clicks: 1, shares: 3, outbound_clicks: 3, click_to_view_ratio: 37.5 },
  events: [{
    id: "event-1", title: "Havana Nights", event_date: "2026-10-20T00:30:00.000Z", city_slug: "boston", city: "Boston", status: "approved",
    detail_views: 8, rsvp_clicks: 2, ticket_clicks: 1, shares: 3,
  }],
  metros: [{ slug: "boston", city: "Boston", detail_views: 8, rsvp_clicks: 2, ticket_clicks: 1, shares: 3 }],
  styles: [{ slug: "salsa", style: "Salsa", detail_views: 8, rsvp_clicks: 2, shares: 3 }],
  savesAvailable: false,
};
const mockAnalytics = vi.mocked(useAdminAnalytics);
const refetch = vi.fn();

function LocationOutput() {
  const location = useLocation();
  return <output aria-label="Current URL">{location.search}</output>;
}

const routes: RouteObject[] = [
  {
    path: "/admin/analytics",
    element: (
      <>
        <AdminAnalyticsPage />
        <LocationOutput />
      </>
    ),
  },
];

function renderPage(initialEntries: string[] = ["/admin/analytics?range=30d&tab=summary"]) {
  const router = createMemoryRouter(routes, {
    initialEntries,
    initialIndex: initialEntries.length - 1,
  });
  return { ...render(<RouterProvider router={router} />), router };
}

function analyticsState(overrides: {
  metrics?: AnalyticsMetrics | null;
  cities?: CityCount[] | null;
  asOf?: string | null;
  insights?: AnalyticsInsights | null;
  engagement?: AnalyticsEngagement | null;
  engagementLoading?: boolean;
  engagementError?: string | null;
  insightsLoading?: boolean;
  insightsError?: string | null;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: string | null;
} = {}) {
  return {
    metrics,
    cities,
    asOf: "2026-10-11T14:30:00.000Z",
    insights,
    insightsLoading: false,
    insightsError: null,
    engagement,
    engagementLoading: false,
    engagementError: null,
    entityPerformance: null,
    entitiesLoading: false,
    entitiesError: null,
    operations: null,
    operationsLoading: false,
    operationsError: null,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch,
    ...overrides,
  };
}

describe("AdminAnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalytics.mockReturnValue(analyticsState());
  });

  it("shows loading placeholders rather than zero-valued metrics", () => {
    mockAnalytics.mockReturnValue(
      analyticsState({ metrics: null, cities: null, isLoading: true, insights: null, insightsLoading: true, asOf: null })
    );
    const { container } = renderPage();

    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("distinguishes an empty city distribution from unavailable data", () => {
    const { rerender } = renderPage();
    mockAnalytics.mockReturnValue(analyticsState({ cities: [] }));
    rerender(
      <RouterProvider
        router={createMemoryRouter(routes, {
          initialEntries: ["/admin/analytics?range=30d"],
        })}
      />
    );
    const emptyChart = screen.getByRole("region", { name: "Events by City" });
    expect(within(emptyChart).queryByRole("listitem")).not.toBeInTheDocument();
    expect(within(emptyChart).queryByRole("button")).not.toBeInTheDocument();

    mockAnalytics.mockReturnValue(analyticsState({ cities: null }));
    rerender(
      <RouterProvider
        router={createMemoryRouter(routes, {
          initialEntries: ["/admin/analytics?range=30d"],
        })}
      />
    );
    const unavailableChart = screen.getByRole("region", { name: "Events by City" });
    expect(within(unavailableChart).queryByRole("listitem")).not.toBeInTheDocument();
    expect(within(unavailableChart).getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("retries unavailable values while keeping healthy metrics visible", () => {
    mockAnalytics.mockReturnValue(
      analyticsState({
        metrics: { ...metrics, total_events: null },
        error: "Some analytics data could not be loaded.",
      })
    );
    renderPage();

    expect(screen.getByLabelText(/^Registered Users: 932\b/)).toHaveTextContent("932");
    const unavailableCard = screen.getByLabelText(/^Total Events: unavailable\b/);
    fireEvent.click(within(unavailableCard).getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("Some analytics data could not be loaded.");
  });

  it("uses the URL range for the native select and preserves unrelated query parameters", () => {
    renderPage();

    const select = screen.getByRole("combobox", { name: "Activity period" });
    expect(select).toHaveValue("30d");
    expect(within(select).getByRole("option", { name: "Last 7 days" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Last 30 days" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Last 90 days" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "All time" })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "90d" } });
    expect(screen.getByLabelText("Current URL")).toHaveTextContent("range=90d");
    expect(screen.getByLabelText("Current URL")).toHaveTextContent("tab=summary");
    expect(screen.getByLabelText("Current URL")).not.toHaveTextContent("from=");
    expect(screen.getByLabelText("Current URL")).not.toHaveTextContent("to=");
  });

  it("shows all five metric labels and their actual values", () => {
    renderPage();

    for (const [label, value] of [
      ["Total Events", "124"],
      ["Upcoming Events", "18"],
      ["Registered Users", "932"],
      ["Pending Submissions", "7"],
      ["Active Organizers", "11"],
    ]) {
      expect(screen.getByLabelText(new RegExp(`${label}: ${value}`))).toBeInTheDocument();
    }
  });

  it("exposes city names and counts as accessible labels", () => {
    renderPage();

    expect(screen.getByRole("region", { name: "Events by City" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Boston: 12 events" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "New York: 6 events" })).toBeInTheDocument();
  });

  it("follows browser history after changing the selected period", async () => {
    const { router } = renderPage([
      "/admin/analytics?range=7d",
      "/admin/analytics?range=30d",
    ]);
    const select = screen.getByRole("combobox", { name: "Activity period" });
    expect(select).toHaveValue("30d");
    fireEvent.change(select, { target: { value: "90d" } });
    expect(select).toHaveValue("90d");
    await act(async () => {
      await router.navigate(-1);
    });
    expect(screen.getByRole("combobox", { name: "Activity period" })).toHaveValue("30d");
  });
  it("keeps identically named metros distinguishable without combining their counts", () => {
    mockAnalytics.mockReturnValue(analyticsState({ cities: [
      { slug: "boston", city: "Boston", count: 12 },
      { slug: "other-boston", city: "Boston", count: 6 },
    ] }));
    renderPage();
    expect(screen.getByRole("listitem", { name: "Boston (boston): 12 events" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Boston (other-boston): 6 events" })).toBeInTheDocument();
  });
  it("shows period-specific growth totals, comparisons, and dynamic bucket labels", () => {
    renderPage(["/admin/analytics?range=7d"]);

    const growth = screen.getByRole("region", { name: "Growth" });
    expect(within(growth).getByText("5")).toBeInTheDocument();
    expect(growth).toHaveTextContent("932");
    expect(within(growth).getByText(/25%/)).toBeInTheDocument();
    expect(within(growth).getByRole("table", { name: /daily event growth/i })).toBeInTheDocument();
  });

  it("shows submission cohort statuses, denominator-based approval rate, and current-status caveat", () => {
    renderPage();

    const submissions = screen.getByRole("region", { name: "Event submissions" });
    expect(within(submissions).getByText("Received")).toBeInTheDocument();
    expect(within(submissions).getByText("10")).toBeInTheDocument();
    expect(within(submissions).getByText("67%")).toBeInTheDocument();
    expect(within(submissions).getByText(/current status/i)).toBeInTheDocument();
  });

  it("shows active and emerging metros, scheduled trend, and honest inventory-history limitation", () => {
    renderPage();

    const geography = screen.getByRole("region", { name: "Geography" });
    expect(within(geography).getByText("2 active metros")).toBeInTheDocument();
    expect(within(geography).getByRole("list")).toHaveTextContent("2026");
    expect(within(geography).getByText(/inventory history is unavailable/i)).toBeInTheDocument();
    expect(within(geography).getByRole("table", { name: /current approved events by city/i })).toBeInTheDocument();
  });

  it("shows multistyle shares over upcoming-event denominator and scheduled style trend", () => {
    renderPage();

    const styles = screen.getByRole("region", { name: "Dance styles" });
    expect(within(styles).getByText(/share of 4 upcoming events/i)).toBeInTheDocument();
    expect(within(styles).getByText("75%")).toBeInTheDocument();
    expect(within(styles).getByText("50%")).toBeInTheDocument();
    expect(within(styles).getByText("Unspecified")).toBeInTheDocument();
    expect(within(styles).getByText(/shares can total more than 100%/i)).toBeInTheDocument();
    expect(within(styles).getByRole("table", { name: /current approved events by dance style/i })).toBeInTheDocument();
  });

  it("does not round a positive minority-style share to a misleading zero", () => {
    mockAnalytics.mockReturnValue(analyticsState({
      insights: { ...insights, styles: { upcoming_total: 2000, scheduled: [],
        distribution: [{ slug: "rare-style", style: "Rare style", count: 1 }] } },
    }));
    renderPage();
    const styles = screen.getByRole("region", { name: "Dance styles" });
    expect(within(styles).getByRole("listitem", { name: "Rare style: 1 events, <0.1%" })).toBeInTheDocument();
    expect(within(styles).queryByText("0%")).not.toBeInTheDocument();
  });

  it("keeps healthy insights sections visible when individual insight sources fail", () => {
    mockAnalytics.mockReturnValue(analyticsState({
      insights: { ...insights, events: null, geography: null },
      insightsError: "Some insights are unavailable.",
    }));
    renderPage();

    expect(screen.getByRole("region", { name: "Growth" })).toHaveTextContent(/unavailable/i);
    expect(screen.getByRole("region", { name: "Growth" })).toHaveTextContent("All accounts: 932");
    expect(screen.getByRole("region", { name: "Event submissions" })).toHaveTextContent("10");
    expect(screen.getByRole("region", { name: "Geography" })).toHaveTextContent(/unavailable/i);
    expect(screen.getByRole("region", { name: "Dance styles" })).toHaveTextContent("Bachata");
    const growth = screen.getByRole("region", { name: "Growth" });
    fireEvent.click(within(growth).getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("distinguishes loading, unavailable, and genuine empty insight data", () => {
    mockAnalytics.mockReturnValue(analyticsState({ insights: null, insightsLoading: true }));
    const { rerender } = renderPage();
    expect(screen.getByRole("region", { name: "Dance styles" })).toHaveTextContent(/loading/i);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();

    mockAnalytics.mockReturnValue(analyticsState({ insights: null, insightsError: "Insights unavailable." }));
    rerender(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/admin/analytics?range=30d"] })} />);
    expect(screen.getByRole("region", { name: "Dance styles" })).toHaveTextContent(/unavailable/i);
    expect(screen.getByRole("region", { name: "Dance styles" })).toHaveTextContent(/retry/i);

    mockAnalytics.mockReturnValue(analyticsState({
      insights: {
        ...insights,
        events: { series: [{ period: "2026-10-11", created: 0, approved: 0, pending_draft: 0 }], current: 0, previous: null },
        users: { series: [{ period: "2026-10-11", count: 0 }], current: 0, previous: null, total_accounts: 932 },
        submissions: { received: 0, approved: 0, rejected: 0, pending: 0, needs_information: 0, withdrawn: 0, series: [] },
        geography: { active_metros: 0, scheduled: [], emerging: [], inventory_history_available: false },
        styles: { upcoming_total: 0, distribution: [], scheduled: [] },
      },
    }));
    rerender(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/admin/analytics?range=30d"] })} />);
    expect(within(screen.getByRole("region", { name: "Growth" })).queryAllByRole("table")).toEqual([]);
    expect(screen.getByRole("region", { name: "Dance styles" })).toHaveTextContent(/no approved upcoming events/i);
    expect(screen.getByRole("region", { name: "Event submissions" })).toHaveTextContent(/no submissions/i);
    expect(screen.getByRole("region", { name: "Event submissions" })).toHaveTextContent("Approval rate (0 of 0 reviewed)");
    expect(screen.getByRole("region", { name: "Event submissions" })).toHaveTextContent(/Unavailable/);
  });

  it("does not invent an equivalent-period growth comparison for all time", () => {
    mockAnalytics.mockReturnValue(analyticsState({ insights: { ...insights, granularity: "monthly" } }));
    renderPage(["/admin/analytics?range=all"]);

    expect(screen.getByRole("region", { name: "Growth" })).toHaveTextContent(/previous period unavailable/i);
  });
  it("shows interaction rankings, city/style attribution, ratio, and unavailable saves", () => {
    renderPage();
    const section = screen.getByRole("region", { name: "Event engagement" });
    expect(within(section).getByRole("link", { name: "Havana Nights" })).toHaveAttribute("href", "/admin/events?edit=event-1");
    expect(within(section).getByText(/Outbound click-to-view ratio: 37.5%/)).toBeInTheDocument();
    expect(within(section).getByText("Saves")).toBeInTheDocument();
    expect(within(section).getByText("Unavailable")).toBeInTheDocument();
    expect(within(section).getByText("Boston")).toBeInTheDocument();
    expect(within(section).getByText("Salsa")).toBeInTheDocument();
  });

  it("shows loading, error, and no-history states for engagement", () => {
    const { rerender } = renderPage();
    const renderAtRange = () => rerender(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/admin/analytics?range=30d"] })} />);
    mockAnalytics.mockReturnValue(analyticsState({ engagement: null, engagementLoading: true }));
    renderAtRange();
    expect(screen.getByText("Loading engagement analytics…")).toBeInTheDocument();
    mockAnalytics.mockReturnValue(analyticsState({ engagement: null, engagementError: "Unable to load event engagement. Please try again." }));
    renderAtRange();
    expect(screen.getByRole("alert")).toHaveTextContent(/unable to load event engagement/i);
    mockAnalytics.mockReturnValue(analyticsState({
      engagement: {
        ...engagement, firstRecordedAt: null,
        summary: { detail_views: 0, rsvp_clicks: 0, ticket_clicks: 0, shares: 0, outbound_clicks: 0, click_to_view_ratio: null },
        events: [], metros: [], styles: [],
      },
    }));
    renderAtRange();
    expect(screen.getByText(/no recorded history yet/i)).toBeInTheDocument();
  });
  it("retains keyboard focus while a new ranking is loading and hides stale rankings", () => {
    mockAnalytics.mockImplementation((_range, sort) => analyticsState(
      sort === "shares" ? { engagement: null, engagementLoading: true } : {}
    ));
    renderPage();
    const ranking = screen.getByRole("combobox", { name: "Rank by" });
    ranking.focus();
    fireEvent.change(ranking, { target: { value: "shares" } });
    expect(ranking).toHaveFocus();
    expect(screen.getByText("Loading engagement analytics…")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Havana Nights" })).not.toBeInTheDocument();
  });
});
