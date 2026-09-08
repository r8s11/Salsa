import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Hero from "./Hero";

vi.mock("../../contexts/useCity", () => ({
  useCity: () => ({ city: "boston" }),
}));

vi.mock("../../hooks/useEvent", () => ({
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
  it("marks its mobile action hierarchy and compact stat rail explicitly", () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Tonight on the floor" })).toHaveClass(
      "hero-btn--primary",
    );
    expect(screen.getByRole("link", { name: "Full calendar" })).toHaveClass(
      "hero-btn--secondary",
    );
    expect(screen.getByText("Events This Week").closest(".hero-stats")).toHaveClass(
      "hero-stats--compact",
    );
  });
});
