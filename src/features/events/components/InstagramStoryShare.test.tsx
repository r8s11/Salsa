import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ScheduleXEvent } from "../model/types";
import InstagramStoryShare from "./InstagramStoryShare";

const mockCreatePoster = vi.fn();
const mockPosterFilename = vi.fn();
const mockDownloadPoster = vi.fn();

vi.mock("../../calendar/hooks/useShareablePoster", () => ({
  useShareablePoster: () => ({
    createPoster: mockCreatePoster,
    posterFilename: mockPosterFilename,
    downloadPoster: mockDownloadPoster,
  }),
}));

const event: ScheduleXEvent = {
  id: "event-1",
  title: "Stupid Cupido",
  start: "2026-08-24 19:00",
  end: "2026-08-24 23:00",
  calendarId: "social",
};

const SHARE_URL = "https://www.salsasegura.com/events/event-1";
const FLYER_URL = "https://cdn.example.com/flyer.jpg";
const CACHED_URL = "https://cdn.example.com/cached.jpg";

function renderShare() {
  return render(
    <InstagramStoryShare
      event={event}
      flyerUrl={FLYER_URL}
      cachedFlyerUrl={CACHED_URL}
      shareUrl={SHARE_URL}
    />
  );
}

async function generateStory() {
  await userEvent.click(screen.getByRole("button", { name: /instagram story/i }));
  await waitFor(() =>
    expect(screen.getByRole("dialog", { name: "Story preview" })).toBeInTheDocument()
  );
}

const originalShare = navigator.share;
const originalCanShare = navigator.canShare;
const clipboardWriteText = vi.fn();

beforeEach(() => {
  mockCreatePoster.mockReset();
  mockCreatePoster.mockResolvedValue(new Blob(["poster"], { type: "image/png" }));
  mockPosterFilename.mockReset();
  mockPosterFilename.mockImplementation(
    (evt: { title: string }) => `salsa-segura-${evt.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`
  );
  mockDownloadPoster.mockReset();
  clipboardWriteText.mockReset();
  clipboardWriteText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: clipboardWriteText },
    configurable: true,
  });
  globalThis.URL.createObjectURL = vi.fn(() => "blob:story-preview");
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  Object.defineProperty(navigator, "share", { value: originalShare, configurable: true });
  Object.defineProperty(navigator, "canShare", { value: originalCanShare, configurable: true });
  Reflect.deleteProperty(navigator, "clipboard");
});

function stubSharing(canShare: boolean, share: () => Promise<void>) {
  Object.defineProperty(navigator, "canShare", { value: vi.fn(() => canShare), configurable: true });
  Object.defineProperty(navigator, "share", { value: vi.fn(share), configurable: true });
}

describe("InstagramStoryShare", () => {
  it("generates a Story image for the selected event and previews it via createPoster", async () => {
    renderShare();
    await generateStory();

    expect(mockCreatePoster).toHaveBeenCalledWith(event, "story", {
      sourceUrl: FLYER_URL,
      cachedUrl: CACHED_URL,
    });
    expect(
      screen.getByRole("img", { name: "Instagram Story image for Stupid Cupido" })
    ).toHaveAttribute("src", "blob:story-preview");
  });

  it("hands the Story file to the native share sheet with the canonical event URL", async () => {
    stubSharing(true, async () => undefined);
    renderShare();
    await generateStory();

    await userEvent.click(screen.getByRole("button", { name: "Share" }));

    const payload = vi.mocked(navigator.share).mock.calls[0][0] as {
      files: File[];
      title: string;
      text: string;
    };
    expect(payload.files[0]).toBeInstanceOf(File);
    expect(payload.files[0].type).toBe("image/png");
    expect(payload.title).toBe("Stupid Cupido");
    expect(payload.text).toContain(SHARE_URL);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Story image shared. Pick Instagram in the share sheet to post it."
    );
  });

  it("treats a dismissed share sheet as a non-failure", async () => {
    stubSharing(true, () => Promise.reject(new DOMException("cancelled", "AbortError")));
    renderShare();
    await generateStory();

    await userEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reports an actual share failure", async () => {
    stubSharing(true, () => Promise.reject(new TypeError("share broke")));
    renderShare();
    await generateStory();

    await userEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sharing failed. Save the image and share it to Instagram instead."
    );
  });

  it("saves the image and copies the link when file sharing is unsupported", async () => {
    stubSharing(false, async () => undefined);
    renderShare();
    await generateStory();

    await userEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(mockDownloadPoster).toHaveBeenCalledOnce();
    expect(clipboardWriteText).toHaveBeenCalledWith(SHARE_URL);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Story image ready. Save the image and share it to Instagram. Event link copied."
    );
    expect(navigator.share).not.toHaveBeenCalled();
  });

  it("reports a generation failure instead of failing silently", async () => {
    mockCreatePoster.mockRejectedValue(new Error("capture failed"));
    renderShare();

    await userEvent.click(screen.getByRole("button", { name: /instagram story/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not create the Story image. Please try again."
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers save-image and copy-link actions from the preview", async () => {
    stubSharing(true, async () => undefined);
    renderShare();
    await generateStory();

    await userEvent.click(screen.getByRole("button", { name: "Save image" }));
    expect(mockDownloadPoster).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Story image saved to your downloads."
    );

    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(clipboardWriteText).toHaveBeenCalledWith(SHARE_URL);
  });
});
