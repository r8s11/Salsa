import type { ReactElement } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render as rtlRender, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventModal from "./EventModal";
import { ScheduleXEvent } from "../../types/events";

const {
  mockEnsureContainer,
  mockCapturePoster,
  mockPosterFilename,
  mockDownloadPoster,
  mockRemoveTarget,
} = vi.hoisted(() => ({
  mockEnsureContainer: vi.fn(),
  mockCapturePoster: vi.fn(),
  mockPosterFilename: vi.fn(
    (event: { title: string }) =>
      `salsa-segura-${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`
  ),
  mockDownloadPoster: vi.fn(),
  mockRemoveTarget: vi.fn(),
}));

vi.mock("../../features/calendar/hooks/useShareablePoster", () => ({
  useShareablePoster: () => ({
    ensureContainer: mockEnsureContainer,
    capturePoster: mockCapturePoster,
    posterFilename: mockPosterFilename,
    downloadPoster: mockDownloadPoster,
    removeTarget: mockRemoveTarget,
  }),
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

  it("shows price and 'Get Tickets' for a paid event", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.getByText("$20")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /get tickets/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("href", "https://example.com/rsvp");
  });

  it("links to the event detail page and closes the quick look", () => {
    const onClose = vi.fn();
    render(<EventModal event={baseEvent} onClose={onClose} />);

    const details = screen.getAllByRole("link", { name: "Full details" })[0];
    expect(details).toHaveAttribute("href", "/events/1");
    fireEvent.click(details);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows 'Free' and 'RSVP · Free' for a free event", () => {
    render(
      <EventModal
        event={{ ...baseEvent, priceType: "free", priceAmount: undefined }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("Free")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /rsvp · free/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("hides the RSVP link when rsvpLink is missing", () => {
    render(<EventModal event={{ ...baseEvent, rsvpLink: undefined }} onClose={() => {}} />);
    expect(screen.queryByRole("link", { name: /get tickets/i })).not.toBeInTheDocument();
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
    // Heading appears in both desktop sidebar and mobile extras
    const headings = screen.getAllByText(/more dates in this series/i);
    expect(headings.length).toBeGreaterThanOrEqual(1);
    // Reserve links appear in both desktop sidebar and mobile extras (= 6 total)
    expect(screen.getAllByText("Reserve").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Repeats weekly")).toBeInTheDocument();
  });

  it("shows the gallery strip with a +N tile only when gallery exists", () => {
    const { rerender } = render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.queryByText(/photos from past nights/i)).not.toBeInTheDocument();
    const gallery = ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"];
    rerender(<EventModal event={{ ...baseEvent, gallery }} onClose={() => {}} />);
    expect(screen.getByText(/photos from past nights/i)).toBeInTheDocument();
    const thumbs = screen.getAllByRole("img");
    expect(thumbs).toHaveLength(4);
    for (const thumb of thumbs) {
      expect(thumb).toHaveAttribute("width", "60");
      expect(thumb).toHaveAttribute("height", "60");
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
    const emailLinks = screen.getAllByRole("link", { name: "hola@studioazul.test" });
    expect(emailLinks.length).toBeGreaterThanOrEqual(1);
    expect(emailLinks[0]).toHaveAttribute("href", "mailto:hola@studioazul.test");
    for (const link of emailLinks) {
      expect(link.closest(".contact-block")).not.toBeNull();
    }

    const igLinks = screen.getAllByRole("link", { name: "@studioazul" });
    expect(igLinks.length).toBeGreaterThanOrEqual(1);
    expect(igLinks[0]).toHaveAttribute("href", "https://instagram.com/studioazul");
    for (const link of igLinks) {
      expect(link.closest(".contact-block")).not.toBeNull();
    }

    const webLinks = screen.getAllByRole("link", { name: "Visit website" });
    expect(webLinks.length).toBeGreaterThanOrEqual(1);
    expect(webLinks[0]).toHaveAttribute("href", "https://example.test/mambo");
  });

  it("renders only the email link when other contacts are absent", () => {
    render(
      <EventModal
        event={{ ...baseEvent, contactEmail: "hola@studioazul.test" }}
        onClose={() => {}}
      />
    );
    const emailLinks = screen.getAllByRole("link", { name: "hola@studioazul.test" });
    expect(emailLinks.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("link", { name: /instagram/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Visit website" })).not.toBeInTheDocument();
  });

  it("omits the Contact heading when no contacts are available", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.queryByRole("heading", { name: "Contact" })).not.toBeInTheDocument();
  });

  it("closes via the back pill", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /back to calendar/i })).toBeInTheDocument();
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

  it("closes when the Escape key is pressed", () => {
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
  });

  it("styles both the quick-facts and recurring-metadata Maps links as address-link", () => {
    render(<EventModal event={{ ...baseEvent, recurrence: "weekly" }} onClose={() => {}} />);
    const links = screen.getAllByLabelText(/Open .* in Maps/i);
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveClass("address-link");
      expect(link).toHaveAttribute(
        "href",
        expect.stringContaining("https://maps.google.com/maps?q=")
      );
    }
  });

  it("renders 'Add to calendar' as a Google Calendar link that opens the calendar", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const calLinks = screen.getAllByRole("link", { name: /add to calendar/i });
    expect(calLinks.length).toBeGreaterThanOrEqual(1);
    expect(calLinks[0]).toHaveAttribute(
      "href",
      expect.stringContaining("https://calendar.google.com/calendar/u/0/r/eventedit?")
    );
    expect(calLinks[0]).toHaveAttribute("target", "_blank");
  });

  it("falls back to an .ics download button when the event has no start/end", () => {
    render(<EventModal event={{ ...baseEvent, start: "", end: "" }} onClose={() => {}} />);
    const buttons = screen.getAllByRole("button", { name: /add to calendar/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
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

  it("shows date, type, title, time, venue, and price in the quick-look region", () => {
    render(<EventModal event={classEvent} onClose={vi.fn()} />);
    expect(screen.getByText(/Monday, August 24, 2026/i)).toBeInTheDocument();
    expect(screen.getByText("class")).toBeInTheDocument();
    expect(screen.getByText("Beginner Salsa Class")).toBeInTheDocument();
    expect(screen.getByText(/7:00 PM - 11:00 PM/i)).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("does not invent class metadata that is absent from the event", () => {
    render(<EventModal event={{ ...classEvent, location: "Dance Studio A" }} onClose={vi.fn()} />);
    expect(screen.queryByText(/Expected level|Teacher|Class length/i)).not.toBeInTheDocument();
  });
});

describe("share poster", () => {
  beforeEach(() => {
    mockEnsureContainer.mockReset();
    mockEnsureContainer.mockImplementation(() => document.createElement("div"));
    mockCapturePoster.mockReset();
    mockPosterFilename.mockReset();
    mockPosterFilename.mockImplementation(
      (event: { title: string }) =>
        `salsa-segura-${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`
    );
    mockDownloadPoster.mockReset();
    mockRemoveTarget.mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "canShare");
    Reflect.deleteProperty(navigator, "share");
  });

  it("renders a single Share action in both action regions with no format-picker remnants", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.getAllByRole("button", { name: "Share" })).toHaveLength(2);
    expect(screen.queryByText(/download poster/i)).not.toBeInTheDocument();
    expect(screen.queryByText("1:1")).not.toBeInTheDocument();
    expect(screen.queryByText("9:16")).not.toBeInTheDocument();
  });

  it("shares a single square PNG File with event-title metadata when native file sharing is available", async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "canShare", { value: vi.fn(() => true), configurable: true });
    Object.defineProperty(navigator, "share", { value: shareSpy, configurable: true });
    mockCapturePoster.mockImplementation(async (container: HTMLElement) => {
      expect(container.firstElementChild).toHaveClass("shareable-poster", "poster-square");
      return new Blob(["poster"], { type: "image/png" });
    });

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const [shareButton] = screen.getAllByRole("button", { name: "Share" });
    fireEvent.click(shareButton);

    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    const [{ title, files }] = shareSpy.mock.calls[0];
    expect(title).toBe(baseEvent.title);
    expect(files).toHaveLength(1);
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0].type).toBe("image/png");
    expect(files[0].name).toBe("salsa-segura-test-social.png");
    expect(mockDownloadPoster).not.toHaveBeenCalled();

    await waitFor(() => expect(mockRemoveTarget).toHaveBeenCalled());
    expect(shareButton).not.toBeDisabled();
  });

  it("downloads the poster PNG directly when native file sharing is unavailable", async () => {
    const shareSpy = vi.fn();
    Object.defineProperty(navigator, "share", { value: shareSpy, configurable: true });
    const blob = new Blob(["poster"], { type: "image/png" });
    mockCapturePoster.mockResolvedValue(blob);

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const [shareButton] = screen.getAllByRole("button", { name: "Share" });
    fireEvent.click(shareButton);

    await waitFor(() => expect(mockDownloadPoster).toHaveBeenCalledTimes(1));
    expect(mockDownloadPoster).toHaveBeenCalledWith(baseEvent, blob);
    expect(shareSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(mockRemoveTarget).toHaveBeenCalled());
    expect(shareButton).not.toBeDisabled();
  });

  it("clears the generating state without a fallback download when the user cancels the native share sheet", async () => {
    Object.defineProperty(navigator, "canShare", { value: vi.fn(() => true), configurable: true });
    const abortError = new DOMException("cancelled", "AbortError");
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(abortError),
      configurable: true,
    });
    mockCapturePoster.mockResolvedValue(new Blob(["poster"], { type: "image/png" }));

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const [shareButton] = screen.getAllByRole("button", { name: "Share" });
    fireEvent.click(shareButton);

    await waitFor(() => expect(shareButton).not.toBeDisabled());
    expect(mockDownloadPoster).not.toHaveBeenCalled();
    expect(mockRemoveTarget).toHaveBeenCalled();
  });

  it("clears the generating state and removes the render target when poster capture fails", async () => {
    mockCapturePoster.mockRejectedValue(new Error("Poster image could not be created"));
    const shareSpy = vi.fn();
    Object.defineProperty(navigator, "share", { value: shareSpy, configurable: true });

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const [shareButton] = screen.getAllByRole("button", { name: "Share" });
    fireEvent.click(shareButton);

    await waitFor(() => expect(shareButton).not.toBeDisabled());
    expect(shareSpy).not.toHaveBeenCalled();
    expect(mockDownloadPoster).not.toHaveBeenCalled();
    expect(mockRemoveTarget).toHaveBeenCalled();
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
    const copyButtons = screen.getAllByRole("button", { name: "Copy event link" });
    expect(copyButtons).toHaveLength(2);
    await act(async () => {
      fireEvent.click(copyButtons[0]);
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/events/1`);
    expect(copyButtons[0]).toHaveTextContent("Copied");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(copyButtons[0]).toHaveTextContent("Copy link");
    vi.useRealTimers();
  });

  it("keeps the Copy link label when the clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const [copyButton] = screen.getAllByRole("button", { name: "Copy event link" });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(copyButton).toHaveTextContent("Copy link");
    errorSpy.mockRestore();
  });
});
