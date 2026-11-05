import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseEvent } from "../../../types/events";
import type { Itinerary, ItineraryItem } from "../model/types";
import ItineraryPage from "./ItineraryPage";

const setCity = vi.fn();
const usePublishedItinerary = vi.fn();

vi.mock("../../../contexts/useCity", () => ({ useCity: () => ({ setCity }) }));
vi.mock("../../metros/hooks/useMetros", () => ({
  useMetros: () => ({
    metros: [
      { slug: "new-york-city", name: "New York City" },
      { slug: "boston", name: "Boston" },
    ],
    loading: false,
    error: null,
  }),
  useMetroName: () => (slug: string) => (slug === "new-york-city" ? "New York City" : slug),
}));
vi.mock("../hooks/useItineraryQueries", () => ({
  usePublishedItinerary: (city: string, weekStart: string) => usePublishedItinerary(city, weekStart),
}));

const NIGHTS = ["09", "10", "11", "12", "13", "14", "15"];

function event(id: string, day: string, extra: Partial<DatabaseEvent> = {}): DatabaseEvent {
  // 21:00 New York (EST) on 2026-11-<day>.
  const next = String(Number(day) + 1).padStart(2, "0");
  return {
    id,
    slug: null,
    title: id,
    description: null,
    event_type: "social",
    event_date: `2026-11-${next}T02:00:00Z`,
    event_time: null,
    location: "Venue",
    address: null,
    price_type: "paid",
    price_amount: 15,
    rsvp_link: null,
    image_url: "https://example.com/f.jpg",
    city: "new-york-city",
    sublocation: null,
    created_at: "2026-11-01T00:00:00Z",
    host: null,
    taxonomy_terms: [],
    dance_styles: ["salsa"],
    ...extra,
  } as DatabaseEvent;
}

const itinerary: Itinerary = {
  id: "it-1",
  city: "new-york-city",
  weekStart: "2026-11-09",
  timeZone: "America/New_York",
  title: "Salsa week in New York",
  description: "Seven nights on the floor.",
  recommendations: "Bring water shoes.",
  unfeaturedDays: [],
  status: "published",
  coverImageUrl: null,
  coverGeneratedAt: null,
  publishedAt: "2026-11-03T00:00:00Z",
  updatedAt: "2026-11-03T00:00:00Z",
};

function published(events: DatabaseEvent[], items: ItineraryItem[]) {
  return {
    itinerary,
    items,
    events: new Map(events.map((e) => [e.id, e])),
    neighbours: { previous: null, next: "2026-11-16" },
    loading: false,
    error: null,
  };
}

function weekFixture(friday: Partial<DatabaseEvent> = {}) {
  const events = NIGHTS.map((day, i) =>
    i === 4
      ? event("friday", day, { title: "Noche Latina", slug: "noche-latina", ...friday })
      : event(`night-${day}`, day, { dance_styles: i === 1 ? ["bachata"] : ["salsa"] })
  );
  const items: ItineraryItem[] = events.map((e, i) => ({
    eventId: e.id,
    role: "featured",
    position: i,
    note: i === 4 ? "The live band starts at eleven." : null,
  }));
  return published(events, items);
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/itineraries/:city/:weekStart", element: <ItineraryPage /> },
      { path: "/events/:id", element: <main>Event page</main> },
    ],
    { initialEntries: [path] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  setCity.mockClear();
  usePublishedItinerary.mockReset();
  usePublishedItinerary.mockReturnValue(weekFixture());
});

