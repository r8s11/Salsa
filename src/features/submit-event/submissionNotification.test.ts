import { describe, expect, it } from "vitest";
import { buildSubmissionNotificationEmail } from "./submissionNotification";
import type { SubmissionCreate } from "../admin/api/submissionsRepo";

const settings = {
  platform_name: "Salsa Segura",
  support_email: "admins@salsasegura.com",
};

const baseSubmission = (): SubmissionCreate => ({
  submitter_id: null,
  submitter_email: "dancer@example.com",
  submitter_name: "Maya <Chief Tester>",
  title: "Bachata Night <b>Special</b>",
  description: null,
  event_type: "social",
  city: "boston",
  // 2026-08-28 20:00 New York = 2026-08-29T00:00Z (EDT)
  event_date: "2026-08-29T00:00:00Z",
  event_time: "20:00",
  location: "Havana Club",
  address: null,
  price_type: "paid",
  price_amount: 15,
  rsvp_link: "https://example.com/rsvp",
  recurrence: null,
  dance_styles: ["bachata", "salsa"],
});

describe("buildSubmissionNotificationEmail", () => {
  it("targets and sends from the configured support email", () => {
    const payload = buildSubmissionNotificationEmail(baseSubmission(), settings);

    expect(payload.from).toBe("admins@salsasegura.com");
    expect(payload.to).toBe("admins@salsasegura.com");
    expect(payload.subject).toContain("Bachata Night");
  });

  it("sets replyTo to the submitter email", () => {
    const payload = buildSubmissionNotificationEmail(baseSubmission(), settings);
    expect(payload.replyTo).toBe("dancer@example.com");
  });

  it("omits replyTo for anonymous submissions", () => {
    const submission = { ...baseSubmission(), submitter_email: null };
    const payload = buildSubmissionNotificationEmail(submission, settings);
    expect(payload.replyTo).toBeUndefined();
  });

  it("escapes HTML in user-provided values", () => {
    const payload = buildSubmissionNotificationEmail(baseSubmission(), settings);

    expect(payload.html).not.toContain("<b>Special</b></td>");
    expect(payload.html).toContain("&lt;b&gt;Special&lt;/b&gt;");
    expect(payload.html).toContain("Maya &lt;Chief Tester&gt;");
  });

  it("renders the event date as America/New_York wall clock with time label", () => {
    const payload = buildSubmissionNotificationEmail(baseSubmission(), settings);

    expect(payload.html).toContain("Friday, August 28, 2026 at 8:00 PM ET");
  });

  it("renders free events without a price amount", () => {
    const submission = { ...baseSubmission(), price_type: "free", price_amount: null };
    const payload = buildSubmissionNotificationEmail(submission, settings);
    expect(payload.html).toContain("<td><strong>Price</strong></td><td>Free</td>");
  });
});
