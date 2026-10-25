import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockInvoke = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

const { searchLiner } = await import("./linerSearchClient");

describe("searchLiner", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes the liner-search function with the provided payload", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        requestId: "req_123",
        results: [],
        totalCount: 0,
      },
      error: null,
    });

    const request = {
      query: "recent salsa news",
      mode: "web" as const,
      lang: "en",
      max_results: 5,
    };

    const result = await searchLiner(request);

    expect(mockInvoke).toHaveBeenCalledWith("liner-search", {
      body: request,
    });
    expect(result).toEqual({
      requestId: "req_123",
      results: [],
      totalCount: 0,
    });
  });

  it("throws when the edge function returns an invocation error", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: "UNAUTHORIZED" },
    });

    await expect(searchLiner({ query: "recent salsa news" })).rejects.toThrow(
      "Failed to search with Liner: UNAUTHORIZED"
    );
  });

  it("throws when the edge function returns no data", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(searchLiner({ query: "recent salsa news" })).rejects.toThrow(
      "No response from liner-search function"
    );
  });
});
