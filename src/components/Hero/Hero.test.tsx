import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Hero from "./Hero";

const { mockUseCity } = vi.hoisted(() => ({ mockUseCity: vi.fn() }));

vi.mock("../../contexts/useCity", () => ({ useCity: mockUseCity }));

const mockCity = (source: "location" | "explicit" = "location") => ({
  city: "boston",
  source,
  resolving: false,
  setCity: vi.fn(),
  chooseNearMe: vi.fn(),
  activeMetros: [],
  activeMetrosError: null,
  locationStatus: "granted" as const,
});

vi.mock("../../features/metros/hooks/useMetros", () => ({
  useMetroName: () => () => "Boston",
}));

vi.mock("../../features/events/hooks/useEvent", () => ({
  useEvents: () => ({
    events: [
      {
        start: "2099-01-01 19:00",
        title: "Friday social",
        location: "Dance Complex",
      },
    ],
    loading: false,
  }),
}));

describe("Hero", () => {
  beforeEach(() => {
    mockUseCity.mockReturnValue(mockCity());
  });

  it("keeps Events near me in the city picker instead of repeating it beside the picker", () => {
    mockUseCity.mockReturnValue(mockCity("explicit"));
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Events near me" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explore other cities" }));
    expect(screen.getByRole("button", { name: "Events near me" })).toBeInTheDocument();
  });

  it("marks its mobile action hierarchy and compact stat rail explicitly", () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    // The only event is in 2099, so the primary action names that night
    // rather than claiming tonight.
    expect(screen.getByRole("link", { name: /^Next up · \w{3} 1 Jan$/ })).toHaveClass(
      "hero-btn--primary"
    );
    expect(screen.queryByRole("link", { name: "Tonight on the floor" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Full calendar" })).toHaveClass("hero-btn--secondary");
    expect(screen.getByText("Events This Week").closest(".hero-stats")).toHaveClass(
      "hero-stats--compact"
    );
  });

  it("states the metro in context and always offers other cities", () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    // Picked from the visitor's area, so the copy says "near".
    expect(screen.getByText("Salsa & Bachata Events near Boston")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore other cities" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByText("BOS")).toBeInTheDocument();
  });

  it("renders the decorative record as layered, non-announced background art", () => {
    const { container } = render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    const vinyl = container.querySelector(".hero-vinyl");
    expect(vinyl).toHaveAttribute("aria-hidden", "true");
    // Disc and label spin together in CSS; glow and sheen stay put.
    expect(vinyl?.querySelector(".hero-vinyl__disc .hero-vinyl__grooves")).toBeInTheDocument();
    expect(vinyl?.querySelector(".hero-vinyl__disc .hero-vinyl__label")).toBeInTheDocument();
    expect(vinyl?.querySelector(".hero-vinyl__glow")).toBeInTheDocument();
    expect(vinyl?.querySelector(".hero-vinyl__sheen")).toBeInTheDocument();
  });
});
