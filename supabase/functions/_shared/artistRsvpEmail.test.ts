import assert from "node:assert/strict";
import { artistRsvpEmail, type ArtistRsvpFacts, type ArtistRsvpNotificationKind } from "./artistRsvpEmail.ts";
const facts: ArtistRsvpFacts = { event_title: '<script>alert("x")</script>', event_date: "2099-12-05T19:00:00Z", time_zone: "America/New_York", artist_name: "Ari & Friends", artist_slug: "ari", event_slug: "music", external_url: "https://artist.test/pay?a=1&b=2", is_free: false, city: "new-york-city" };
Deno.test("RSVP email escapes facts and preserves separate signup, artist acceptance and payment meanings", () => {
  for (const kind of ["main_receipt", "waitlist_receipt", "capacity_full", "new_waitlist", "acceptance", "withdrawal", "date_update"] as ArtistRsvpNotificationKind[]) {
    const mail = artistRsvpEmail(kind, facts, "event", "artist", "https://site.test");
    assert.ok(!mail.html.includes("<script>")); assert.ok(mail.html.includes("&lt;script&gt;")); assert.ok(mail.html.includes("Ari &amp; Friends")); assert.ok(mail.text.includes(facts.event_title)); assert.match(mail.text, /2:00 PM/); assert.match(mail.text, /America\/New_York/); assert.ok(!mail.text.includes("You have paid"));
    if (kind === "waitlist_receipt") { assert.match(mail.text, /waitlist/); assert.match(mail.text, /no place is confirmed/i); assert.match(mail.text, /before paying/); }
    if (kind === "withdrawal" || kind === "date_update") assert.match(mail.text, /does not process or promise a refund/);
    if (kind === "acceptance") assert.match(mail.text, /not verified payment/);
    if (kind === "capacity_full" || kind === "new_waitlist") assert.match(mail.text, /\/host\/instructors\/artist\/events\/event\/rsvps/);
  }
});