describe("ItineraryPage", () => {
  it("redirects aliases and non-Monday dates to the canonical week URL", () => {
    const router = renderAt("/itineraries/nyc/2026-11-11");
    expect(router.state.location.pathname).toBe("/itineraries/new-york-city/2026-11-09");
    expect(screen.getByRole("heading", { level: 1, name: "Salsa week in New York" })).toBeInTheDocument();
  });

  it("renders the not-found page when the week is not published", () => {
    usePublishedItinerary.mockReturnValue({
      ...published([], []),
      itinerary: null,
      neighbours: { previous: null, next: null },
    });
    renderAt("/itineraries/new-york-city/2026-11-09");
    expect(screen.getByRole("heading", { name: "Page Not Found" })).toBeInTheDocument();
    expect(document.title).toContain("Page not found");
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "").not.toContain(
      "/itineraries/"
    );
  });

  it("sets the published week's metadata", () => {
    renderAt("/itineraries/new-york-city/2026-11-09");
    expect(document.title).toContain("Salsa week in New York");
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://www.salsasegura.com/itineraries/new-york-city/2026-11-09"
    );
  });

  it("keeps seven day cells when the week is sparse", () => {
    const friday = event("friday", "13", { title: "Noche Latina" });
    usePublishedItinerary.mockReturnValue(
      published([friday], [{ eventId: "friday", role: "featured", position: 0, note: null }])
    );
    renderAt("/itineraries/new-york-city/2026-11-09");

    const cells = screen.getByRole("navigation", { name: "Nights this week" }).querySelectorAll("li");
    expect(Array.from(cells).map((li) => li.textContent)).toEqual([
      "MonNo events",
      "TueNo events",
      "WedNo events",
      "ThuNo events",
      "FriNoche Latina9 PM",
      "SatNo events",
      "SunNo events",
    ]);
    expect(cells[4].querySelector("a")).toHaveAttribute("href", "#night-2026-11-13");
    expect(cells[0].querySelector("a")).toBeNull();
  });

  it("replaces the strip and nights with an empty state when every event has gone", () => {
    usePublishedItinerary.mockReturnValue(
      published([], [{ eventId: "gone", role: "featured", position: 0, note: null }])
    );
    renderAt("/itineraries/new-york-city/2026-11-09");

    expect(screen.getByRole("heading", { level: 1, name: "Salsa week in New York" })).toBeInTheDocument();
    expect(screen.getByText("Seven nights on the floor.")).toBeInTheDocument();
    expect(screen.getByText(/Every event on this week's list has been cancelled or removed./)).toHaveTextContent(
      "Every event on this week's list has been cancelled or removed. Check the calendar for what's on."
    );
    expect(screen.getByRole("link", { name: "Check the calendar" })).toHaveAttribute("href", "/calendar");
    expect(screen.queryByRole("navigation", { name: "Nights this week" })).not.toBeInTheDocument();
    expect(document.querySelector("[id^='night-']")).toBeNull();
  });

  it("shows card times in the itinerary's zone, not the event's own", () => {
    usePublishedItinerary.mockReturnValue(weekFixture({ time_zone: "America/Los_Angeles" }));
    renderAt("/itineraries/new-york-city/2026-11-09");

    const friday = document.getElementById("night-2026-11-13")!;
    expect(friday).toHaveTextContent("9:00 PM");
    expect(friday).not.toHaveTextContent("6:00 PM");
  });

  it("renders the week strip and navigates to the featured event", () => {
    const router = renderAt("/itineraries/new-york-city/2026-11-09");

    expect(setCity).toHaveBeenCalledWith("new-york-city");
    const strip = screen.getByRole("navigation", { name: "Nights this week" });
    const anchors = Array.from(strip.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(anchors).toEqual(NIGHTS.map((day) => `#night-2026-11-${day}`));
    expect(screen.getByText("New York City · Nov 9–15")).toBeInTheDocument();
    const styles = screen.getByRole("list", { name: "Dance styles" });
    expect(within(styles).getAllByRole("listitem").map((n) => n.textContent?.toLowerCase())).toEqual([
      "salsa",
      "bachata",
    ]);
    expect(screen.getByText("The live band starts at eleven.")).toBeInTheDocument();
    expect(screen.getByText("Estimated admission for the featured nights: $105")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next week/ })).toHaveAttribute(
      "href",
      "/itineraries/new-york-city/2026-11-16"
    );

    fireEvent.click(screen.getByRole("button", { name: "Noche Latina" }));
    expect(router.state.location.pathname).toBe("/events/noche-latina");
  });

  it("hides estimated admission when a featured price is unknown", () => {
    usePublishedItinerary.mockReturnValue(weekFixture({ price_type: null, price_amount: null }));
    renderAt("/itineraries/new-york-city/2026-11-09");
    expect(screen.queryByText(/Estimated admission/)).not.toBeInTheDocument();
  });

  it("shares the canonical itinerary URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderAt("/itineraries/new-york-city/2026-11-09");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy week link" }));
    });

    expect(writeText).toHaveBeenCalledWith("https://www.salsasegura.com/itineraries/new-york-city/2026-11-09");
  });

  it("lists a night's alternatives by start time, not editorial rank", () => {
    const week = weekFixture();
    const late = event("late", "13", { title: "Late Salsa Practica", event_date: "2026-11-14T04:30:00Z" });
    const early = event("early", "13", { title: "Early Bachata Class", event_date: "2026-11-14T00:00:00Z" });
    usePublishedItinerary.mockReturnValue(
      published(
        [...week.events.values(), late, early],
        [
          ...week.items,
          { eventId: "late", role: "alternative", position: 0, note: null },
          { eventId: "early", role: "alternative", position: 1, note: null },
        ]
      )
    );
    renderAt("/itineraries/new-york-city/2026-11-09");

    const friday = document.getElementById("night-2026-11-13")!;
    const titles = Array.from(friday.querySelectorAll("h3")).map((h) => h.textContent);
    expect(titles).toEqual(["Noche Latina", "Early Bachata Class", "Late Salsa Practica"]);
  });

  it("shows known event admission and canonical links without inventing unknown prices", () => {
    const free = event("free-night", "09", { title: "Free dance", price_type: "free", price_amount: null });
    const paid = event("paid-night", "10", { title: "Band night", slug: "band-night", price_amount: 25 });
    const unknown = event("unknown-night", "11", { title: "Open dance", price_type: null, price_amount: null });
    usePublishedItinerary.mockReturnValue(published(
      [free, paid, unknown],
      [free, paid, unknown].map((entry) => ({ eventId: entry.id, role: "featured", position: 0, note: null }))
    ));
    renderAt("/itineraries/new-york-city/2026-11-09");
    expect(within(screen.getByRole("group", { name: "Details for Free dance" })).getByText("Free")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Details for Band night" })).getByText("$25")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Details for Open dance" })).queryByText(/Free|\$/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Event details: Band night" })).toHaveAttribute("href", "/events/band-night");
  });
});
