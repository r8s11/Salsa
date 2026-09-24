import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("shows the recently approved indicator for moderator-approved events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
    renderCard({
      ...baseEvent,
      createdAt: "2026-08-31T12:00:00Z",
      sourceType: "moderator",
    });

    expect(screen.getByText("Just approved")).toBeInTheDocument();
  });

  it("uses a lazy deterministic public fallback flyer when no flyer is available", () => {
    const { container } = renderCard({ ...baseEvent, imageUrl: undefined });
    const image = container.querySelector(".event-card-image");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute(
      "src",
      expect.stringMatching(/\/images\/event-fallbacks\/.+\.svg/)
    );
    expect(container.querySelector(".ss-fallback")).not.toBeInTheDocument();
  });

  it("switches a broken real flyer to its deterministic fallback", () => {
    const { container } = renderCard({
      ...baseEvent,
      imageUrl: "https://example.test/missing-flyer.jpg",
    });
    const image = container.querySelector(".event-card-image") as HTMLImageElement;

    fireEvent.error(image);

    expect(image).toHaveAttribute(
      "src",
      expect.stringMatching(/\/images\/event-fallbacks\/.+\.svg/)
    );
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

  it("opens from the keyboard through a real button inside the title heading", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCard(baseEvent, onSelect);
    const heading = screen.getByRole("heading", { name: "Rooftop Sunset Social" });
    const button = within(heading).getByRole("button", { name: "Rooftop Sunset Social" });

    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(baseEvent);
  });

  it("applies the class-specific thumb and chip modifier", () => {
    renderCard({ ...baseEvent, calendarId: "class" });
    expect(screen.getByText("Class")).toHaveClass("event-card-chip--class");
  });
});

afterEach(() => {
  vi.useRealTimers();
});
