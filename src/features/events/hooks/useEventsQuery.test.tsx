import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useEventsQuery } from "./useEventsQuery";

const fetchApprovedEvents = vi.fn();
vi.mock("../api/eventsRepo", () => ({
  fetchApprovedEvents: (...args: unknown[]) => fetchApprovedEvents(...args),
}));

describe("useEventsQuery loadFailed", () => {
  it("stays true through a retry, when TanStack resets the query to pending", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    fetchApprovedEvents.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useEventsQuery("boston"), { wrapper });

    await waitFor(() => expect(result.current.error).toBe("boom"));
    expect(result.current.loadFailed).toBe(true);

    const retry = Promise.withResolvers<never[]>();
    fetchApprovedEvents.mockReturnValueOnce(retry.promise);
    act(() => void result.current.refetch());

    await waitFor(() => expect(result.current.fetching).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.loadFailed).toBe(true);

    await act(async () => retry.resolve([]));
    await waitFor(() => expect(result.current.loadFailed).toBe(false));
  });
});
