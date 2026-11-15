import { describe, expect, it } from "vitest";
import { buildEmptyAdminForm } from "../admin/model/adminEventForm";
import { artistEventPayload, validateArtistEvent } from "./model";
const draft = { ...buildEmptyAdminForm("new-york-city"), title: "Workshop", event_type: "workshop" as const, event_types: ["workshop" as const], event_date: "2099-12-05", event_time: "14:00", location: "Dance hall", image_urls: ["https://artist.example/flyer.png"], image_url: "https://artist.example/flyer.png" };
const settings = { rsvp_enabled: true, rsvp_closed: false, rsvp_limit: 30 };
describe("artist event model", () => {
  it("U3 pricing variants preserve canonical dates, geography and flyers", () => {
    expect(validateArtistEvent({ ...draft, price_type: "free" }, settings)).toBeNull();
    expect(validateArtistEvent({ ...draft, price_type: "" }, settings)).toMatch(/Free or Paid/);
    for (const link of ["http://artist.example/pay", "https://artist.example/pay?event=1"]) {
      const paid = { ...draft, price_type: "paid" as const, price_amount: "25", rsvp_link: link };
      expect(validateArtistEvent(paid, settings)).toBeNull();
      const payload = artistEventPayload(paid, settings);
      expect(payload).toMatchObject({ event_date: "2099-12-05T19:00:00Z", city: "new-york-city", location: "Dance hall", image_urls: draft.image_urls, rsvp_link: link });
      expect(payload).not.toHaveProperty("recurrence");
      expect(payload).not.toHaveProperty("series_id");
      expect(payload).not.toHaveProperty("paid");
    }
    for (const link of ["", "artist.example/pay", "javascript:alert(1)", "https://user:pass@artist.example", "https://"]) expect(validateArtistEvent({ ...draft, price_type: "paid", price_amount: "25", rsvp_link: link }, settings)).not.toBeNull();
    expect(validateArtistEvent({ ...draft, price_type: "free" }, { ...settings, rsvp_limit: 1.5 })).toMatch(/whole number/);
  });
});
