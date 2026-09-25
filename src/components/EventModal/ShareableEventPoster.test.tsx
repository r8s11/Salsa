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
  it("renders a Story poster with the event facts in its accessible name", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });
    const accessibleName = poster.getAttribute("aria-label") ?? "";

    expect(poster).toHaveClass("sleeve", "sleeve--story", "sleeve--social");
    expect(within(poster).getByText("LA Style · New York Style")).toBeInTheDocument();
    expect(accessibleName).toContain("Event type: Social");
    expect(accessibleName).toContain("Date: Saturday, August 29");
    expect(accessibleName).toContain("Time: 9:00 PM – 1:00 AM");
    expect(accessibleName).toContain("Venue: South Boston");
    expect(accessibleName).toContain("Address: 123 Dance St");
    expect(accessibleName).toContain("Price: $25");
    expect(accessibleName).toContain("Dance styles: LA Style, New York Style");
    expect(accessibleName).toContain("Host: DJ Coco");
    expect(accessibleName).toContain("Event link: https://salsasegura.com/e/1a2b3c4d");
  });

  it("renders a Feed poster with its format in the accessible name", () => {
    render(<ShareableEventPoster event={event} {...baseProps} format="feed" />);

    const poster = screen.getByRole("img", {
      name: /^Feed poster for Live Band Latin Night at PKL/,
    });

    expect(poster).toHaveClass("sleeve", "sleeve--feed", "sleeve--social");
    expect(poster).not.toHaveClass("sleeve--story");
  });
  it("keeps the Feed host credit beside the scan link without dropping factual tracks", () => {
    render(<ShareableEventPoster event={event} {...baseProps} format="feed" />);

    const poster = screen.getByRole("img", {
      name: /^Feed poster for Live Band Latin Night at PKL/,
    });
    const credit = within(poster).getByText("Hosted by DJ Coco");

    expect(getComputedStyle(credit).display).not.toBe("none");
    expect(within(poster).getByText("Scan", { selector: ".sleeve-scan__cta" })).toBeInTheDocument();
    expect(
      within(poster).getByText("Saturday, August 29", { selector: ".sleeve-track__value" })
    ).toBeInTheDocument();
    expect(within(poster).getByText("9:00 PM – 1:00 AM")).toBeInTheDocument();
    expect(within(poster).getByText("South Boston")).toBeInTheDocument();
    expect(within(poster).getByText("LA Style · New York Style")).toBeInTheDocument();
  });


  it.each([
    ["social", "SOCIAL"],
    ["class", "CLASS"],
    ["workshop", "WORKSHOP"],
  ] as const)("labels the %s pressing without replacing its color code", (calendarId, label) => {
    const eventWithType = { ...event, calendarId };
    render(<ShareableEventPoster event={eventWithType} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(within(poster).getByText(new RegExp(`^${label}$`, "i"))).toBeInTheDocument();
    expect(poster).toHaveClass(`sleeve--${calendarId}`);
  });
  it("announces missing event facts instead of omitting them from the accessible name", () => {
    const eventWithMissingFacts = {
      ...event,
      location: undefined,
      address: undefined,
      priceType: undefined,
      priceAmount: undefined,
      danceStyles: undefined,
      host: undefined,
    };
    render(<ShareableEventPoster event={eventWithMissingFacts} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });
    const accessibleName = poster.getAttribute("aria-label") ?? "";

    expect(accessibleName).toContain("Venue: Not listed");
    expect(accessibleName).toContain("Address: Not listed");
    expect(accessibleName).toContain("Price: Free");
    expect(accessibleName).toContain("Dance styles: Not listed");
    expect(accessibleName).toContain("Host: Not listed");
  });

  it("displays the event title as the sleeve cover heading", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    expect(screen.getByRole("heading", { name: event.title })).toHaveClass("sleeve-cover__title");
  });

  it("fits long cover titles without truncating their text", () => {
    const longTitle =
      "International Salsa and Bachata Night with Live Orchestra and Guest DJs at Havana Club Presenting Special Anniversary Celebration";
    const longEvent = { ...event, title: longTitle };

    const { rerender } = render(<ShareableEventPoster event={longEvent} {...baseProps} />);
    const title = screen.getByRole("heading", { name: longTitle });

    const storySize = Number.parseFloat(title.style.getPropertyValue("--title-size"));
    expect(storySize).toBeLessThan(54);
    expect(storySize).toBeGreaterThanOrEqual(24);

    rerender(<ShareableEventPoster event={longEvent} {...baseProps} format="feed" />);
    const feedTitle = screen.getByRole("heading", { name: longTitle });
    const feedSize = Number.parseFloat(feedTitle.style.getPropertyValue("--title-size"));
    expect(feedSize).toBeLessThan(storySize);
  });

  it("displays the date without a year, and the time range", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(within(poster).getByText("Saturday, August 29")).toBeInTheDocument();
    expect(within(poster).queryByText(/2026/)).not.toBeInTheDocument();
    expect(within(poster).getByText("9:00 PM – 1:00 AM")).toBeInTheDocument();
  });

  it("shows the venue and address note in story format", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(within(poster).getByText("South Boston")).toBeInTheDocument();
    expect(within(poster).getByText("123 Dance St")).toBeInTheDocument();
  });

  it("hides the address note in feed format", () => {
    render(<ShareableEventPoster event={event} {...baseProps} format="feed" />);

    const poster = screen.getByRole("img", {
      name: /^Feed poster for Live Band Latin Night at PKL/,
    });

    expect(within(poster).getByText("South Boston")).toBeInTheDocument();
    expect(within(poster).queryByText("123 Dance St")).not.toBeInTheDocument();
  });

  it("omits the venue row entirely when location is absent", () => {
    const eventNoLocation = { ...event, location: undefined, address: undefined };

    render(<ShareableEventPoster event={eventNoLocation} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(within(poster).queryByText("South Boston")).not.toBeInTheDocument();
    expect(within(poster).queryByText("Venue")).not.toBeInTheDocument();
  });

  it("falls back to the calendarId when the event has no dance styles", () => {
    const eventNoStyles = { ...event, danceStyles: undefined };

    render(<ShareableEventPoster event={eventNoStyles} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(within(poster).getByText("social")).toBeInTheDocument();
  });

  it("shows a dollar price sticker for a paid event", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(within(poster).getByText("$25")).toBeInTheDocument();
  });

  it("shrinks long paid prices to keep them inside both sticker formats", () => {
    const expensiveEvent = { ...event, priceAmount: 1250 };
    const { rerender } = render(<ShareableEventPoster event={expensiveEvent} {...baseProps} />);
    const storyPrice = screen.getByText("$1250");

    expect(Number.parseFloat(storyPrice.style.fontSize)).toBeLessThan(72);

    rerender(<ShareableEventPoster event={expensiveEvent} {...baseProps} format="feed" />);
    expect(Number.parseFloat(screen.getByText("$1250").style.fontSize)).toBeLessThan(56);
  });

  it("shows a Free price sticker for a free event", () => {
    const freeEvent = { ...event, priceType: "free" as const, priceAmount: undefined };

    render(<ShareableEventPoster event={freeEvent} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(within(poster).getByText("Free")).toBeInTheDocument();
  });

  it("prints the short label next to the QR code", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(within(poster).getByText(baseProps.shortLabel)).toBeInTheDocument();
  });

  it("renders the QR code as an inline SVG", () => {
    render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(poster.querySelector("svg.sleeve-qr")).toBeInTheDocument();
  });

  it("shows the host credit only when the event has a host", () => {
    const { rerender } = render(<ShareableEventPoster event={event} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });
    expect(within(poster).getByText("Hosted by DJ Coco")).toBeInTheDocument();

    rerender(<ShareableEventPoster event={{ ...event, host: undefined }} {...baseProps} />);
    expect(screen.queryByText(/Hosted by/)).not.toBeInTheDocument();
  });

  it("applies the flyer artKind class to the sleeve art", () => {
    render(<ShareableEventPoster event={event} {...baseProps} artKind="flyer" />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(poster.querySelector(".sleeve-cover__art")).toHaveClass("sleeve-cover__art--flyer");
  });

  it("applies the fallback artKind class to the sleeve art", () => {
    render(<ShareableEventPoster event={event} {...baseProps} artKind="fallback" />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(poster.querySelector(".sleeve-cover__art")).toHaveClass("sleeve-cover__art--fallback");
  });

  it("applies the pressing colour class per calendarId", () => {
    render(<ShareableEventPoster event={{ ...event, calendarId: "workshop" }} {...baseProps} />);

    const poster = screen.getByRole("img", {
      name: /^Instagram Story poster for Live Band Latin Night at PKL/,
    });

    expect(poster).toHaveClass("sleeve--workshop");
  });
});
