import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EventModal from "./EventModal";
import { ScheduleXEvent } from "../../types/events";

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
    expect(screen.getByRole("link", { name: /get tickets/i })).toHaveAttribute(
      "href",
      "https://example.com/rsvp"
    );
  });

  it("shows 'Free' and 'RSVP · Free' for a free event", () => {
    render(
      <EventModal
        event={{ ...baseEvent, priceType: "free", priceAmount: undefined }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rsvp · free/i })).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: "hola@studioazul.test" })).toHaveAttribute(
      "href",
      "mailto:hola@studioazul.test"
    );
    expect(screen.getByRole("link", { name: "@studioazul" })).toHaveAttribute(
      "href",
      "https://instagram.com/studioazul"
    );
    expect(screen.getByRole("link", { name: "Visit website" })).toHaveAttribute(
      "href",
      "https://example.test/mambo"
    );
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
    const calLink = screen.getByRole("link", { name: /add to calendar/i });
    expect(calLink).toHaveAttribute(
      "href",
      expect.stringContaining("https://calendar.google.com/calendar/u/0/r/eventedit?")
    );
    expect(calLink).toHaveAttribute("target", "_blank");
  });

  it("falls back to an .ics download button when the event has no start/end", () => {
    render(<EventModal event={{ ...baseEvent, start: "", end: "" }} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /add to calendar/i })).not.toBeInTheDocument();
  });
});
