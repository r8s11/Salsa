import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AnalyticsData, TimeRange } from "../model/analyticsQuery";
import { useAdminAnalytics } from "./useAdminAnalytics";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  auth: { user: { id: "admin-a" } as { id: string } | null, isAdmin: true, loading: false },
}));
vi.mock("../api/analyticsRepo", () => ({ fetchAnalytics: mocks.fetch }));
vi.mock("../../../contexts/useAuth", () => ({ useAuth: () => mocks.auth }));
const snapshot: AnalyticsData = {
  metrics: { total_events: 17, upcoming_events: 8, registered_users: 6, pending_submissions: 2, active_organizers: 3 },
  cities: [{ slug: "boston", city: "Boston", count: 8 }], asOf: "2026-10-11T12:00:00Z",
};
function setup(period: TimeRange = "30d") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return renderHook(({ range }) => useAdminAnalytics(range), { wrapper: Wrapper, initialProps: { range: period } });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = { id: "admin-a" };
  mocks.auth.isAdmin = true;
  mocks.auth.loading = false;
  mocks.fetch.mockResolvedValue(snapshot);
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
