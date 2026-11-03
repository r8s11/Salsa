import { afterEach, describe, expect, it, vi } from "vitest";
import { sharePosterFile } from "./sharePosterFile";

const input = {
  blob: new Blob(["png"], { type: "image/png" }),
  filename: "salsa-segura-salsa-night.png",
  title: "Salsa Night",
  url: "https://www.salsasegura.com/events/1",
};

function stubShare(canShare: boolean | undefined, share?: () => Promise<void>) {
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: canShare === undefined ? undefined : vi.fn(() => canShare),
  });
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: vi.fn(share ?? (() => Promise.resolve())),
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "canShare");
  Reflect.deleteProperty(navigator, "share");
});

describe("sharePosterFile", () => {
  it("shares the PNG file with title, text and url", async () => {
    stubShare(true);
    await expect(sharePosterFile(input)).resolves.toBe("shared");
    const [data = {}] = vi.mocked(navigator.share).mock.calls[0];
    expect(data.title).toBe("Salsa Night");
    expect(data.text).toBe("Salsa Night — https://www.salsasegura.com/events/1");
    expect(data.url).toBe("https://www.salsasegura.com/events/1");
    const [file] = data.files ?? [];
    expect(file.name).toBe("salsa-segura-salsa-night.png");
    expect(file.type).toBe("image/png");
  });

  it("reports a dismissed share sheet", async () => {
    stubShare(true, () => Promise.reject(new DOMException("x", "AbortError")));
    await expect(sharePosterFile(input)).resolves.toBe("dismissed");
  });

  it("reports a share that needs a fresh tap", async () => {
    stubShare(true, () => Promise.reject(new DOMException("x", "NotAllowedError")));
    await expect(sharePosterFile(input)).resolves.toBe("needs_fresh_tap");
  });

  it("reports other share failures", async () => {
    stubShare(true, () => Promise.reject(new Error("boom")));
    await expect(sharePosterFile(input)).resolves.toBe("failed");
  });

  it("reports unsupported without sharing when canShare rejects or is missing", async () => {
    stubShare(false);
    await expect(sharePosterFile(input)).resolves.toBe("unsupported");
    expect(navigator.share).not.toHaveBeenCalled();
    stubShare(undefined);
    await expect(sharePosterFile(input)).resolves.toBe("unsupported");
  });
});
