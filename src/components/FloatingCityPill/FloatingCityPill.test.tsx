import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useCity } from "../../contexts/useCity";
import { useMetroName } from "../../features/metros/hooks/useMetros";
import type { RankedMetro } from "../../features/metros/model/metro";
import FloatingCityPill from "./FloatingCityPill";

vi.mock("../../contexts/useCity", () => ({ useCity: vi.fn() }));
vi.mock("../../features/metros/hooks/useMetros", () => ({ useMetroName: vi.fn() }));

const setCity = vi.fn();
const chooseNearMe = vi.fn();

const activeMetros: RankedMetro[] = [
  {
    slug: "boston",
    name: "Boston",
    stateRegion: "MA",
    countryCode: "US",
    latitude: 42.3601,
    longitude: -71.0589,
    upcomingEventCount: 4,
    nextEventAt: "2099-01-01T00:00:00Z",
    distanceKm: null,
  },
  {
    slug: "new-york-city",
    name: "New York City",
    stateRegion: "NY",
    countryCode: "US",
    latitude: 40.7128,
    longitude: -74.006,
    upcomingEventCount: 6,
    nextEventAt: "2099-01-01T00:00:00Z",
    distanceKm: null,
  },
];

function mockCity(city: string | null = "boston") {
  vi.mocked(useCity).mockReturnValue({
    city,
    source: "explicit",
    resolving: false,
    setCity,
    chooseNearMe,
    activeMetros,
    activeMetrosError: null,
    locationStatus: "idle",
  });
}

function scrollTo(value: number) {
  act(() => {
    Object.defineProperty(window, "scrollY", { value, writable: true, configurable: true });
    window.dispatchEvent(new Event("scroll"));
  });
}

function renderPill() {
  return render(
    <MemoryRouter>
      <FloatingCityPill />
    </MemoryRouter>
  );
}

describe("FloatingCityPill", () => {
  beforeEach(() => {
    setCity.mockClear();
    scrollTo(0);
    mockCity();
    vi.mocked(useMetroName).mockReturnValue((slug: string | null | undefined) =>
      slug === "boston" ? "Boston" : slug === "new-york-city" ? "New York City" : (slug ?? "")
    );
  });

  afterEach(() => {
    scrollTo(0);
  });

  it("stays hidden before the scroll threshold", () => {
    renderPill();

    expect(
      screen.queryByRole("button", { name: /explore other cities/i })
    ).not.toBeInTheDocument();
  });

  it("appears after scrolling past the threshold", () => {
    renderPill();

    scrollTo(500);

    expect(
      screen.getByRole("button", { name: /boston.*explore other cities/i })
    ).toBeInTheDocument();
  });

  it("selects a city through the existing city context", async () => {
    const user = userEvent.setup();
    renderPill();
    scrollTo(500);

    await user.click(screen.getByRole("button", { name: /explore other cities/i }));
    await user.click(screen.getByRole("button", { name: /New York City/ }));

    expect(setCity).toHaveBeenCalledWith("new-york-city");
  });

  it("shows the current city on the trigger", () => {
    mockCity("new-york-city");
    renderPill();
    scrollTo(500);

    expect(
      screen.getByRole("button", { name: /new york city.*explore other cities/i })
    ).toBeInTheDocument();
  });
});