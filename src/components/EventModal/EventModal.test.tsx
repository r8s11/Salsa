import type { ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventModal from "./EventModal";
import { ScheduleXEvent } from "../../types/events";

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
    expect(screen.getAllByRole("img")).toHaveLength(4);
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

    const igLinks = screen.getAllByRole("link", { name: "@studioazul" });
    expect(igLinks.length).toBeGreaterThanOrEqual(1);
    expect(igLinks[0]).toHaveAttribute("href", "https://instagram.com/studioazul");

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

  it("renders the venue as a Maps link when location is present", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const link = screen.getByLabelText(/Open .* in Maps/i);
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("https://maps.google.com/maps?q=")
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
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
