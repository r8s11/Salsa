import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ScheduleXEvent } from "../../../types/events";
import CalendarListView from "./CalendarListView";

function makeEvent(id: string, title: string, start: string): ScheduleXEvent {
  return {
    id,
    title,
    start,
    end: start,
    calendarId: "social",
    location: "Dance Hall",
  };
}

describe("CalendarListView", () => {
  it("groups rows by date in chronological order", () => {
    render(
      <CalendarListView
        events={[
          makeEvent("late", "Later", "2026-09-16 21:00"),
          makeEvent("first", "First", "2026-09-15 19:00"),
          makeEvent("early", "Early", "2026-09-16 18:00"),
        ]}
        onSelect={vi.fn()}
      />
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Tuesday, September 15",
      "Wednesday, September 16",
    ]);
    expect(screen.getAllByRole("button", { name: /2026/ }).map((row) => row.textContent)).toEqual([
      expect.stringContaining("First"),
      expect.stringContaining("Early"),
      expect.stringContaining("Later"),
    ]);
  });

  it("renders a small decorative flyer thumbnail and selects the event", () => {
    const onSelect = vi.fn();
    const selectedEvent = makeEvent("event-1", "Boston Social", "2026-09-15 19:00");
    render(<CalendarListView events={[selectedEvent]} onSelect={onSelect} />);

    expect(screen.getByText("7:00 PM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Boston Social/ }));
    expect(onSelect).toHaveBeenCalledWith(selectedEvent);
  });

  it("shows an overnight event's full time range, description, and dance styles", () => {
    const event = {
      ...makeEvent("overnight", "Late social", "2026-09-15 22:00"),
      end: "2026-09-16 01:00",
      description: "Social dancing until late.",
      danceStyles: ["Salsa", "Bachata"],
    };
    render(<CalendarListView events={[event]} onSelect={vi.fn()} />);

    expect(screen.getByText("10:00 PM – 1:00 AM (next day)")).toBeInTheDocument();
    expect(screen.getByText(event.description)).toBeInTheDocument();
    expect(screen.getByText("Salsa")).toBeInTheDocument();
    expect(screen.getByText("Bachata")).toBeInTheDocument();
  });

  it("replaces an unreachable flyer with event-specific fallback artwork without retrying forever", () => {
    const event = {
      ...makeEvent("broken-flyer", "Bachata social", "2026-09-15 22:00"),
      imageUrl: "https://invalid.example/flyer.jpg",
      danceStyles: ["Bachata"],
    };
    const { container } = render(<CalendarListView events={[event]} onSelect={vi.fn()} />);
    const image = container.querySelector("img")!;
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", "/images/event-fallbacks/bachata.svg");
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", "/images/event-fallbacks/bachata.svg");
  });

  it("names the actual end date for an event spanning more than one night", () => {
    const event = {
      ...makeEvent("weekender", "Dance weekender", "2026-09-15 22:00"),
      end: "2026-09-18 01:00",
    };
    render(<CalendarListView events={[event]} onSelect={vi.fn()} />);
    const row = screen.getByRole("button", { name: /Dance weekender/ });
    expect(row).toHaveAccessibleName(expect.stringContaining("Friday, September 18"));
    expect(row).not.toHaveAccessibleName(expect.stringContaining("next day"));
  });

  it("keeps a large chronological collection reachable through bounded pages", () => {
    const events = Array.from({ length: 120 }, (_, index) =>
      makeEvent(`event-${index}`, `Dance ${String(index).padStart(4, "0")}`, "2026-09-15 20:00")
    );
    const onSelect = vi.fn();
    render(<CalendarListView events={events} onSelect={onSelect} />);
    expect(screen.queryByRole("button", { name: /Dance 0119/ })).not.toBeInTheDocument();
    for (let page = 0; page < 3 && screen.queryByRole("button", { name: "Show more events" }); page++) {
      fireEvent.click(screen.getByRole("button", { name: "Show more events" }));
      expect(document.activeElement).toHaveClass("calendar-list-row");
    }
    fireEvent.click(screen.getByRole("button", { name: /Dance 0119/ }));
    expect(onSelect).toHaveBeenCalledWith(events[119]);
    const rows = screen.getAllByRole("button", { name: /Dance \d{4}/ });
    expect(rows[0]).toHaveAccessibleName(expect.stringContaining("Dance 0000"));
    expect(rows[119]).toHaveAccessibleName(expect.stringContaining("Dance 0119"));
  });
});
