import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FeaturedEventCard from "./FeaturedEventCard";
import { ScheduleXEvent } from "../../types/events";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const baseEvent: ScheduleXEvent = {
  id: "7",
  title: "Salsa Social at The Dance Union",
  start: "2026-07-18 20:00",
  end: "2026-07-19 00:00",
  calendarId: "social",
  location: "The Dance Union, Somerville",
  description: "Two floors of salsa and bachata with rotating DJs.",
};

function renderCard(event: ScheduleXEvent) {
  return render(
    <MemoryRouter>
      <FeaturedEventCard event={event} />
    </MemoryRouter>
  );
}

describe("FeaturedEventCard", () => {
  it("renders title, date, type label, and description", () => {
    renderCard(baseEvent);
    expect(
      screen.getByRole("heading", { name: "Salsa Social at The Dance Union" })
    ).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("Social Dance")).toBeInTheDocument();
    expect(screen.getByText(/rotating DJs/)).toBeInTheDocument();
  });

  it("omits the description paragraph when absent", () => {
    renderCard({ ...baseEvent, description: undefined });
    expect(screen.queryByText(/rotating DJs/)).not.toBeInTheDocument();
  });

  it("navigates to the calendar deep link on click", () => {
    renderCard(baseEvent);
    fireEvent.click(screen.getByRole("button"));
    expect(mockNavigate).toHaveBeenCalledWith("/calendar?event=7");
  });

  it("applies the workshop media modifier for workshop events", () => {
    const { container } = renderCard({ ...baseEvent, calendarId: "workshop" });
    expect(container.querySelector(".featured-card-media--workshop")).toBeInTheDocument();
  });
});
