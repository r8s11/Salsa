import React from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { EventSubmission } from "../model/submissions";
import { useAdminSubmissions } from "./useAdminSubmissions";
import * as submissionsQuery from "../model/submissionsQuery";

vi.mock("../model/submissionsQuery");

describe('useAdminSubmissions', () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('calls updateSubmission with rejected status and rejection fields', async () => {
    const mockUpdate = vi.spyOn(submissionsQuery, "updateSubmission").mockResolvedValue({} as EventSubmission);
    const { result } = renderHook(() => useAdminSubmissions(), { wrapper });

    await result.current.rejectSubmission({
      id: "sub-1",
      reason: "spam",
      message: "This is spam.",
      note: "Found spammy content.",
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({
        status: "rejected",
        rejection_reason: "spam",
        rejection_message: "This is spam.",
        internal_note: "Found spammy content.",
      }),
    );
  });
});
