import assert from "node:assert/strict";
import { memberDigestEmail } from "./memberDigestEmail.ts";
const base = {
  siteUrl: "https://www.salsasegura.com",
  metroName: "Chicago",
  unsubscribeUrl: "https://example.test/unsubscribe?t=token",
};
Deno.test("digest shows event-zone times, safe links, escaped titles and an accessible opt-out", () => {
  const mail = memberDigestEmail({
    ...base,
    events: [{
      title: "<script>Dance</script>",
      startsAt: "2026-11-13T01:00:00Z",
      timeZone: "America/Chicago",
      venueName: "Club",
      path: "/events/dance",
    }],
  });
  assert.match(mail.text, /Thu, Nov 12, 7:00 PM CST/);
  assert.ok(mail.html.includes("&lt;script&gt;Dance&lt;/script&gt;"));
  assert.doesNotMatch(mail.html, /<script>/);
  assert.ok(
    mail.html.includes('href="https://www.salsasegura.com/events/dance"'),
  );
  assert.ok(
    mail.html.includes('href="https://example.test/unsubscribe?t=token"'),
  );
  assert.equal(
    mail.headers["List-Unsubscribe-Post"],
    "List-Unsubscribe=One-Click",
  );
  assert.equal(
    mail.headers["List-Unsubscribe"],
    "<https://example.test/unsubscribe?t=token>",
  );
  assert.match(mail.text, /turned on the weekly digest/);
});
Deno.test("digest caps the rendered selection and safely falls back for absent or invalid zones", () => {
  const events = Array.from(
    { length: 13 },
    (_, i) => ({
      title: "Night " + i,
      startsAt: "2026-11-13T01:00:00Z",
      timeZone: i === 0 ? "invalid" : null,
      venueName: null,
      path: "/events/" + i,
    }),
  );
  const mail = memberDigestEmail({ ...base, events });
  assert.equal(mail.subject, "This week in Chicago: 12 events");
  assert.doesNotMatch(mail.text, /Night 12/);
  assert.match(mail.text, /Thu, Nov 12, 8:00 PM EST/);
  assert.throws(() =>
    memberDigestEmail({
      ...base,
      events: [{ ...events[0], path: "//evil.test" }],
    })
  );
});
