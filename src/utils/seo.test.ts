import { describe, expect, it } from "vitest";
import type { DatabaseEvent } from "../features/events/model/types";
import { generateEventStructuredData } from "./seo";

const event: Pick<
  DatabaseEvent,
  "id" | "title" | "description" | "event_date" | "location" | "address" | "rsvp_link" | "price_type" | "price_amount"
> = {
  id: "event-1",
  title: "Havana Nights",
  description: "A real event description.",
  event_date: "2026-10-25T01:00:00.000Z",
  location: "Grand Ballroom",
  address: "288 Green St",
  rsvp_link: "https://tickets.example.com/havana",
  price_type: "paid",
  price_amount: 15,
};

describe("generateEventStructuredData", () => {
  it("does not identify Salsa Segura as the event host or performer", () => {
    const data = JSON.parse(generateEventStructuredData(event));

    expect(data).not.toHaveProperty("organizer");
    expect(data).not.toHaveProperty("performer");
    expect(data.startDate).toBe(event.event_date);
    expect(data.url).toBe("https://www.salsasegura.com/events/event-1");
    expect(data.location).toMatchObject({ name: "Grand Ballroom" });
    expect(data.offers).toMatchObject({
      url: "https://tickets.example.com/havana",
      price: 15,
      priceCurrency: "USD",
    });
    expect(data.offers).not.toHaveProperty("availability");
  });

  it("does not invent a ticket offer for events without known pricing", () => {
    const data = JSON.parse(
      generateEventStructuredData({
        ...event,
        price_type: null,
        price_amount: null,
      })
    );

    expect(data).not.toHaveProperty("offers");
  });

  it("lists every flyer, primary first, only when an event has more than one", () => {
    const flyers = ["https://x.test/a.jpg", "https://x.test/b.jpg", "https://x.test/c.jpg"];
    const many = JSON.parse(
      generateEventStructuredData({ ...event, image_url: flyers[0], image_urls: flyers })
    );
    expect(many.image).toEqual(flyers);

    const one = JSON.parse(
      generateEventStructuredData({ ...event, image_url: flyers[0], image_urls: [flyers[0]] })
    );
    expect(one).not.toHaveProperty("image");
  });
});
