import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ItineraryPosterFormat, ItineraryPosterModel, PosterTrack } from "../../model/itineraryPoster";
import ShareableItineraryPoster from "./ShareableItineraryPoster";

const tracks: PosterTrack[] = [
  { code: "A1", day: "MON 9", title: "Monday Mambo Social", time: "9 PM", venue: "Copacabana", pressing: "social" },
  { code: "A2", day: "THU 12", title: "On2 Shines Class", time: "8 PM", venue: null, pressing: "class" },
  { code: "B1", day: "FRI 13", title: "Friday Night Live", time: "10 PM", venue: "SOB's", pressing: "live_music" },
  { code: "B2", day: "SAT 14", title: "Late Social", time: "12:30 AM SUN", venue: "Taj", pressing: "social" },
];

function model(format: ItineraryPosterFormat, overrides: Partial<ItineraryPosterModel> = {}): ItineraryPosterModel {
  return {
    format,
    title: "Your week in NYC",
    catalogue: "SS-W46 · NYC",
    cityName: "New York City",
    weekLabel: "Nov 9–15",
    tiles: [
      { imageUrl: "data:image/png;base64,a", artKind: "flyer", pressing: "social" },
      { imageUrl: "/images/event-fallbacks/salsa.svg", artKind: "fallback", pressing: "class" },
    ],
    tracks,
    url: "https://salsasegura.com/itineraries/new-york-city/2026-11-09",
    urlLabel: "salsasegura.com/itineraries/new-york-city/2026-11-09",
    ...overrides,
  };
}

describe("ShareableItineraryPoster", () => {
  it("names the week, its nights and the link in one accessible image", () => {
    render(<ShareableItineraryPoster model={model("story")} />);
    const poster = screen.getByRole("img");
    expect(poster).toHaveAttribute(
      "aria-label",
      "Your week in NYC, New York City, Nov 9–15. 4 nights. Full week: https://salsasegura.com/itineraries/new-york-city/2026-11-09",
    );
    expect(poster).toHaveClass("sleeve", "sleeve--compilation", "sleeve--story");
  });

  it("presses the story back cover as sides A and B with the QR and the printed link", () => {
    const { container } = render(<ShareableItineraryPoster model={model("story")} />);
    expect(screen.getByText("Side A")).toBeInTheDocument();
    expect(screen.getByText("Side B")).toBeInTheDocument();
    expect(screen.getByText("salsasegura.com/itineraries/new-york-city/2026-11-09")).toBeInTheDocument();
    expect(screen.getByText("12:30 AM SUN")).toBeInTheDocument();
    expect(screen.getByText("Copacabana")).toBeInTheDocument();
    expect(container.querySelector(".sleeve-qr")).not.toBeNull();
  });

  it("frames every cover tile in its own pressing", () => {
    const { container } = render(<ShareableItineraryPoster model={model("feed")} />);
    const tiles = container.querySelectorAll(".itinerary-cover__tile");
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveClass("sleeve--social", "itinerary-cover__tile--flyer");
    expect(tiles[1]).toHaveClass("sleeve--class", "itinerary-cover__tile--fallback");
    // The feed spine carries the week.
    expect(container.querySelector(".sleeve-spine")).toHaveTextContent("Nov 9–15");
  });

  it("prints the deterministic fallback art when the week has no featured flyers", () => {
    const { container } = render(<ShareableItineraryPoster model={model("story", { tiles: [] })} />);
    const art = container.querySelectorAll(".itinerary-cover img");
    expect(art).toHaveLength(1);
    expect(art[0]).toHaveAttribute("src", "/images/event-fallbacks/salsa.svg");
  });

  it("keeps every track when the title runs to 80 characters", () => {
    const title = "A".repeat(38) + " " + "B".repeat(41);
    expect(title).toHaveLength(80);
    for (const format of ["story", "feed", "card"] as const) {
      const { container, unmount } = render(<ShareableItineraryPoster model={model(format, { title })} />);
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(container.querySelectorAll(".sleeve-track")).toHaveLength(tracks.length);
      unmount();
    }
  });

  it("opens the card as a gatefold without a QR code", () => {
    const { container } = render(<ShareableItineraryPoster model={model("card")} />);
    const panels = container.querySelectorAll(".sleeve--card > *");
    expect(panels).toHaveLength(3);
    expect(panels[1]).toHaveClass("itinerary-cover");
    expect(container.querySelector(".sleeve-qr")).toBeNull();
    expect(screen.getByText("The Week")).toBeInTheDocument();
    expect(screen.getByText("FRI 13")).toBeInTheDocument();
  });
});
