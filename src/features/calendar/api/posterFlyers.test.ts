import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

const originalFetch = globalThis.fetch;

describe("poster flyer client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("requests a normalized poster asset by event ID only", async () => {
    invokeMock.mockResolvedValue({
      data: { status: "ready", url: "https://project.supabase.co/cache.jpg" },
      error: null,
    } as never);

    const { requestPosterFlyer } = await import("./posterFlyers");

    await expect(requestPosterFlyer("event-1")).resolves.toEqual({
      status: "ready",
      url: "https://project.supabase.co/cache.jpg",
    });
    expect(invokeMock).toHaveBeenCalledWith("resolve-poster-flyer", {
      body: { eventId: "event-1" },
    });
  });

  it("returns unavailable when a flyer exists but cache normalization fails", async () => {
    const httpError = {
      name: "FunctionsHttpError",
      context: {
        json: async () => ({ status: "unavailable", message: "Flyer source cannot be used for sharing." }),
      },
    };

    invokeMock.mockResolvedValue({
      data: null,
      error: httpError,
    } as never);

    const { resolvePosterImageForEvent } = await import("./posterFlyers");

    await expect(
      resolvePosterImageForEvent({
        eventId: "event-1",
        sourceUrl: "https://blocked.test/flyer.jpg",
        cachedUrl: null,
      }),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("returns missing when no flyer URL is present", async () => {
    const { resolvePosterImageForEvent } = await import("./posterFlyers");

    await expect(
      resolvePosterImageForEvent({ eventId: "event-1", sourceUrl: null, cachedUrl: null }),
    ).resolves.toEqual({ status: "missing" });
  });

  it("uses cached URL without invoking the function and converts it to a data URL", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const blob = new Blob([bytes], { type: "image/jpeg" });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "image/jpeg" : null) },
      blob: async () => blob,
    } as unknown as Response);

    const originalFileReader = globalThis.FileReader;
    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(_blob: Blob) {
        this.result = "data:image/jpeg;base64,AAAA";
        this.onload?.();
      }
    }
    // @ts-expect-error - mock
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    const { resolvePosterImageForEvent } = await import("./posterFlyers");

    await expect(
      resolvePosterImageForEvent({
        eventId: "event-1",
        sourceUrl: "https://cdn.example/flyer.jpg",
        cachedUrl: "https://project.supabase.co/storage/v1/object/public/event-flyers/poster-cache/event-1/hash.jpg",
      }),
    ).resolves.toEqual({ status: "ready", dataUrl: "data:image/jpeg;base64,AAAA" });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/storage/v1/object/public/event-flyers/poster-cache/event-1/hash.jpg",
      expect.anything(),
    );

    globalThis.FileReader = originalFileReader;
  });
});
