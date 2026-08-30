import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventCard from "./EventCard";
import { ScheduleXEvent } from "../../types/events";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const baseEvent: ScheduleXEvent = {
  id: "42",
  title: "Rooftop Sunset Social",
  start: "2026-07-29 19:00",
  end: "2026-07-29 23:00",
  calendarId: "social",
  location: "Seaport Rooftop, Boston",
};

function renderCard(event: ScheduleXEvent, onSelect = vi.fn()) {
  return render(
    <MemoryRouter>
      <EventCard event={event} onSelect={onSelect} />
    </MemoryRouter>
  );
}

describe("EventCard", () => {
  it("renders title, day, and type chip", () => {
    renderCard(baseEvent);
    expect(screen.getByRole("heading", { name: "Rooftop Sunset Social" })).toBeInTheDocument();
    expect(screen.getByText("29")).toBeInTheDocument();
    expect(screen.getByText("Social Dance")).toBeInTheDocument();
  });

  it("renders branded title artwork when no flyer is available", () => {
    const { container } = renderCard({ ...baseEvent, imageUrl: undefined });
    expect(container.querySelector(".ss-fallback")).toBeInTheDocument();
  });

  it("shows location only when present", () => {
    const { rerender } = renderCard(baseEvent);
    expect(screen.getByText(/Seaport Rooftop/)).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <EventCard event={{ ...baseEvent, location: undefined }} onSelect={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Seaport Rooftop/)).not.toBeInTheDocument();
  });

  it("selects the event on click", () => {
    const onSelect = vi.fn();
    renderCard(baseEvent, onSelect);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(baseEvent);
  });

  it("selects the event on Enter key", () => {
    const onSelect = vi.fn();
    renderCard(baseEvent, onSelect);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(baseEvent);
  });

  it("applies the class-specific thumb and chip modifier", () => {
    renderCard({ ...baseEvent, calendarId: "class" });
    expect(screen.getByText("Class")).toHaveClass("event-card-chip--class");
  });
});
