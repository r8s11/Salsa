import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RankedMetro } from "../model/metro";
import type { ActiveLocation } from "../model/activeLocation";
import { useActiveLocations, useActiveMetros } from "./useMetros";

const { fetchActiveLocations, fetchActiveMetros } = vi.hoisted(() => ({
  fetchActiveLocations: vi.fn(),
  fetchActiveMetros: vi.fn(),
}));
vi.mock("../api/metrosRepo", () => ({ fetchActiveLocations, fetchActiveMetros, fetchMetros: vi.fn() }));

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client.clear();
  fetchActiveMetros.mockReset();
  fetchActiveLocations.mockReset();
});

describe("useActiveMetros discovery state", () => {
  it("keeps first-load failure visible during retry and clears it only after success", async () => {
    let resolveRetry!: (metros: RankedMetro[]) => void;
    fetchActiveMetros
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(() => new Promise<RankedMetro[]>((resolve) => { resolveRetry = resolve; }));
    const { result } = renderHook(() => useActiveMetros(), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.activeMetros).toEqual([]);
    expect(result.current.error).toBe("offline");

    act(() => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.fetching).toBe(true));
    expect(result.current.loadFailed).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => resolveRetry([]));
    await waitFor(() => expect(result.current.fetching).toBe(false));
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.activeMetros).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

describe("useActiveLocations picker inventory", () => {
  it("waits for an open picker and shares one request across observers", async () => {
    const inventory: ActiveLocation[] = [
      { city: "new-york-city", subLocation: "brooklyn", neighborhood: null, upcomingEventCount: 2 },
    ];
    let resolveInventory!: (locations: ActiveLocation[]) => void;
    fetchActiveLocations.mockImplementationOnce(() =>
      new Promise<ActiveLocation[]>((resolve) => { resolveInventory = resolve; })
    );
    const { result, rerender } = renderHook(({ enabled }) => ({
      first: useActiveLocations(enabled),
      second: useActiveLocations(enabled),
    }), { wrapper, initialProps: { enabled: false } });
    expect(fetchActiveLocations).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(fetchActiveLocations).toHaveBeenCalledOnce());
    expect(result.current.first.loading).toBe(true);
    expect(result.current.first.loadFailed).toBe(false);
    await act(async () => resolveInventory(inventory));
    await waitFor(() => expect(result.current.first.loading).toBe(false));
    expect(result.current.first.activeLocations).toEqual(inventory);
    expect(result.current.second.activeLocations).toBe(result.current.first.activeLocations);
  });

  it("keeps first-load failure during retry, then accepts verified zero", async () => {
    let resolveRetry!: (locations: ActiveLocation[]) => void;
    fetchActiveLocations
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(() => new Promise<ActiveLocation[]>((resolve) => { resolveRetry = resolve; }));
    const { result } = renderHook(() => useActiveLocations(true), { wrapper });
    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.error).toBe("offline");
    act(() => { void result.current.refetch(); });
    await waitFor(() => expect(result.current.fetching).toBe(true));
    expect(result.current.loadFailed).toBe(true);
    await act(async () => resolveRetry([]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.refreshFailed).toBe(false);
    expect(result.current.activeLocations).toEqual([]);
  });

  it("keeps cached populated inventory and refresh failure visible during retry", async () => {
    const inventory: ActiveLocation[] = [
      { city: "boston", subLocation: null, neighborhood: "allston", upcomingEventCount: 1 },
    ];
    let resolveRetry!: (locations: ActiveLocation[]) => void;
    fetchActiveLocations
      .mockResolvedValueOnce(inventory)
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(() => new Promise<ActiveLocation[]>((resolve) => { resolveRetry = resolve; }));
    const { result } = renderHook(() => useActiveLocations(true), { wrapper });
    await waitFor(() => expect(result.current.activeLocations).toEqual(inventory));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.refreshFailed).toBe(true));
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.activeLocations).toEqual(inventory);
    act(() => { void result.current.refetch(); });
    await waitFor(() => expect(result.current.fetching).toBe(true));
    expect(result.current.refreshFailed).toBe(true);
    expect(result.current.activeLocations).toEqual(inventory);
    await act(async () => resolveRetry([]));
    await waitFor(() => expect(result.current.fetching).toBe(false));
    expect(result.current.refreshFailed).toBe(false);
    expect(result.current.activeLocations).toEqual([]);
  });
});
