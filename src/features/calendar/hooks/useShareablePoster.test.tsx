import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toBlob } from "html-to-image";
import { resolvePosterImage, useShareablePoster } from "./useShareablePoster";
import { ScheduleXEvent } from "../../../types/events";

vi.mock("html-to-image", () => ({
  toBlob: vi.fn(),
}));

const mockEnsurePosterFonts = vi.fn();
const mockPosterFontEmbedCss = vi.fn();

vi.mock("../../events/components/event-modal/posterFonts", () => ({
  ensurePosterFonts: (...args: unknown[]) => mockEnsurePosterFonts(...args),
  posterFontEmbedCss: (...args: unknown[]) => mockPosterFontEmbedCss(...args),
}));

const mockResolvePosterImageForEvent = vi.fn();

vi.mock("../api/posterFlyers", () => ({
  resolvePosterImageForEvent: (...args: unknown[]) => mockResolvePosterImageForEvent(...args),
}));

const testEvent: ScheduleXEvent = {
  id: "1",
  title: "Beginner Salsa Night!",
  start: "2026-08-24 19:00",
  end: "2026-08-24 23:00",
  calendarId: "social",
};

describe("useShareablePoster", () => {
  beforeEach(() => {
    vi.mocked(toBlob).mockReset();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-poster-url");
    globalThis.URL.revokeObjectURL = vi.fn();
    mockEnsurePosterFonts.mockReset();
    mockEnsurePosterFonts.mockResolvedValue(undefined);
    mockPosterFontEmbedCss.mockReset();
    mockPosterFontEmbedCss.mockRejectedValue(new Error("fonts unavailable"));
    mockResolvePosterImageForEvent.mockReset();
    mockResolvePosterImageForEvent.mockResolvedValue({ status: "missing" });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("throws when the mounted poster capture yields no blob", async () => {
    vi.mocked(toBlob).mockResolvedValue(null);
    const { result } = renderHook(() => useShareablePoster());
    const container = document.createElement("div");
    container.className = "poster-render-target";
    document.body.appendChild(container);
    const posterEl = document.createElement("div");
    container.appendChild(posterEl);

    await expect(result.current.capturePoster(container)).rejects.toThrow(
      "Poster image could not be created"
    );
  });

  it("surfaces the underlying capture error when toBlob rejects", async () => {
    vi.mocked(toBlob).mockRejectedValue(new Error("cross-origin artwork blocked"));
    const { result } = renderHook(() => useShareablePoster());
    const container = document.createElement("div");
    container.appendChild(document.createElement("div"));
    document.body.appendChild(container);

    await expect(result.current.capturePoster(container)).rejects.toThrow(
      "cross-origin artwork blocked"
    );
  });
  it("uses the first successful capture on Chromium despite its AppleWebKit user agent", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 AppleWebKit/537.36 Chrome/150.0.0.0 Safari/537.36"
    );
    const first = new Blob(["complete"], { type: "image/png" });
    vi.mocked(toBlob).mockResolvedValueOnce(first).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useShareablePoster());
    const container = document.createElement("div");
    container.appendChild(document.createElement("div"));
    document.body.appendChild(container);

    expect(await result.current.capturePoster(container)).toBe(first);
    expect(toBlob).toHaveBeenCalledTimes(1);
  });

  it.each([
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/150.0.0.0 Mobile/15E148 Safari/604.1",
  ])("keeps the primed capture on WebKit (%s)", async (agent) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(agent);
    const first = new Blob(["blank cover"], { type: "image/png" });
    const complete = new Blob(["complete cover"], { type: "image/png" });
    vi.mocked(toBlob).mockResolvedValueOnce(first).mockResolvedValueOnce(complete);
    const { result } = renderHook(() => useShareablePoster());
    const container = document.createElement("div");
    container.appendChild(document.createElement("div"));
    document.body.appendChild(container);

    expect(await result.current.capturePoster(container)).toBe(complete);
    expect(toBlob).toHaveBeenCalledTimes(2);
  });

  it("creates the shared square filename for a poster download and revokes its object URL", () => {
    const { result } = renderHook(() => useShareablePoster());
    const poster = new Blob(["poster"], { type: "image/png" });

    expect(result.current.posterFilename(testEvent)).toBe("salsa-segura-beginner-salsa-night.png");

    const clickSpy = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement");
    createElementSpy.mockImplementationOnce((tagName: string) => {
      const anchor = realCreateElement(tagName) as HTMLAnchorElement;
      anchor.click = clickSpy;
      return anchor;
    });

    act(() => result.current.downloadPoster(testEvent, poster));

    expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(poster);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-poster-url");

    createElementSpy.mockRestore();
  });

  it("appends a -feed suffix to the filename for the feed format", () => {
    const { result } = renderHook(() => useShareablePoster());
    expect(result.current.posterFilename(testEvent, "feed")).toBe(
      "salsa-segura-beginner-salsa-night-feed.png"
    );
    expect(result.current.posterFilename(testEvent, "story")).toBe(
      "salsa-segura-beginner-salsa-night.png"
    );
  });

  it("passes an onImageErrorHandler and skipFonts when the font embed CSS cannot be built", async () => {
    vi.mocked(toBlob).mockResolvedValue(new Blob(["poster"], { type: "image/png" }));
    mockPosterFontEmbedCss.mockRejectedValue(new Error("fonts unavailable"));
    const { result } = renderHook(() => useShareablePoster());
    const container = document.createElement("div");
    container.appendChild(document.createElement("div"));
    document.body.appendChild(container);

    await result.current.capturePoster(container);

    expect(toBlob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onImageErrorHandler: expect.any(Function), skipFonts: true })
    );
    const options = vi.mocked(toBlob).mock.calls[0][1];
    expect(options).not.toHaveProperty("fontEmbedCSS");
    expect(() => options?.onImageErrorHandler?.("", "img", 0)).not.toThrow();
  });

  it("passes the resolved fontEmbedCSS instead of skipFonts when poster fonts embed successfully", async () => {
    vi.mocked(toBlob).mockResolvedValue(new Blob(["poster"], { type: "image/png" }));
    mockPosterFontEmbedCss.mockResolvedValue("@font-face{font-family:'Poster Lettering';}");
    const { result } = renderHook(() => useShareablePoster());
    const container = document.createElement("div");
    container.appendChild(document.createElement("div"));
    document.body.appendChild(container);

    await result.current.capturePoster(container);

    expect(toBlob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fontEmbedCSS: "@font-face{font-family:'Poster Lettering';}" })
    );
    expect(vi.mocked(toBlob).mock.calls[0][1]).not.toHaveProperty("skipFonts");
  });

  describe("createPoster", () => {
    beforeEach(() => {
      vi.mocked(toBlob).mockResolvedValue(new Blob(["poster"], { type: "image/png" }));
    });

    it("renders the resolved flyer as a data URL with artKind flyer when the flyer is ready", async () => {
      mockResolvePosterImageForEvent.mockResolvedValue({
        status: "ready",
        dataUrl: "data:image/png;base64,FLYERBYTES",
      });

      const { result } = renderHook(() => useShareablePoster());
      await result.current.createPoster(testEvent, "story");

      const capturedEl = vi.mocked(toBlob).mock.calls[0][0] as HTMLElement;
      const art = capturedEl.querySelector(".sleeve-cover__art");
      expect(art).toHaveClass("sleeve-cover__art--flyer");
      expect(capturedEl.querySelector(".sleeve-cover__art img")).toHaveAttribute(
        "src",
        "data:image/png;base64,FLYERBYTES"
      );
    });

    it("renders the fallback art with artKind fallback when the flyer is not ready", async () => {
      mockResolvePosterImageForEvent.mockResolvedValue({ status: "missing" });

      const { result } = renderHook(() => useShareablePoster());
      await result.current.createPoster(testEvent, "story");

      const capturedEl = vi.mocked(toBlob).mock.calls[0][0] as HTMLElement;
      const art = capturedEl.querySelector(".sleeve-cover__art");
      expect(art).toHaveClass("sleeve-cover__art--fallback");
      expect(capturedEl.querySelector(".sleeve-cover__art img")).toHaveAttribute(
        "src",
        "/images/event-fallbacks/social.svg"
      );
    });

    it("also falls back to the on-brand art when the flyer resolution is unavailable", async () => {
      mockResolvePosterImageForEvent.mockResolvedValue({ status: "unavailable" });

      const { result } = renderHook(() => useShareablePoster());
      await result.current.createPoster(testEvent, "story");

      const capturedEl = vi.mocked(toBlob).mock.calls[0][0] as HTMLElement;
      expect(capturedEl.querySelector(".sleeve-cover__art")).toHaveClass(
        "sleeve-cover__art--fallback"
      );
    });

    it("always removes the render target from the document, even when capture throws", async () => {
      vi.mocked(toBlob).mockRejectedValue(new Error("capture exploded"));

      const { result } = renderHook(() => useShareablePoster());

      await expect(result.current.createPoster(testEvent, "story")).rejects.toThrow(
        "capture exploded"
      );

      expect(document.querySelector(".poster-render-target")).not.toBeInTheDocument();
    });

    it("removes the render target after a successful capture too", async () => {
      const { result } = renderHook(() => useShareablePoster());

      await result.current.createPoster(testEvent, "story");

      expect(document.querySelector(".poster-render-target")).not.toBeInTheDocument();
    });
    it("keeps different concurrent exports isolated when one capture fails", async () => {
      vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Chrome/150.0");
      let releaseFirst!: () => void;
      const firstPending = new Promise<void>((resolve) => { releaseFirst = resolve; });
      vi.mocked(toBlob).mockImplementation(async (node) => {
        if (node.textContent?.includes("Beginner Salsa Night!")) {
          await firstPending;
          return new Blob([node.textContent ?? ""], { type: "image/png" });
        }
        throw new Error("second export failed");
      });
      const { result } = renderHook(() => useShareablePoster());
      const first = result.current.createPoster(testEvent, "story");
      await vi.waitFor(() => expect(toBlob).toHaveBeenCalledTimes(1));
      await expect(result.current.createPoster({ ...testEvent, id: "2", title: "Bachata Saturday" }, "feed"))
        .rejects.toThrow("second export failed");
      releaseFirst();
      const blob = await first;
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blob);
      });
      expect(text).toContain("Beginner Salsa Night!");
      expect(text).not.toContain("Bachata Saturday");
      expect(document.querySelector(".poster-render-target")).not.toBeInTheDocument();
    });

    it("removes pending render targets when its owner unmounts", async () => {
      let releaseCapture!: (blob: Blob) => void;
      vi.mocked(toBlob).mockImplementation(() => new Promise((resolve) => { releaseCapture = resolve; }));
      const { result, unmount } = renderHook(() => useShareablePoster());
      const pending = result.current.createPoster(testEvent, "story");
      await vi.waitFor(() => expect(toBlob).toHaveBeenCalledTimes(1));
      act(() => unmount());
      expect(document.querySelector(".poster-render-target")).not.toBeInTheDocument();
      releaseCapture(new Blob(["poster"], { type: "image/png" }));
      await expect(pending).rejects.toThrow("Poster export cancelled");
    });
  });

  describe("resolvePosterImage", () => {
    it("inlines a remote flyer so capture does not depend on CORS fetches", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true, blob: async () => new Blob(["flyer"], { type: "image/png" }),
      }));
      expect(await resolvePosterImage("https://cdn.example.com/flyer.png")).toMatch(/^data:image\/png;base64,/);
      vi.unstubAllGlobals();
    });
    it("falls back when a flyer cannot be fetched", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("CORS blocked")));
      expect(await resolvePosterImage("https://cdn.example.com/flyer.png")).toBeNull();
      vi.unstubAllGlobals();
    });
    it("accepts inline artwork and absent flyers", async () => {
      expect(await resolvePosterImage("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
      expect(await resolvePosterImage(undefined)).toBeNull();
    });
  });
});