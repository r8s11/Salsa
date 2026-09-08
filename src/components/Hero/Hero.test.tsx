import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Hero from "./Hero";

const motionState = vi.hoisted(() => ({ reduced: false }));

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
      animate,
      transition,
      ...props
    }: ComponentProps<"div"> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => {
      const rotate =
        typeof animate === "object" && animate !== null && "rotate" in animate
          ? String(animate.rotate)
          : undefined;
      const repeat =
        typeof transition === "object" && transition !== null && "rotate" in transition
          ? String((transition.rotate as { repeat?: number }).repeat)
          : undefined;

      return (
        <div
          {...props}
          data-motion="div"
          data-motion-rotate={rotate}
          data-motion-rotate-repeat={repeat}
        >
          {children}
        </div>
      );
    },
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
  useReducedMotion: () => motionState.reduced,
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

  it("renders the decorative vinyl as a repeating Motion background layer", () => {
    const { container } = render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    );

    const vinyl = container.querySelector(".hero-vinyl");
    expect(vinyl).toHaveAttribute("aria-hidden", "true");
    expect(vinyl).toHaveAttribute("data-motion", "div");
    expect(vinyl).toHaveAttribute("data-motion-rotate", "360");
    expect(vinyl).toHaveAttribute("data-motion-rotate-repeat", "Infinity");
  });

  it("keeps the vinyl static when reduced motion is requested", () => {
    motionState.reduced = true;
    const { container, unmount } = render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    );

    const vinyl = container.querySelector(".hero-vinyl");
    expect(vinyl).toHaveAttribute("data-motion", "div");
    expect(vinyl).not.toHaveAttribute("data-motion-rotate");
    unmount();
    motionState.reduced = false;
  });
});
