import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeLinkCard } from "./linkCard";

/** Encoded size per JPEG quality, standing in for the browser's encoder. */
const SIZES: Record<string, number> = {
  "0.82": 520_000,
  "0.74": 410_000,
  "0.66": 299_000,
  "0.58": 240_000,
  "0.5": 200_000,
  "0.42": 160_000,
};

const drawImage = vi.fn();
let qualities: number[] = [];

beforeEach(() => {
  qualities = [];
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 1200, height: 630, close: vi.fn() })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ({ drawImage }) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback: (blob: Blob | null) => void,
    type?: string,
    quality?: number,
  ) {
    qualities.push(quality!);
    callback(new Blob([new Uint8Array(SIZES[String(quality)])], { type }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  drawImage.mockReset();
});

describe("encodeLinkCard", () => {
  it("steps JPEG quality down from 0.82 and stops at the first size under the cap", async () => {
    const png = new Blob(["png"], { type: "image/png" });
    const jpeg = await encodeLinkCard(png);

    expect(createImageBitmap).toHaveBeenCalledWith(png);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1200, 630);
    expect(qualities).toEqual([0.82, 0.74, 0.66]);
    expect(jpeg.type).toBe("image/jpeg");
    expect(jpeg.size).toBe(299_000);
  });

  it("throws once quality would drop below 0.42", async () => {
    await expect(encodeLinkCard(new Blob(["png"]), 100_000)).rejects.toThrow("Link preview image is too large");
    expect(qualities).toEqual([0.82, 0.74, 0.66, 0.58, 0.5, 0.42]);
  });
});
