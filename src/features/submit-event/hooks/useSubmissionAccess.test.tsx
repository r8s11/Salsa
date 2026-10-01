import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useSubmissionAccess } from "./useSubmissionAccess";
import { publicEventSuggestionsEnabled } from "../../admin/api/platformSettingsRepo";

vi.mock("../../admin/api/platformSettingsRepo", () => ({
  publicEventSuggestionsEnabled: vi.fn(),
  registeredEventSubmissionsEnabled: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useSubmissionAccess", () => {
  it("exposes a refetch that re-runs the access check in place after a failed lookup", async () => {
    // The dialog's error branch needs a real retry path — re-invoking the
    // same query — rather than forcing a page reload. That requires this
    // hook to surface the query's refetch, which it does not do today.
    vi.mocked(publicEventSuggestionsEnabled)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(true);

    const { result } = renderHook(() => useSubmissionAccess(false), { wrapper });

    await waitFor(() => expect(result.current.error).toBe("network down"));
    expect(result.current.canSubmit).toBe(false);

    await result.current.refetch();

    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    expect(result.current.error).toBeNull();
    expect(publicEventSuggestionsEnabled).toHaveBeenCalledTimes(2);
  });
});
