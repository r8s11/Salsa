import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ScheduleXEvent } from "../model/types";
import InstagramStoryShare from "./InstagramStoryShare";

const posterProps: { event: ScheduleXEvent; imageUrl?: string }[] = [];
const resolvePosterImageForEvent = vi.fn();
const capturePoster = vi.fn();
const downloadPoster = vi.fn();
const removeTarget = vi.fn();

vi.mock("../../calendar/api/posterFlyers", () => ({
  resolvePosterImageForEvent: (params: unknown) => resolvePosterImageForEvent(params),
}));

vi.mock("../../calendar/hooks/useShareablePoster", () => ({
  useShareablePoster: () => ({
    ensureContainer: () => document.createElement("div"),
    capturePoster: (container: HTMLElement) => capturePoster(container),
    posterFilename: (event: ScheduleXEvent) => `salsa-segura-${event.id}.png`,
    downloadPoster: (event: ScheduleXEvent, blob: Blob) => downloadPoster(event, blob),
    removeTarget: () => removeTarget(),
  }),
}));

vi.mock("../../../components/EventModal/ShareableEventPoster", () => ({
  default: (props: { event: ScheduleXEvent; imageUrl?: string }) => {
    posterProps.push(props);
    return <div data-testid="poster" />;
  },
}));

const event: ScheduleXEvent = {
  id: "event-1",
  title: "Stupid Cupido",
  start: "2026-09-05 22:00",
  end: "2026-09-06 02:00",
  calendarId: "social",
  location: "Cambridge, MA",
  priceType: "paid",
  priceAmount: 25,
  imageUrl: "https://cdn.example.com/flyer.jpg",
};

const SHARE_URL = "https://www.salsasegura.com/events/event-1";

function renderShare() {
  return render(
    <InstagramStoryShare
      event={event}
      flyerUrl="https://cdn.example.com/flyer.jpg"
      cachedFlyerUrl={null}
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
  posterProps.length = 0;
  vi.clearAllMocks();
  resolvePosterImageForEvent.mockResolvedValue({
    status: "ready",
    dataUrl: "data:image/jpeg;base64,flyer",
  });
  capturePoster.mockResolvedValue(new Blob(["story"], { type: "image/png" }));
  clipboardWriteText.mockResolvedValue(undefined);
  URL.createObjectURL = vi.fn(() => "blob:story-preview");
  URL.revokeObjectURL = vi.fn();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: clipboardWriteText },
  });
});

afterEach(() => {
  Object.defineProperty(navigator, "share", { configurable: true, value: originalShare });
  Object.defineProperty(navigator, "canShare", { configurable: true, value: originalCanShare });
});

function stubSharing(canShare: boolean, share: () => Promise<void>) {
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => canShare });
  Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn(share) });
}

describe("InstagramStoryShare", () => {
  it("generates a Story image for the selected event and previews it", async () => {
    renderShare();
    await generateStory();

    expect(resolvePosterImageForEvent).toHaveBeenCalledWith({
      eventId: "event-1",
      sourceUrl: "https://cdn.example.com/flyer.jpg",
      cachedUrl: null,
    });
    expect(capturePoster).toHaveBeenCalledOnce();
    expect(posterProps[0].event).toBe(event);
    expect(posterProps[0].imageUrl).toBe("data:image/jpeg;base64,flyer");
    expect(
      screen.getByRole("img", { name: "Instagram Story image for Stupid Cupido" })
    ).toHaveAttribute("src", "blob:story-preview");
  });

  it("falls back to the poster's own artwork when the flyer cannot be used", async () => {
    resolvePosterImageForEvent.mockResolvedValue({ status: "unavailable" });
    renderShare();
    await generateStory();

    expect(posterProps[0].imageUrl).toBeUndefined();
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

    expect(downloadPoster).toHaveBeenCalledOnce();
    expect(clipboardWriteText).toHaveBeenCalledWith(SHARE_URL);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Story image ready. Save the image and share it to Instagram. Event link copied."
    );
    expect(navigator.share).not.toHaveBeenCalled();
  });

  it("reports a generation failure instead of failing silently", async () => {
    capturePoster.mockRejectedValue(new Error("capture failed"));
    renderShare();

    await userEvent.click(screen.getByRole("button", { name: /instagram story/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not create the Story image. Please try again."
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(removeTarget).toHaveBeenCalled();
  });

  it("offers save-image and copy-link actions from the preview", async () => {
    stubSharing(true, async () => undefined);
    renderShare();
    await generateStory();

    await userEvent.click(screen.getByRole("button", { name: "Save image" }));
    expect(downloadPoster).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Story image saved to your downloads."
    );

    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(clipboardWriteText).toHaveBeenCalledWith(SHARE_URL);
  });
});
