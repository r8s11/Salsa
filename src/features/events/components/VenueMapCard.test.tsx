import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ComponentProps } from "react";
import VenueMapCard from "./VenueMapCard";

function renderCard(props: Partial<ComponentProps<typeof VenueMapCard>> = {}) {
  return render(
    <MemoryRouter>
      <VenueMapCard
        venueName="Ailey Extension"
        streetAddress="405 W 55th St"
        cityLabel="New York City"
        directionsHref="https://maps.google.com/maps?q=Ailey+Extension"
        {...props}
      />
    </MemoryRouter>
  );
}

describe("VenueMapCard", () => {
  it("renders the map preview above the canonical venue fields", () => {
    renderCard();

    expect(screen.getByText("Map preview")).toBeInTheDocument();
    expect(screen.getByText("Ailey Extension")).toBeInTheDocument();
    expect(screen.getByText("405 W 55th St")).toBeInTheDocument();
    expect(screen.getByText("New York City")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Where" })).toBeInTheDocument();
  });

  it("links directions to the maps destination with external-navigation safety", () => {
    renderCard();

    const directions = screen.getByRole("link", { name: /get directions/i });
    expect(directions).toHaveAttribute("href", "https://maps.google.com/maps?q=Ailey+Extension");
    expect(directions).toHaveAttribute("target", "_blank");
    expect(directions).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("omits the directions action when the event has no maps destination", () => {
    renderCard({ directionsHref: null });

    expect(screen.queryByRole("link", { name: /get directions/i })).not.toBeInTheDocument();
  });

  it("shows the venue page CTA only when a destination route is supplied", () => {
    renderCard();
    expect(screen.queryByRole("link", { name: /venue page/i })).not.toBeInTheDocument();

    renderCard({ venuePageHref: "/venues/ailey-extension" });
    expect(screen.getByRole("link", { name: /venue page/i })).toHaveAttribute(
      "href",
      "/venues/ailey-extension"
    );
  });

  it("does not repeat a city already present in the street address", () => {
    renderCard({ streetAddress: "405 W 55th St, New York City, NY" });

    expect(screen.getByText("405 W 55th St, New York City, NY")).toBeInTheDocument();
    expect(screen.queryByText("New York City")).not.toBeInTheDocument();
  });

  it("renders nothing when the event carries no venue or address", () => {
    const { container } = renderCard({ venueName: null, streetAddress: null });

    expect(container).toBeEmptyDOMElement();
  });
});
