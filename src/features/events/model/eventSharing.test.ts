import { describe, expect, it } from "vitest";
import {
  buildEventPromoCaption,
  buildNativeSharePayload,
  buildPublicEventUrl,
  buildShareDestinations,
} from "./eventSharing";

describe("eventSharing", () => {
  it("builds a canonical public event URL from supplied origin", () => {
    expect(buildPublicEventUrl("event-123", "https://www.salsasegura.com")).toBe(
      "https://www.salsasegura.com/events/event-123"
    );
  });

  it("does not hardcode a development hostname", () => {
    const url = buildPublicEventUrl("event-123", "https://preview.example.test");

    expect(url).toBe("https://preview.example.test/events/event-123");
    expect(url).not.toContain("localhost");
  });

  it("builds a truthful caption from complete event data", () => {
    expect(
      buildEventPromoCaption({
        title: "Havana Nights Social",
        dateLabel: "Friday, October 24 at 9:00 PM",
        location: "The Grand Ballroom",
        publicUrl: "https://www.salsasegura.com/events/event-123",
      })
    ).toBe(
      "Join us for Havana Nights Social on Friday, October 24 at 9:00 PM at The Grand Ballroom.\n\nEvent details:\nhttps://www.salsasegura.com/events/event-123"
    );
  });

  it("omits unavailable optional caption details without inventing facts", () => {
    expect(
      buildEventPromoCaption({
        title: "Baile Ñoche",
        dateLabel: "Date unavailable",
        location: null,
        publicUrl: "https://events.example.test/events/event-123",
      })
    ).toBe(
      "Join us for Baile Ñoche.\n\nEvent details:\nhttps://events.example.test/events/event-123"
    );
  });

  it("builds native payload without private organizer contact details", () => {
    expect(
      buildNativeSharePayload({
        title: "Havana Nights Social",
        dateLabel: "Friday, October 24 at 9:00 PM",
        location: "The Grand Ballroom",
        publicUrl: "https://www.salsasegura.com/events/event-123",
      })
    ).toEqual({
      title: "Havana Nights Social",
      text: "Join us for Havana Nights Social on Friday, October 24 at 9:00 PM at The Grand Ballroom.",
      url: "https://www.salsasegura.com/events/event-123",
    });
  });

  it("builds encoded WhatsApp, email, and Facebook destinations", () => {
    const links = buildShareDestinations({
      title: "Baile Ñoche",
      dateLabel: "Friday, October 24 at 9:00 PM",
      location: "The Grand Ballroom",
      publicUrl: "https://www.salsasegura.com/events/event-123",
    });

    expect(links.whatsApp).toContain("https://wa.me/?text=");
    expect(links.whatsApp).toContain("Baile%20%C3%91oche");
    expect(links.email).toContain("mailto:?subject=");
    expect(links.facebook).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fwww.salsasegura.com%2Fevents%2Fevent-123"
    );
  });
});
