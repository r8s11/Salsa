import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DEFAULT_ENTITY_OPTIONS, type AnalyticsData, type AnalyticsEngagement, type AnalyticsInsights, type EntityPerformanceOptions, type TimeRange } from "../model/analyticsQuery";
import { useAdminAnalytics } from "./useAdminAnalytics";
import { INITIAL_OFFSETS, parseOperations, type OperationOffsets } from "../model/operationalAnalytics";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  trends: vi.fn(),
  engagement: vi.fn(),
  entities: vi.fn(),
  operations: vi.fn(),
  auth: { user: { id: "admin-a" } as { id: string } | null, isAdmin: true, loading: false },
}));
vi.mock("../api/analyticsRepo", () => ({ fetchAnalytics: mocks.fetch, fetchAnalyticsTrends: mocks.trends, fetchEventEngagement: mocks.engagement, fetchEntityPerformance: mocks.entities, fetchOperations: mocks.operations }));
vi.mock("../../../contexts/useAuth", () => ({ useAuth: () => mocks.auth }));
const snapshot: AnalyticsData = {
  metrics: { total_events: 17, upcoming_events: 8, registered_users: 6, pending_submissions: 2, active_organizers: 3 },
  cities: [{ slug: "boston", city: "Boston", count: 8 }], asOf: "2026-10-11T12:00:00Z",
};
const insights: AnalyticsInsights = {
  granularity: "daily", asOf: "2026-10-11T12:00:00Z",
  events: { current: 17, previous: 10, series: [] },
  users: null, submissions: null, geography: null, styles: null,
};
const engagement: AnalyticsEngagement = {
  asOf: "2026-10-11T12:00:00Z", firstRecordedAt: null,
  summary: { detail_views: 0, rsvp_clicks: 0, ticket_clicks: 0, shares: 0, outbound_clicks: 0, click_to_view_ratio: null },
  events: [], metros: [], styles: [], savesAvailable: false,
};
function setup(period: TimeRange = "30d") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const initialProps: { range: TimeRange; options?: EntityPerformanceOptions; offsets?: OperationOffsets } = { range: period };
  return renderHook(({ range, options, offsets }: { range: TimeRange; options?: EntityPerformanceOptions; offsets?: OperationOffsets }) => useAdminAnalytics(range, "detail_views", options, offsets),
    { wrapper: Wrapper, initialProps });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = { id: "admin-a" };
  mocks.auth.isAdmin = true;
  mocks.auth.loading = false;
  mocks.fetch.mockResolvedValue(snapshot);
  mocks.trends.mockResolvedValue(insights);
  mocks.engagement.mockResolvedValue(engagement);
  mocks.entities.mockResolvedValue({ asOf: null, firstRecordedAt: null, engagementAvailable: false,
    organizers: { total: 4, active: 1, created: 2, offset: 0, page_size: 25, rows: [] },
    venues: null, coverage: null, quality: null });
  mocks.operations.mockResolvedValue(parseOperations({ submissions: { pending: 4, average_hours: 78, oldest_hours: 192, over_24: 3, over_48: 2, over_7d: 1, under_24: 1, hours_24_48: 1, days_2_7: 1 } }));
});

describe("analytics query isolation", () => {
  it("never shows the previous period while the newly selected period is loading", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.metrics?.total_events).toBe(17));
    mocks.fetch.mockReturnValue(Promise.withResolvers<AnalyticsData>().promise);
    hook.rerender({ range: "7d" });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(true));
    expect(hook.result.current.metrics).toBeNull();
    expect(hook.result.current.cities).toBeNull();
  });
  it("hides stale counts after a failed refresh and recovers on retry", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.metrics?.total_events).toBe(17));
    mocks.fetch.mockRejectedValueOnce(new Error("database offline"));
    await act(async () => { await hook.result.current.refetch(); });
    await waitFor(() => expect(hook.result.current.error).toMatch(/Unable to load analytics/));
    expect(hook.result.current.metrics).toBeNull();
    expect(hook.result.current.cities).toBeNull();
    await act(async () => { await hook.result.current.refetch(); });
    await waitFor(() => expect(hook.result.current.metrics?.total_events).toBe(17));
    expect(hook.result.current.error).toBeNull();
  });
  it("does not reuse another administrator's cached snapshot", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.metrics?.total_events).toBe(17));
    mocks.auth.user = { id: "admin-b" };
    mocks.fetch.mockReturnValue(Promise.withResolvers<AnalyticsData>().promise);
    hook.rerender({ range: "30d" });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(true));
    expect(hook.result.current.metrics).toBeNull();
  });
  it.each(["anonymous", "non-admin"])("hides cached analytics after access becomes %s", async (role) => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.metrics?.total_events).toBe(17));
    mocks.auth.isAdmin = false;
    if (role === "anonymous") mocks.auth.user = null;
    hook.rerender({ range: "30d" });
    expect(hook.result.current.metrics).toBeNull();
    expect(hook.result.current.cities).toBeNull();
    expect(hook.result.current.isFetching).toBe(false);
  });
});

