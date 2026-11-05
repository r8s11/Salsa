import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { usePublishedItinerary } from "./useItineraryQueries";

const mocks = vi.hoisted(() => ({
  fetchPublishedItinerary: vi.fn(),
  fetchPublishedNeighbours: vi.fn(),
  fetchApprovedEventsByIds: vi.fn(),
}));

vi.mock("../api/itinerariesRepo", () => ({
  fetchPublishedItinerary: mocks.fetchPublishedItinerary,
  fetchPublishedNeighbours: mocks.fetchPublishedNeighbours,
  fetchItineraries: vi.fn(),
  fetchItineraryDraft: vi.fn(),
}));
vi.mock("../../events/api/eventsRepo", () => ({
  fetchApprovedEventsByIds: mocks.fetchApprovedEventsByIds,
  fetchApprovedEventsBetween: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("usePublishedItinerary", () => {
  it("stays loading until the neighbours resolve", async () => {
    mocks.fetchPublishedItinerary.mockResolvedValue(null);
    let resolveNeighbours!: (value: { previous: string | null; next: string | null }) => void;
    mocks.fetchPublishedNeighbours.mockReturnValue(
      new Promise((resolve) => {
        resolveNeighbours = resolve;
      })
    );

    const { result } = renderHook(() => usePublishedItinerary("boston", "2026-11-02"), { wrapper });

    await waitFor(() => expect(mocks.fetchPublishedItinerary).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.loading).toBe(true);

    resolveNeighbours({ previous: "2026-10-26", next: null });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.itinerary).toBeNull();
    expect(result.current.neighbours).toEqual({ previous: "2026-10-26", next: null });
  });
});
