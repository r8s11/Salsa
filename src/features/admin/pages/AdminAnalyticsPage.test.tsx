import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider, useLocation, type RouteObject } from "react-router-dom";
import type { AnalyticsMetrics, CityCount } from "../model/analyticsQuery";
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
  isLoading?: boolean;
  isFetching?: boolean;
  error?: string | null;
} = {}) {
  return {
    metrics,
    cities,
    asOf: "2026-10-11T14:30:00.000Z",
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
      analyticsState({ metrics: null, cities: null, isLoading: true, asOf: null })
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
});
