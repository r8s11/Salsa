import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ScheduleXEvent } from "../../types/events";
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
    const { container } = render(<CalendarListView events={[selectedEvent]} onSelect={onSelect} />);

    const image = container.querySelector(".calendar-list-thumbnail");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveClass("calendar-list-thumbnail");
    expect(image).toHaveAttribute("width", "64");
    expect(image).toHaveAttribute("height", "80");
    expect(screen.getByText("7:00 PM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Boston Social/ }));
    expect(onSelect).toHaveBeenCalledWith(selectedEvent);
  });
});
