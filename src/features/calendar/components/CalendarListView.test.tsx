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
});
