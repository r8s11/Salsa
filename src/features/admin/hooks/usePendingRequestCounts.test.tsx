import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  usePendingFounderRequestCount,
  usePendingOrganizerRequestCount,
} from "./usePendingRequestCounts";

const repo = vi.hoisted(() => ({
  fetchPendingOrganizerRequestCount: vi.fn(),
  fetchOrganizerRequests: vi.fn(),
  fetchPendingFounderRequestCount: vi.fn(),
  fetchFounderRequests: vi.fn(),
}));
vi.mock("../api/organizerRequestsRepo", () => ({
  fetchPendingOrganizerRequestCount: repo.fetchPendingOrganizerRequestCount,
  fetchOrganizerRequests: repo.fetchOrganizerRequests,
}));
vi.mock("../api/founderRequestsRepo", () => ({
  fetchPendingFounderRequestCount: repo.fetchPendingFounderRequestCount,
  fetchFounderRequests: repo.fetchFounderRequests,
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.fetchPendingOrganizerRequestCount.mockResolvedValue(12);
  repo.fetchPendingFounderRequestCount.mockResolvedValue(3);
});

describe("pending request count hooks", () => {
  it("return the count and never load the request directory", async () => {
    const organizer = renderHook(() => usePendingOrganizerRequestCount(true), { wrapper });
    const founder = renderHook(() => usePendingFounderRequestCount(true), { wrapper });

    await waitFor(() => expect(organizer.result.current).toBe(12));
    await waitFor(() => expect(founder.result.current).toBe(3));
    expect(repo.fetchOrganizerRequests).not.toHaveBeenCalled();
    expect(repo.fetchFounderRequests).not.toHaveBeenCalled();
  });

  it("make no request and report zero when disabled", async () => {
    const organizer = renderHook(() => usePendingOrganizerRequestCount(false), { wrapper });
    const founder = renderHook(() => usePendingFounderRequestCount(false), { wrapper });

    await Promise.resolve();
    expect(organizer.result.current).toBe(0);
    expect(founder.result.current).toBe(0);
    expect(repo.fetchPendingOrganizerRequestCount).not.toHaveBeenCalled();
    expect(repo.fetchPendingFounderRequestCount).not.toHaveBeenCalled();
  });
});
