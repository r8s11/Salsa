import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EventTitleImageInput } from "./eventTitleImage";
import { createEventTitleImage } from "./eventTitleImage";
import EventImage from "./EventImage";

const event: EventTitleImageInput = {
  id: "havana-nights",
  title: "Havana Nights Social",
  eventType: "social",
  city: "Miami",
  start: "2026-10-24T21:00:00-04:00",
};

describe("EventImage", () => {
  it("uses a supplied flyer until it emits an error", () => {
    render(<EventImage {...event} imageUrl="https://cdn.example/flyer.webp" alt="Havana flyer" />);

    const image = screen.getByRole("img", { name: "Havana flyer" });
    expect(image).toHaveAttribute("src", "https://cdn.example/flyer.webp");

    fireEvent.error(image);

    const fallbackSrc = createEventTitleImage(event);
    expect(image).toHaveAttribute("src", fallbackSrc);
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", fallbackSrc);
  });

  it("uses accessible title art immediately for a blank flyer URL", () => {
    render(<EventImage {...event} imageUrl="   " />);

    expect(screen.getByRole("img", { name: /SalsaSegura event title image for Havana Nights Social/i })).toHaveAttribute(
      "src",
      createEventTitleImage(event)
    );
  });

  it("defaults a supplied flyer alt to the event title", () => {
    render(<EventImage {...event} imageUrl="https://cdn.example/flyer.webp" />);

    expect(screen.getByRole("img", { name: "Havana Nights Social flyer" })).toBeInTheDocument();
  });

  it("synchronizes its source when flyer or title-art inputs change", () => {
    const { rerender } = render(<EventImage {...event} imageUrl="https://cdn.example/first.webp" />);
    const image = screen.getByRole("img", { name: "Havana Nights Social flyer" });

    rerender(<EventImage {...event} imageUrl="https://cdn.example/second.webp" />);
    expect(image).toHaveAttribute("src", "https://cdn.example/second.webp");

    const updatedEvent = { ...event, title: "Mambo Masterclass" };
    rerender(<EventImage {...updatedEvent} imageUrl={null} />);
    expect(image).toHaveAttribute("src", createEventTitleImage(updatedEvent));
    expect(image).toHaveAccessibleName("SalsaSegura event title image for Mambo Masterclass");
  });

  it("forwards presentation props", () => {
    render(
      <EventImage
        {...event}
        imageUrl="https://cdn.example/flyer.webp"
        className="event-image"
        loading="lazy"
      />
    );

    const image = screen.getByRole("img", { name: "Havana Nights Social flyer" });
    expect(image).toHaveClass("event-image");
    expect(image).toHaveAttribute("loading", "lazy");
  });
});
