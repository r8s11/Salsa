import type { ReactElement } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render as rtlRender, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventModal from "./EventModal";
import { recordEventTouch } from "../../features/events/api/eventsRepo";

import { ScheduleXEvent } from "../../types/events";

const { mockCreatePoster, mockPosterFilename, mockDownloadPoster } = vi.hoisted(() => ({
  mockCreatePoster: vi.fn(),
  mockPosterFilename: vi.fn(
    (event: { title: string }, format: string = "story") =>
      `salsa-segura-${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}${
        format === "feed" ? "-feed" : ""
      }.png`
  ),
  mockDownloadPoster: vi.fn(),
}));

vi.mock("../../features/calendar/hooks/useShareablePoster", () => ({
  useShareablePoster: () => ({
    createPoster: mockCreatePoster,
    posterFilename: mockPosterFilename,
    downloadPoster: mockDownloadPoster,
  }),
}));

vi.mock("./posterFonts", () => ({
  ensurePosterFonts: vi.fn().mockResolvedValue(undefined),
  posterFontEmbedCss: vi.fn().mockResolvedValue(""),
}));

vi.mock("../../features/events/api/eventsRepo", () => ({
  recordEventTouch: vi.fn(),
}));

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

const baseEvent: ScheduleXEvent = {
  id: "1",
  title: "Test Social",
  start: "2026-07-18 20:00",
  end: "2026-07-19 00:00",
  calendarId: "social",
  location: "Havana Club",
  rsvpLink: "https://example.com/rsvp",
  priceType: "paid",
  priceAmount: 20,
};

