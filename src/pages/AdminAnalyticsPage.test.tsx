import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAdminAnalytics } from "../hooks/useAdminAnalytics";
import { useAdminSubmissions } from "../hooks/useAdminSubmissions";
import AdminAnalyticsPage from "./AdminAnalyticsPage";

vi.mock("../hooks/useAdminAnalytics");
vi.mock("../hooks/useAdminSubmissions");

const mockMetrics = {
  published_events: { current: 86, previous: 80, delta: 6 },
  new_users: { current: 42, previous: 38, delta: 4 },
  rsvps: { current: 318, previous: 300, delta: 18 },
  submissions: { current: 29, previous: 25, delta: 4 },
};

const mockSeries = {
  events: [
    { label: "Aug 4", value: 12 },
    { label: "Aug 11", value: 15 },
  ],
  submissions: [
    { label: "Aug 4", value: 3 },
    { label: "Aug 11", value: 5 },
  ],
};

describe("AdminAnalyticsPage", () => {
  beforeEach(() => {
    (useAdminAnalytics as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      metrics: mockMetrics,
      series: mockSeries,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    (useAdminSubmissions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      submissions: [],
      isLoading: false,
      error: null,
    });
  });

  it("renders the page title and description", () => {
    render(
      <MemoryRouter initialEntries={["/admin/analytics"]}>
        <AdminAnalyticsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument();
  });

  it("renders metric cards with values", () => {
    render(
      <MemoryRouter initialEntries={["/admin/analytics"]}>
        <AdminAnalyticsPage />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Published Events").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("86").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("New Users").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("42").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Submissions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("29").length).toBeGreaterThanOrEqual(1);
  });

  it("renders trend chart titles", () => {
    render(
      <MemoryRouter initialEntries={["/admin/analytics"]}>
        <AdminAnalyticsPage />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Published Events").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Submissions").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Refresh button", () => {
    render(
      <MemoryRouter initialEntries={["/admin/analytics"]}>
        <AdminAnalyticsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("shows loading state for charts", () => {
    (useAdminAnalytics as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      metrics: null,
      series: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/admin/analytics"]}>
        <AdminAnalyticsPage />
      </MemoryRouter>
    );

    // Metric cards show skeleton, charts show loading
    const skeletons = screen.getAllByText("Loading chart…");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
