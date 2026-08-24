import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toBlob } from "html-to-image";
import { useShareablePoster } from "./useShareablePoster";
import { ScheduleXEvent } from "../../../types/events";

vi.mock("html-to-image", () => ({
  toBlob: vi.fn(),
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
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("throws when the mounted poster capture yields no blob", async () => {
    vi.mocked(toBlob).mockResolvedValue(null);
    const { result } = renderHook(() => useShareablePoster());
    const container = result.current.ensureContainer();
    const posterEl = document.createElement("div");
    container.appendChild(posterEl);

    await expect(result.current.capturePoster(container)).rejects.toThrow(
      "Poster image could not be created"
    );
  });

  it("surfaces the underlying capture error when toBlob rejects", async () => {
    vi.mocked(toBlob).mockRejectedValue(new Error("cross-origin artwork blocked"));
    const { result } = renderHook(() => useShareablePoster());
    const container = result.current.ensureContainer();
    container.appendChild(document.createElement("div"));

    await expect(result.current.capturePoster(container)).rejects.toThrow(
      "cross-origin artwork blocked"
    );
  });

  it("creates the shared square filename for a poster download and revokes its object URL", () => {
    const { result } = renderHook(() => useShareablePoster());
    const poster = new Blob(["poster"], { type: "image/png" });

    expect(result.current.posterFilename(testEvent)).toBe(
      "salsa-segura-beginner-salsa-night.png"
    );

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

  it("passes an onImageErrorHandler so a broken flyer degrades instead of failing the capture", async () => {
    vi.mocked(toBlob).mockResolvedValue(new Blob(["poster"], { type: "image/png" }));
    const { result } = renderHook(() => useShareablePoster());
    const container = result.current.ensureContainer();
    container.appendChild(document.createElement("div"));

    await result.current.capturePoster(container);

    expect(toBlob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onImageErrorHandler: expect.any(Function) })
    );
    const options = vi.mocked(toBlob).mock.calls[0][1];
    expect(() => options?.onImageErrorHandler?.("", "img", 0)).not.toThrow();
  });
});