describe("EventModal", () => {
  it("renders nothing when event is null", () => {
    const { container } = render(<EventModal event={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses the public default fallback art on the sleeve thumbnail when no flyer is available", () => {
    const { container } = render(<EventModal event={baseEvent} onClose={() => {}} />);
    const sleeveImg = container.querySelector(".night-card__sleeve img") as HTMLImageElement;
    expect(sleeveImg.getAttribute("src")).toMatch(/\/images\/event-fallbacks\/.+\.svg/);
    const art = container.querySelector(".night-card__sleeve .sleeve-cover__art");
    expect(art).toHaveClass("sleeve-cover__art--fallback");
  });

  it("shows price and 'Get Tickets' for a paid event", () => {
    const { container } = render(<EventModal event={baseEvent} onClose={() => {}} />);
    const priceEl = container.querySelector(".night-card__price-amount");
    expect(priceEl).toHaveTextContent("$20");
    const links = screen.getAllByRole("link", { name: /get tickets/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("href", "https://example.com/rsvp");
  });

  it("links to the event detail page and closes the modal", () => {
    const onClose = vi.fn();
    render(<EventModal event={baseEvent} onClose={onClose} />);

    const details = screen.getAllByRole("link", { name: "Full details" })[0];
    expect(details).toHaveAttribute("href", "/events/1");
    fireEvent.click(details);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders Full details as a link (never a close button) regardless of origin", () => {
    const onClose = vi.fn();
    render(<EventModal event={baseEvent} onClose={onClose} />);
    const details = screen.getAllByRole("link", { name: "Full details" })[0];
    expect(details).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Full details" })).not.toBeInTheDocument();
    fireEvent.click(details);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("resolves Full details to this event's own id, not a fallback route", () => {
    const onClose = vi.fn();
    render(<EventModal event={{ ...baseEvent, id: "abc123" }} onClose={onClose} />);
    const details = screen.getAllByRole("link", { name: "Full details" })[0];
    expect(details).toHaveAttribute("href", "/events/abc123");
    expect(details).not.toHaveAttribute("href", "/calendar");
    expect(details).not.toHaveAttribute("href", "/");
  });

  it("shows 'Free' and 'RSVP · Free' for a free event", () => {
    const { container } = render(
      <EventModal
        event={{ ...baseEvent, priceType: "free", priceAmount: undefined }}
        onClose={() => {}}
      />
    );
    const priceEl = container.querySelector(".night-card__price-amount");
    expect(priceEl).toHaveTextContent("Free");
    const links = screen.getAllByRole("link", { name: /rsvp · free/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("hides the RSVP link when rsvpLink is missing", () => {
    render(<EventModal event={{ ...baseEvent, rsvpLink: undefined }} onClose={() => {}} />);
    expect(screen.queryByRole("link", { name: /get tickets/i })).not.toBeInTheDocument();
  });

  it("gives initial focus to the always-visible Close control", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("keeps ticketing copy price-aware and never invents a walk-in policy", () => {
    const { rerender } = render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.getByText("Tickets on the host's page")).toBeInTheDocument();
    expect(screen.queryByText(/pay at the door/i)).not.toBeInTheDocument();

    rerender(
      <EventModal
        event={{ ...baseEvent, priceType: "free", priceAmount: undefined }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/RSVP on the host's page · free entry/i)).toBeInTheDocument();

    rerender(
      <EventModal
        event={{ ...baseEvent, rsvpLink: undefined, contactEmail: "hola@studioazul.test" }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("No online tickets. Reach the host below.")).toBeInTheDocument();

    rerender(<EventModal event={{ ...baseEvent, rsvpLink: undefined }} onClose={() => {}} />);
    expect(document.querySelector(".reassurance")).toBeNull();
  });

  it("shows the host row only when host is present", () => {
    const { rerender } = render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.queryByText(/with DJ Cocolo/)).not.toBeInTheDocument();
    rerender(<EventModal event={{ ...baseEvent, host: "DJ Cocolo" }} onClose={() => {}} />);
    expect(screen.getByText("with DJ Cocolo")).toBeInTheDocument();
  });

  it("shows the series list with 3 dates only for weekly recurrence", () => {
    const { rerender } = render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.queryByText(/more dates in this series/i)).not.toBeInTheDocument();
    rerender(<EventModal event={{ ...baseEvent, recurrence: "weekly" }} onClose={() => {}} />);
    expect(screen.getByText(/more dates in this series/i)).toBeInTheDocument();
    expect(screen.getAllByText("Reserve")).toHaveLength(3);
    expect(screen.getByText("Repeats weekly")).toBeInTheDocument();
  });

  it("shows the gallery strip with a +N tile only when gallery exists", () => {
    const { rerender } = render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.queryByText(/photos from past nights/i)).not.toBeInTheDocument();
    const gallery = ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"];
    rerender(<EventModal event={{ ...baseEvent, gallery }} onClose={() => {}} />);
    expect(screen.getByText(/photos from past nights/i)).toBeInTheDocument();
    const thumbs = screen.getAllByRole("img", { name: /gallery image/i });
    expect(thumbs).toHaveLength(4);
    for (const thumb of thumbs) {
      expect(thumb).toHaveAttribute("class", "gallery-thumb");
      expect(thumb).toHaveAttribute("loading", "lazy");
    }
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders each available public contact link", () => {
    render(
      <EventModal
        event={{
          ...baseEvent,
          contactEmail: "hola@studioazul.test",
          contactInstagram: "@studioazul",
          contactWebsite: "https://example.test/mambo",
        }}
        onClose={() => {}}
      />
    );
    const emailLink = screen.getByRole("link", { name: "hola@studioazul.test" });
    expect(emailLink).toHaveAttribute("href", "mailto:hola@studioazul.test");
    expect(emailLink.closest(".contact-block")).not.toBeNull();

    const igLink = screen.getByRole("link", { name: "@studioazul" });
    expect(igLink).toHaveAttribute("href", "https://instagram.com/studioazul");
    expect(igLink.closest(".contact-block")).not.toBeNull();

    const webLink = screen.getByRole("link", { name: "Visit website" });
    expect(webLink).toHaveAttribute("href", "https://example.test/mambo");
  });

  it("renders only the email link when other contacts are absent", () => {
    render(
      <EventModal
        event={{ ...baseEvent, contactEmail: "hola@studioazul.test" }}
        onClose={() => {}}
      />
    );
    expect(screen.getByRole("link", { name: "hola@studioazul.test" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /instagram/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Visit website" })).not.toBeInTheDocument();
  });

  it("omits the Contact heading when no contacts are available", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.queryByRole("heading", { name: "Contact" })).not.toBeInTheDocument();
  });

  it("shows the event title as the modal heading", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Test Social" })).toHaveAttribute(
      "id",
      "modal-title"
    );
  });

  it("renders a sticky close (X) button that calls onClose", () => {
    const onClose = vi.fn();
    render(<EventModal event={baseEvent} onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: "Close" });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the Escape key is pressed on the card view", () => {
    const onClose = vi.fn();
    render(<EventModal event={baseEvent} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose on Escape when no event is open", () => {
    const onClose = vi.fn();
    render(<EventModal event={null} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders the venue as a Maps link styled with address-link when location is present", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const link = screen.getByLabelText(/Open .* in Maps/i);
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("https://maps.google.com/maps?q=")
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("address-link");
    expect(link).toHaveTextContent("Havana Club");
  });

  it("renders a separate address note beside the venue link when address is present", () => {
    const { container } = render(
      <EventModal event={{ ...baseEvent, address: "123 Main St" }} onClose={() => {}} />
    );
    expect(container.querySelector(".night-card__address")).toHaveTextContent("123 Main St");
  });

  it("renders 'Add to calendar' as a Google Calendar link that opens the calendar", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const calLink = screen.getByRole("link", { name: /add to calendar/i });
    expect(calLink).toHaveAttribute(
      "href",
      expect.stringContaining("https://calendar.google.com/calendar/u/0/r/eventedit?")
    );
    expect(calLink).toHaveAttribute("target", "_blank");
  });

  it("falls back to an .ics download button when the event has no start/end", () => {
    render(<EventModal event={{ ...baseEvent, start: "", end: "" }} onClose={() => {}} />);
    const button = screen.getByRole("button", { name: /add to calendar/i });
    expect(button).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /add to calendar/i })).not.toBeInTheDocument();
  });
});

describe("quick-look region", () => {
  const classEvent: ScheduleXEvent = {
    id: "2",
    title: "Beginner Salsa Class",
    start: "2026-08-24 19:00",
    end: "2026-08-24 23:00",
    calendarId: "class",
    location: "Dance Studio A",
    priceType: "free",
  };

  it("shows date, type, title, time, venue, and price in the night card", () => {
    const { container } = render(<EventModal event={classEvent} onClose={vi.fn()} />);
    // Date is shown without a year.
    expect(screen.getByText(/Monday, August 24/i)).toBeInTheDocument();
    expect(screen.queryByText(/Monday, August 24, 2026/i)).not.toBeInTheDocument();
    expect(screen.getByText("class")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Beginner Salsa Class", level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByText(/7:00 PM - 11:00 PM/i)).toBeInTheDocument();
    expect(container.querySelector(".night-card__price-amount")).toHaveTextContent("Free");
  });

  it("does not invent class metadata that is absent from the event", () => {
    render(<EventModal event={{ ...classEvent, location: "Dance Studio A" }} onClose={vi.fn()} />);
    expect(screen.queryByText(/Expected level|Teacher|Class length/i)).not.toBeInTheDocument();
  });
});

describe("share poster", () => {
  beforeEach(() => {
    mockCreatePoster.mockReset();
    mockCreatePoster.mockResolvedValue(new Blob(["poster"], { type: "image/png" }));
    mockPosterFilename.mockClear();
    mockDownloadPoster.mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "canShare");
    Reflect.deleteProperty(navigator, "share");
  });

  it("renders 'Send to friends' in both action regions (card and bar)", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.getAllByRole("button", { name: "Send to friends" })).toHaveLength(2);
  });

  it("shares a single Story PNG File with a separate canonical event URL", async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    const canShareSpy = vi.fn(() => true);
    Object.defineProperty(navigator, "canShare", { value: canShareSpy, configurable: true });
    Object.defineProperty(navigator, "share", { value: shareSpy, configurable: true });

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const [shareButton] = screen.getAllByRole("button", { name: "Send to friends" });
    fireEvent.click(shareButton);

    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    expect(mockCreatePoster).toHaveBeenCalledWith(baseEvent, "story");
    const [{ title, text, url, files }] = shareSpy.mock.calls[0];
    expect(title).toBe(baseEvent.title);
    expect(text).toContain(`${window.location.origin}/events/1`);
    expect(url).toBe(`${window.location.origin}/events/1`);
    expect(canShareSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [expect.any(File)],
        url: `${window.location.origin}/events/1`,
      })
    );
    expect(files).toHaveLength(1);
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0].type).toBe("image/png");
    expect(files[0].name).toBe("salsa-segura-test-social.png");
    expect(mockDownloadPoster).not.toHaveBeenCalled();
    await waitFor(() => expect(shareButton).not.toBeDisabled());
  });

  it("downloads the poster PNG directly with a status message when native file sharing is unavailable", async () => {
    const shareSpy = vi.fn();
    Object.defineProperty(navigator, "share", { value: shareSpy, configurable: true });

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const [shareButton] = screen.getAllByRole("button", { name: "Send to friends" });
    fireEvent.click(shareButton);

    await waitFor(() => expect(mockDownloadPoster).toHaveBeenCalledTimes(1));
    expect(mockDownloadPoster).toHaveBeenCalledWith(baseEvent, expect.any(Blob), "story");
    expect(shareSpy).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Sharing isn't available here, so the poster was downloaded instead."
    );
    await waitFor(() => expect(shareButton).not.toBeDisabled());
  });

  it("announces a retry when the native share fails without a user cancel", async () => {
    Object.defineProperty(navigator, "canShare", { value: vi.fn(() => true), configurable: true });
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(new Error("share sheet unavailable")),
      configurable: true,
    });

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const [shareButton] = screen.getAllByRole("button", { name: "Send to friends" });
    fireEvent.click(shareButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sending the poster failed. Please try again."
    );
    expect(mockDownloadPoster).not.toHaveBeenCalled();
    await waitFor(() => expect(shareButton).not.toBeDisabled());
  });

  it("offers a fresh-tap download when native sharing rejects expired activation", async () => {
    Object.defineProperty(navigator, "canShare", { value: vi.fn(() => true), configurable: true });
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(new DOMException("activation expired", "NotAllowedError")),
      configurable: true,
    });

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const [shareButton] = screen.getAllByRole("button", { name: "Send to friends" });
    fireEvent.click(shareButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sharing needs a fresh tap. Download the poster instead."
    );
    const downloadButton = screen.getByRole("button", { name: "Download poster" });
    expect(mockDownloadPoster).not.toHaveBeenCalled();

    fireEvent.click(downloadButton);

    expect(mockDownloadPoster).toHaveBeenCalledWith(baseEvent, expect.any(Blob), "story");
    expect(await screen.findByRole("status")).toHaveTextContent("Poster saved to your downloads.");
  });

  it("silently ignores an AbortError from a cancelled native share sheet", async () => {
    Object.defineProperty(navigator, "canShare", { value: vi.fn(() => true), configurable: true });
    const abortError = new DOMException("cancelled", "AbortError");
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(abortError),
      configurable: true,
    });

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const [shareButton] = screen.getAllByRole("button", { name: "Send to friends" });
    fireEvent.click(shareButton);

    await waitFor(() => expect(shareButton).not.toBeDisabled());
    expect(mockDownloadPoster).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("announces a retry and re-enables the button when poster capture fails", async () => {
    mockCreatePoster.mockRejectedValue(new Error("Poster image could not be created"));
    const shareSpy = vi.fn();
    Object.defineProperty(navigator, "share", { value: shareSpy, configurable: true });

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const [shareButton] = screen.getAllByRole("button", { name: "Send to friends" });
    fireEvent.click(shareButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not create the poster/i);
    await waitFor(() => expect(shareButton).not.toBeDisabled());
    expect(shareSpy).not.toHaveBeenCalled();
    expect(mockDownloadPoster).not.toHaveBeenCalled();
  });
});

