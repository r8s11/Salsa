import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CityContextValue } from "../../contexts/cityContextObject";
import { useCity } from "../../contexts/useCity";
import FloatingCityPill from "./FloatingCityPill";

vi.mock("../../contexts/useCity", () => ({ useCity: vi.fn() }));

const setCity = vi.fn();

function mockCity(city: CityContextValue["city"] = "boston") {
  vi.mocked(useCity).mockReturnValue({ city, setCity });
}

function scrollTo(value: number) {
  act(() => {
    Object.defineProperty(window, "scrollY", { value, writable: true, configurable: true });
    window.dispatchEvent(new Event("scroll"));
  });
}

describe("FloatingCityPill", () => {
  beforeEach(() => {
    setCity.mockClear();
    scrollTo(0);
    mockCity();
  });

  afterEach(() => {
    scrollTo(0);
  });

  it("stays hidden before the scroll threshold", () => {
    render(<FloatingCityPill />);

    expect(screen.queryByRole("group", { name: /choose city/i })).not.toBeInTheDocument();
  });

  it("appears after scrolling past the threshold", () => {
    render(<FloatingCityPill />);

    scrollTo(500);

    expect(screen.getByRole("group", { name: /choose city/i })).toBeInTheDocument();
  });

  it("selects a city through the existing city context", async () => {
    const user = userEvent.setup();
    render(<FloatingCityPill />);
    scrollTo(500);

    await user.click(screen.getByRole("button", { name: "NYC" }));

    expect(setCity).toHaveBeenCalledWith("new-york-city");
  });

  it("marks the active city pressed", () => {
    mockCity("new-york-city");
    render(<FloatingCityPill />);
    scrollTo(500);

    expect(screen.getByRole("button", { name: "NYC" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "BOS" })).toHaveAttribute("aria-pressed", "false");
  });
});
