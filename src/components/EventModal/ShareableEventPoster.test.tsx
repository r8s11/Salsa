import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ScheduleXEvent } from "../../types/events";
import ShareableEventPoster from "./ShareableEventPoster";

const event: ScheduleXEvent = {
  id: "event-1",
  title: "Live Band Latin Night at PKL",
  start: "2026-08-29 21:00",
  end: "2026-08-30 01:00",
  calendarId: "social",
  location: "South Boston",
  address: "123 Dance St",
  priceType: "paid",
  priceAmount: 25,
  danceStyles: ["LA Style", "New York Style"],
  host: "DJ Coco",
};

const baseProps = {
  imageUrl: "https://cdn.example.com/flyer.jpg",
  artKind: "flyer" as const,
  shortUrl: "https://salsasegura.com/e/1a2b3c4d",
  shortLabel: "salsasegura.com/e/1a2b3c4d",
};

describe("ShareableEventPoster", () => {
  it("renders a Story poster with the story class and aria-label", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(poster).toHaveClass("sleeve", "sleeve--story", "sleeve--social");
    expect(within(poster).getByText("LA Style · New York Style")).toBeInTheDocument();
  });

  it("renders a Feed poster with the feed class and aria-label", () => {
    render(<ShareableEventPoster event={event} {...baseProps} format="feed" />);

    const poster = screen.getByRole("img", {
      name: "Feed poster for Live Band Latin Night at PKL",
    });

    expect(poster).toHaveClass("sleeve", "sleeve--feed", "sleeve--social");
    expect(poster).not.toHaveClass("sleeve--story");
  });

  it("displays the event title as the sleeve cover heading", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    expect(screen.getByRole("heading", { name: event.title })).toHaveClass("sleeve-cover__title");
  });

  it("displays the date without a year, and the time range", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(within(poster).getByText("Saturday, August 29")).toBeInTheDocument();
    expect(within(poster).queryByText(/2026/)).not.toBeInTheDocument();
    expect(within(poster).getByText("9:00 PM – 1:00 AM")).toBeInTheDocument();
  });

  it("shows the venue and address note in story format", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(within(poster).getByText("South Boston")).toBeInTheDocument();
    expect(within(poster).getByText("123 Dance St")).toBeInTheDocument();
  });

  it("hides the address note in feed format", () => {
    render(<ShareableEventPoster event={event} {...baseProps} format="feed" />);

    const poster = screen.getByRole("img", {
      name: "Feed poster for Live Band Latin Night at PKL",
    });

    expect(within(poster).getByText("South Boston")).toBeInTheDocument();
    expect(within(poster).queryByText("123 Dance St")).not.toBeInTheDocument();
  });

  it("omits the venue row entirely when location is absent", () => {
    const eventNoLocation = { ...event, location: undefined, address: undefined };

    render(<ShareableEventPoster event={eventNoLocation} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(within(poster).queryByText("South Boston")).not.toBeInTheDocument();
    expect(within(poster).queryByText("Venue")).not.toBeInTheDocument();
  });

  it("falls back to the calendarId when the event has no dance styles", () => {
    const eventNoStyles = { ...event, danceStyles: undefined };

    render(<ShareableEventPoster event={eventNoStyles} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(within(poster).getByText("social")).toBeInTheDocument();
  });

  it("shows a dollar price sticker for a paid event", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(within(poster).getByText("$25")).toBeInTheDocument();
  });

  it("shows a Free price sticker for a free event", () => {
    const freeEvent = { ...event, priceType: "free" as const, priceAmount: undefined };

    render(<ShareableEventPoster event={freeEvent} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(within(poster).getByText("Free")).toBeInTheDocument();
  });

  it("prints the short label next to the QR code", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(within(poster).getByText(baseProps.shortLabel)).toBeInTheDocument();
  });

  it("renders the QR code as an inline SVG", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(poster.querySelector("svg.sleeve-qr")).toBeInTheDocument();
  });

  it("shows the host credit only when the event has a host", () => {
    const { rerender } = render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });
    expect(within(poster).getByText("Hosted by DJ Coco")).toBeInTheDocument();

    rerender(<ShareableEventPoster event={{ ...event, host: undefined }} {...baseProps} />);
    expect(screen.queryByText(/Hosted by/)).not.toBeInTheDocument();
  });

  it("applies the flyer artKind class to the sleeve art", () => {
    render(<ShareableEventPoster event={event} {...baseProps} artKind="flyer" />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(poster.querySelector(".sleeve-cover__art")).toHaveClass("sleeve-cover__art--flyer");
  });

  it("applies the fallback artKind class to the sleeve art", () => {
    render(<ShareableEventPoster event={event} {...baseProps} artKind="fallback" />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(poster.querySelector(".sleeve-cover__art")).toHaveClass("sleeve-cover__art--fallback");
  });

  it("applies the pressing colour class per calendarId", () => {
    render(<ShareableEventPoster event={{ ...event, calendarId: "workshop" }} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(poster).toHaveClass("sleeve--workshop");
  });
});
