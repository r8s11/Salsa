import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useOwnProfile } from "./useOwnProfile";

const { fetchOwnProfile } = vi.hoisted(() => ({ fetchOwnProfile: vi.fn() }));
vi.mock("../features/account/api/accountRepo", () => ({ fetchOwnProfile }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useOwnProfile", () => {
  it("does not query without a userId and reports not loading", () => {
    const { result } = renderHook(() => useOwnProfile(undefined), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(fetchOwnProfile).not.toHaveBeenCalled();
  });

  it("returns the fetched profile once resolved", async () => {
    fetchOwnProfile.mockResolvedValue({
      id: "user-1",
      display_name: "Maria Santos",
      username: "mariasalsa",
      avatar_url: null,
      status: "active",
      status_reason: null,
      created_at: "2026-03-01T00:00:00Z",
    });

    const { result } = renderHook(() => useOwnProfile("user-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.profile?.display_name).toBe("Maria Santos");
    expect(result.current.error).toBeNull();
    expect(fetchOwnProfile).toHaveBeenCalledWith("user-1");
  });

  it("surfaces a null profile when the query resolves with no row", async () => {
    fetchOwnProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useOwnProfile("user-2"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("surfaces the error message when the query rejects", async () => {
    fetchOwnProfile.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useOwnProfile("user-3"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("network down");
    expect(result.current.profile).toBeNull();
  });
});
