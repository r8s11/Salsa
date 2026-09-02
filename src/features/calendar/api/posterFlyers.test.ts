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

type DrawnSize = { width: number; height: number };

/**
 * Stubs the browser image-decoding pipeline the poster resolver uses:
 * fetch -> createImageBitmap -> canvas draw -> JPEG data URL. Records the
 * size each bitmap is drawn at so tests can assert the downscale cap.
 */
function stubImageDecoding(options: {
  width?: number;
  height?: number;
  decodeFails?: boolean;
}): { drawnSizes: DrawnSize[] } {
  const drawnSizes: DrawnSize[] = [];

  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? "image/jpeg" : null),
    },
    blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
  } as unknown as Response);

  const createImageBitmapStub = options.decodeFails
    ? vi.fn().mockRejectedValue(new Error("not an image"))
    : vi.fn().mockResolvedValue({
        width: options.width ?? 800,
        height: options.height ?? 600,
        close: vi.fn(),
      });
  Reflect.set(globalThis, "createImageBitmap", createImageBitmapStub);

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: (_bitmap: unknown, _x: number, _y: number, width: number, height: number) => {
      drawnSizes.push({ width, height });
    },
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,STUB");

  return { drawnSizes };
}

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
    const { drawnSizes } = stubImageDecoding({ width: 800, height: 600 });

    const { resolvePosterImageForEvent } = await import("./posterFlyers");

    await expect(
      resolvePosterImageForEvent({
        eventId: "event-1",
        sourceUrl: "https://cdn.example/flyer.jpg",
        cachedUrl: "https://project.supabase.co/storage/v1/object/public/event-flyers/poster-cache/event-1/hash.jpg",
      }),
    ).resolves.toEqual({ status: "ready", dataUrl: "data:image/jpeg;base64,STUB" });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/storage/v1/object/public/event-flyers/poster-cache/event-1/hash.jpg",
      expect.anything(),
    );
    // Already under the cap — kept at native size.
    expect(drawnSizes).toEqual([{ width: 800, height: 600 }]);
  });

  it("downscales an oversized flyer so html-to-image capture cannot hang on a multi-MB data URL", async () => {
    const { drawnSizes } = stubImageDecoding({ width: 4000, height: 3000 });

    const { resolvePosterImageForEvent } = await import("./posterFlyers");

    await expect(
      resolvePosterImageForEvent({
        eventId: "event-1",
        sourceUrl: null,
        cachedUrl: "https://project.supabase.co/storage/v1/object/public/event-flyers/big.png",
      }),
    ).resolves.toEqual({ status: "ready", dataUrl: "data:image/jpeg;base64,STUB" });

    // Longest edge capped at 1440, aspect ratio preserved.
    expect(drawnSizes).toEqual([{ width: 1440, height: 1080 }]);
  });

  it("returns unavailable when the fetched bytes cannot be decoded as an image", async () => {
    stubImageDecoding({ decodeFails: true });

    const { resolvePosterImageForEvent } = await import("./posterFlyers");

    await expect(
      resolvePosterImageForEvent({
        eventId: "event-1",
        sourceUrl: null,
        cachedUrl: "https://project.supabase.co/storage/v1/object/public/event-flyers/broken.png",
      }),
    ).resolves.toEqual({ status: "unavailable" });
  });
});
