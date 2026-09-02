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
  priceType: "paid",
  priceAmount: 25,
};

describe("ShareableEventPoster", () => {
  it("renders a Story-native poster with type and event details in its safe content region", () => {
    render(<ShareableEventPoster event={event} />);

    const poster = screen.getByRole("img", {
      name: "Instagram Story poster for Live Band Latin Night at PKL",
    });

    expect(poster).toHaveClass("poster-story");
    expect(within(poster).getByText("social")).toBeInTheDocument();
    expect(within(poster).getByRole("heading", { name: event.title })).toBeInTheDocument();
  });

  it("renders the resolved poster image in the Instagram Story poster", () => {
    render(
      <ShareableEventPoster event={event} imageUrl="data:image/png;base64,banner" />
    );

    expect(
      screen.getByRole("img", { name: /instagram story poster/i })
    ).toBeInTheDocument();
    expect(document.querySelector(".poster-artwork-fill img")).toHaveAttribute(
      "src",
      "data:image/png;base64,banner"
    );
    expect(document.querySelector(".poster-artwork-image")).toHaveAttribute(
      "src",
      "data:image/png;base64,banner"
    );
    expect(document.querySelector(".poster-info-panel")).toBeInTheDocument();
  });

  it("uses the identical information panel when an event has no flyer", () => {
    render(<ShareableEventPoster event={event} />);

    expect(document.querySelector(".poster-artwork-frame")).not.toBeInTheDocument();
    expect(document.querySelector(".poster-info-panel")).toBeInTheDocument();
  });
});
