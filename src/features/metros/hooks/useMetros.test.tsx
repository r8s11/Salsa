import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RankedMetro } from "../model/metro";
import { useActiveMetros } from "./useMetros";

const { fetchActiveMetros } = vi.hoisted(() => ({ fetchActiveMetros: vi.fn() }));
vi.mock("../api/metrosRepo", () => ({ fetchActiveMetros, fetchMetros: vi.fn() }));

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client.clear();
  fetchActiveMetros.mockReset();
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
