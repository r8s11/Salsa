import type { ComponentProps } from "react";
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

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...props
    }: ComponentProps<"div"> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => (
      <div {...props} data-motion="div">
        {children}
      </div>
    ),
    h1: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...props
    }: ComponentProps<"h1"> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => (
      <h1 {...props} data-motion="h1">
        {children}
      </h1>
    ),
    p: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...props
    }: ComponentProps<"p"> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => (
      <p {...props} data-motion="p">
        {children}
      </p>
    ),
  },
  useReducedMotion: () => false,
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

  it("uses Motion to animate the desktop and mobile hero layers", () => {
    const { container } = render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    );

    expect(container.querySelector(".hero-bg")).toHaveAttribute("data-motion", "div");
    expect(container.querySelector(".hero-heading")).toHaveAttribute("data-motion", "h1");
    expect(container.querySelector(".hero-cta")).toHaveAttribute("data-motion", "div");
    expect(container.querySelector(".hero-stats")).toHaveAttribute("data-motion", "div");
  });
});