describe("independent insights query", () => {
  it("retains overview metrics when trends fail, then recovers on refresh", async () => {
    mocks.trends.mockRejectedValueOnce(new Error("private schema detail"));
    const hook = setup();
    await waitFor(() => expect(hook.result.current.insightsError).toMatch(/Unable to load insights/));
    expect(hook.result.current.metrics?.total_events).toBe(17);
    expect(hook.result.current.insights).toBeNull();
    await act(async () => { await hook.result.current.refetch(); });
    await waitFor(() => expect(hook.result.current.insights?.events?.current).toBe(17));
    expect(hook.result.current.insightsError).toBeNull();
  });
  it("retains trends when overview aggregation fails", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("unavailable overview"));
    const hook = setup();
    await waitFor(() => expect(hook.result.current.error).not.toBeNull());
    expect(hook.result.current.insights?.events?.current).toBe(17);
    expect(hook.result.current.metrics).toBeNull();
  });
  it("hides previous-period insights and revoked-access cached data", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.insights?.events?.current).toBe(17));
    mocks.trends.mockReturnValue(Promise.withResolvers<AnalyticsInsights>().promise);
    hook.rerender({ range: "90d" });
    await waitFor(() => expect(hook.result.current.insightsLoading).toBe(true));
    expect(hook.result.current.insights).toBeNull();
    mocks.auth.isAdmin = false;
    hook.rerender({ range: "30d" });
    expect(hook.result.current.insights).toBeNull();
    expect(hook.result.current.insightsLoading).toBe(false);
  });
});

describe("engagement query isolation", () => {
  it("hides previous-period interactions and revoked-access data", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.engagement).toEqual(engagement));
    mocks.engagement.mockReturnValue(Promise.withResolvers<AnalyticsEngagement>().promise);
    hook.rerender({ range: "7d" });
    await waitFor(() => expect(hook.result.current.engagementLoading).toBe(true));
    expect(hook.result.current.engagement).toBeNull();
    mocks.auth.isAdmin = false;
    hook.rerender({ range: "30d" });
    expect(hook.result.current.engagement).toBeNull();
  });
  it("keeps platform metrics when engagement fails and recovers on refresh", async () => {
    mocks.engagement.mockRejectedValueOnce(new Error("private database error"));
    const hook = setup();
    await waitFor(() => expect(hook.result.current.engagementError).toMatch(/Unable to load event engagement/));
    expect(hook.result.current.engagement).toBeNull();
    expect(hook.result.current.metrics?.total_events).toBe(17);
    await act(async () => { await hook.result.current.refetch(); });
    await waitFor(() => expect(hook.result.current.engagement).toEqual(engagement));
  });
});

describe("entity intelligence query isolation", () => {
  it("does not display previous-period entity activity or revoked-account data", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.entityPerformance?.organizers?.total).toBe(4));
    mocks.entities.mockReturnValue(Promise.withResolvers().promise);
    hook.rerender({ range: "7d" });
    await waitFor(() => expect(hook.result.current.entitiesLoading).toBe(true));
    expect(hook.result.current.entityPerformance).toBeNull();
    mocks.auth.isAdmin = false;
    hook.rerender({ range: "30d" });
    expect(hook.result.current.entityPerformance).toBeNull();
    expect(hook.result.current.entitiesLoading).toBe(false);
  });
  it("preserves earlier analytics after entity source failure and retries independently", async () => {
    mocks.entities.mockRejectedValueOnce(new Error("private schema detail"));
    const hook = setup();
    await waitFor(() => expect(hook.result.current.entitiesError).toBe("Unable to load entity intelligence. Please try again."));
    expect(hook.result.current.metrics?.total_events).toBe(17);
    expect(hook.result.current.entityPerformance).toBeNull();
    await act(async () => { await hook.result.current.refetch(); });
    await waitFor(() => expect(hook.result.current.entityPerformance?.organizers?.total).toBe(4));
  });
  it("hides prior rankings when either entity's page or sort changes", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.entityPerformance?.organizers?.total).toBe(4));
    mocks.entities.mockReturnValue(Promise.withResolvers().promise);
    hook.rerender({ range: "30d", options: { ...DEFAULT_ENTITY_OPTIONS, organizerOffset: 25 } });
    await waitFor(() => expect(hook.result.current.entitiesLoading).toBe(true));
    expect(hook.result.current.entityPerformance).toBeNull();
    hook.rerender({ range: "30d", options: { ...DEFAULT_ENTITY_OPTIONS, venueSort: "total_events" } });
    expect(hook.result.current.entityPerformance).toBeNull();
    expect(hook.result.current.metrics?.total_events).toBe(17);
  });
});

describe("operational query isolation", () => {
  it("hides cached queues immediately after administrator access is revoked", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.operations?.submissions?.pending).toBe(4));
    mocks.auth.isAdmin = false;
    hook.rerender({ range: "30d" });
    expect(hook.result.current.operations).toBeNull();
    expect(hook.result.current.operationsLoading).toBe(false);
  });
  it("never labels old operational rows with a new period or page", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.operations?.submissions?.pending).toBe(4));
    mocks.operations.mockReturnValue(Promise.withResolvers().promise);
    hook.rerender({ range: "7d" });
    await waitFor(() => expect(hook.result.current.operationsLoading).toBe(true));
    expect(hook.result.current.operations).toBeNull();
    hook.rerender({ range: "30d", offsets: { ...INITIAL_OFFSETS, quality: 25 } });
    expect(hook.result.current.operations).toBeNull();
    expect(hook.result.current.metrics?.total_events).toBe(17);
  });
  it("hides failed-refresh queues while preserving earlier phases and recovers on retry", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.operations?.submissions?.pending).toBe(4));
    mocks.operations.mockRejectedValueOnce(new Error("private database detail"));
    await act(async () => { await hook.result.current.refetch(); });
    await waitFor(() => expect(hook.result.current.operationsError).toBe("Unable to load operational insights. Please try again."));
    expect(hook.result.current.operations).toBeNull();
    expect(hook.result.current.metrics?.total_events).toBe(17);
    await act(async () => { await hook.result.current.refetch(); });
    await waitFor(() => expect(hook.result.current.operations?.submissions?.pending).toBe(4));
  });
});