describe("poster preview", () => {
  beforeEach(() => {
    mockCreatePoster.mockReset();
    mockCreatePoster.mockResolvedValue(new Blob(["poster"], { type: "image/png" }));
    mockPosterFilename.mockClear();
    mockDownloadPoster.mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "canShare");
    Reflect.deleteProperty(navigator, "share");
  });

  it("opens the poster preview when the sleeve thumbnail is clicked", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview the poster your friends get" }));

    expect(screen.getByRole("heading", { name: "The poster your friends get" })).toHaveAttribute(
      "id",
      "modal-title"
    );
    expect(screen.getByRole("button", { name: "Back to the night" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "The poster your friends get" })
    ).toBeInTheDocument();
  });

  it("toggles aria-pressed between Story and Feed format buttons", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview the poster your friends get" }));

    const storyButton = screen.getByRole("button", { name: "Story · 9:16" });
    const feedButton = screen.getByRole("button", { name: "Feed · 4:5" });
    expect(storyButton).toHaveAttribute("aria-pressed", "true");
    expect(feedButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(feedButton);

    expect(storyButton).toHaveAttribute("aria-pressed", "false");
    expect(feedButton).toHaveAttribute("aria-pressed", "true");
  });

  it("resizes the visible poster when switching between Story and Feed", () => {
    const width = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("poster-stage--story")) return 300;
        if (this.classList.contains("poster-stage--feed")) return 380;
        return 0;
      });
    try {
      const { container } = render(<EventModal event={baseEvent} onClose={() => {}} />);
      fireEvent.click(screen.getByRole("button", { name: "Preview the poster your friends get" }));
      const stage = container.querySelector(".poster-stage") as HTMLElement;
      expect(stage).toHaveStyle({ height: "533.3333333333334px" });

      fireEvent.click(screen.getByRole("button", { name: "Feed · 4:5" }));
      expect(stage).toHaveStyle({ height: "475px" });

      fireEvent.click(screen.getByRole("button", { name: "Story · 9:16" }));
      expect(stage).toHaveStyle({ height: "533.3333333333334px" });
    } finally {
      width.mockRestore();
    }
  });

  it("returns to the card and focuses the sleeve on Escape, closes the modal on the second Escape", async () => {
    const onClose = vi.fn();
    render(<EventModal event={baseEvent} onClose={onClose} />);
    const sleeveButton = screen.getByRole("button", {
      name: "Preview the poster your friends get",
    });
    fireEvent.click(sleeveButton);

    expect(
      screen.getByRole("heading", { name: "The poster your friends get" })
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: baseEvent.title })).toHaveAttribute(
        "id",
        "modal-title"
      )
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Preview the poster your friends get" })
      ).toHaveFocus()
    );
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("saves the image in the currently selected format", async () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview the poster your friends get" }));
    fireEvent.click(screen.getByRole("button", { name: "Feed · 4:5" }));

    fireEvent.click(screen.getByRole("button", { name: "Save image" }));

    await waitFor(() => expect(mockCreatePoster).toHaveBeenCalledWith(baseEvent, "feed"));
    await waitFor(() =>
      expect(mockDownloadPoster).toHaveBeenCalledWith(baseEvent, expect.any(Blob), "feed")
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Poster saved to your downloads.");
  });

  it("sends this poster in the currently selected format from the preview", async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "canShare", { value: vi.fn(() => true), configurable: true });
    Object.defineProperty(navigator, "share", { value: shareSpy, configurable: true });

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview the poster your friends get" }));
    fireEvent.click(screen.getByRole("button", { name: "Feed · 4:5" }));

    fireEvent.click(screen.getByRole("button", { name: "Send this poster" }));
    await waitFor(() => expect(mockCreatePoster).toHaveBeenCalledWith(baseEvent, "feed"));
    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
  });

  it("disables poster actions while sharing and restores them when capture finishes", async () => {
    let finishCapture!: (poster: Blob) => void;
    mockCreatePoster.mockImplementationOnce(
      () => new Promise<Blob>((resolve) => { finishCapture = resolve; })
    );
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview the poster your friends get" }));

    const send = screen.getByRole("button", { name: "Send this poster" });
    const save = screen.getByRole("button", { name: "Save image" });
    fireEvent.click(send);

    expect(send).toBeDisabled();
    expect(save).toBeDisabled();
    await act(async () => {
      finishCapture(new Blob(["poster"], { type: "image/png" }));
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Sharing isn't available here, so the poster was downloaded instead."
    );
    expect(send).toBeEnabled();
    expect(save).toBeEnabled();
  });
});

describe("copy event link", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("copies the event URL to the clipboard and shows Copied feedback", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<EventModal event={baseEvent} onClose={() => {}} />);

    const copyButton = screen.getByRole("button", { name: "Copy link" });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/events/1`);
    expect(copyButton).toHaveTextContent("Copied");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(copyButton).toHaveTextContent("Copy link");
    vi.useRealTimers();
  });

  it("announces a visible error and keeps the Copy link label when the clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const copyButton = screen.getByRole("button", { name: "Copy link" });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(copyButton).toHaveTextContent("Copy link");
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not copy/i);
  });
});

describe("demand telemetry", () => {
  beforeEach(() => {
    vi.mocked(recordEventTouch).mockClear();
  });

  it("records an rsvp_click touch when an RSVP link is clicked", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);

    const rsvpLinks = screen.getAllByRole("link", { name: /get tickets|RSVP · Free/i });
    fireEvent.click(rsvpLinks[0]);

    expect(recordEventTouch).toHaveBeenCalledWith(String(baseEvent.id), "rsvp_click");
  });
});
